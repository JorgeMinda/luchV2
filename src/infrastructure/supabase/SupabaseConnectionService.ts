import type {
  SupabaseConnectionPort,
  SupabaseConnectionResult,
  SupabaseConnectionStatus,
} from '../../application/ports/SupabaseConnectionPort'
import {
  getSupabaseConfig,
  SupabaseConfigError,
  type SupabaseConfig,
} from './supabase-config'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const DEFAULT_TIMEOUT_MS = 8000

/**
 * Tabla inexistente usada como sonda de SOLO LECTURA contra PostgREST.
 * Nunca se crea ni se escribe: si responde "tabla inexistente" (código
 * PGRST*), queda demostrado que PostgREST está operativo.
 */
const PROBE_TABLE = '__lunch_connection_probe__'

export interface SupabaseConnectionServiceOptions {
  /** Inyección para pruebas. Por defecto, `fetch` global. */
  fetchImpl?: FetchLike
  /** Inyección para pruebas. Por defecto, lee `import.meta.env`. */
  loadConfig?: () => SupabaseConfig
  timeoutMs?: number
}

type ProbeResult =
  | { kind: 'response'; response: Response }
  | { kind: 'network'; error: unknown }

type SpecOutcome =
  | { kind: 'done'; result: SupabaseConnectionResult }
  | { kind: 'probe'; reason: 'secret-required' | 'root-unavailable' }

/**
 * Comprobación de conexión SOLO LECTURA contra Supabase, en tres fases:
 *
 * 1. `GET /auth/v1/health`: servicio arriba y validez de la clave.
 * 2. `GET /rest/v1/` (OpenAPI): enumera las tablas expuestas.
 * 3. Sonda a PostgREST: si la API OpenAPI exige clave secreta (no la
 *    publicable), se confirma que PostgREST responde sin enumerar.
 *
 * No crea tablas, no ejecuta migraciones ni escribe/elimina datos.
 * Clasifica: credenciales incorrectas, error de red, servicio disponible,
 * permisos insuficientes y ausencia de tablas (esta última NO es un
 * fallo de conexión). Los mensajes jamás incluyen la clave ni la URL.
 */
export class SupabaseConnectionService implements SupabaseConnectionPort {
  private readonly fetchImpl: FetchLike
  private readonly loadConfig: () => SupabaseConfig
  private readonly timeoutMs: number

  constructor(options: SupabaseConnectionServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
    this.loadConfig = options.loadConfig ?? getSupabaseConfig
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async checkConnection(): Promise<SupabaseConnectionResult> {
    let config: SupabaseConfig
    try {
      config = this.loadConfig()
    } catch (error) {
      if (error instanceof SupabaseConfigError) {
        return this.result('misconfigured', error.message, null, null)
      }
      throw error
    }

    // Fase 1: salud del servicio y validez de las credenciales.
    const health = await this.request(config, '/auth/v1/health', 'application/json')
    if (health.kind === 'network') return this.networkFailure(health.error)
    const healthResult = await this.classifyHealth(health.response)
    if (healthResult !== null) return healthResult

    // Fase 2: enumeración de tablas vía descripción OpenAPI.
    const spec = await this.request(
      config,
      '/rest/v1/',
      'application/openapi+json',
    )
    if (spec.kind === 'network') return this.networkFailure(spec.error)
    const specOutcome = await this.classifySpec(spec.response)
    if (specOutcome.kind === 'done') return specOutcome.result

    // Fase 3: la enumeración no es posible → sonda directa a PostgREST.
    const probe = await this.request(
      config,
      `/rest/v1/${PROBE_TABLE}?select=*`,
      'application/json',
    )
    if (probe.kind === 'network') return this.networkFailure(probe.error)
    return this.classifyProbe(probe.response, specOutcome.reason)
  }

  private async request(
    config: SupabaseConfig,
    path: string,
    accept: string,
  ): Promise<ProbeResult> {
    try {
      const response = await this.fetchImpl(`${config.url}${path}`, {
        method: 'GET',
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${config.publishableKey}`,
          Accept: accept,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      return { kind: 'response', response }
    } catch (error) {
      return { kind: 'network', error }
    }
  }

  /** null = continuar con la fase 2 (servicio accesible). */
  private async classifyHealth(response: Response): Promise<SupabaseConnectionResult | null> {
    const status = response.status
    if (status === 200) return null
    if (status === 401) return this.classify401(response)
    if (status === 403) {
      return this.result(
        'insufficient_permissions',
        'Permisos insuficientes: la clave fue aceptada pero no tiene permiso para consultar el servicio.',
        null,
        status,
      )
    }
    // 404/5xx u otros: no prueban nada contra la API REST; lo decide la fase 2/3.
    return null
  }

  private async classifySpec(response: Response): Promise<SpecOutcome> {
    const status = response.status

    if (status === 200) {
      const body = await this.safeText(response)
      let spec: unknown
      try {
        spec = JSON.parse(body)
      } catch {
        return {
          kind: 'done',
          result: this.result(
            'service_unavailable',
            'El servicio respondió con un formato inesperado; no se detectó la API REST de Supabase.',
            null,
            status,
          ),
        }
      }

      const paths = (spec as { paths?: unknown }).paths
      if (paths === null || typeof paths !== 'object') {
        return {
          kind: 'done',
          result: this.result(
            'service_unavailable',
            'El servicio respondió con un formato inesperado; no se detectó la API REST de Supabase.',
            null,
            status,
          ),
        }
      }

      // Solo se cuentan tablas expuestas; se excluyen los endpoints RPC.
      const tableCount = Object.keys(paths).filter((key) => !key.startsWith('/rpc/'))
        .length
      if (tableCount === 0) {
        return {
          kind: 'done',
          result: this.result(
            'no_tables',
            'Servicio disponible, pero no hay tablas publicadas en la API REST (no es un fallo de conexión).',
            0,
            status,
          ),
        }
      }
      return {
        kind: 'done',
        result: this.result(
          'connected',
          `Conexión verificada: el servicio responde y expone ${tableCount} tabla(s) en la API REST.`,
          tableCount,
          status,
        ),
      }
    }

    if (status === 401) {
      const body = await this.safeText(response)
      if (/secret api key required/i.test(body)) {
        // La clave publicable no puede enumerar: se pasa a la sonda.
        return { kind: 'probe', reason: 'secret-required' }
      }
      return { kind: 'done', result: this.classify401Body(body, status) }
    }

    if (status === 403) {
      return {
        kind: 'done',
        result: this.result(
          'insufficient_permissions',
          'Permisos insuficientes: la clave fue aceptada pero no puede consultar el esquema expuesto.',
          null,
          status,
        ),
      }
    }

    if (status === 404) {
      // El raíz no respondió como OpenAPI: la sonda decidirá si PostgREST vive.
      return { kind: 'probe', reason: 'root-unavailable' }
    }

    return {
      kind: 'done',
      result: this.result(
        'service_unavailable',
        `El servicio no está disponible (HTTP ${status}).`,
        null,
        status,
      ),
    }
  }

  private async classifyProbe(
    response: Response,
    reason: 'secret-required' | 'root-unavailable',
  ): Promise<SupabaseConnectionResult> {
    const status = response.status

    if (status === 401) return this.classify401(response)
    if (status === 403) {
      return this.result(
        'insufficient_permissions',
        'Permisos insuficientes: la clave fue aceptada pero no puede consultar las tablas.',
        null,
        status,
      )
    }

    if (status === 200) {
      return this.result(
        'connected',
        'Servicio disponible y credenciales válidas: PostgREST respondió a la sonda de solo lectura con HTTP 200. El número de tablas es desconocido.',
        null,
        status,
      )
    }

    if (status === 404) {
      const body = await this.safeText(response)
      if (/PGRST\d+/.test(body)) {
        // PostgREST respondió "tabla inexistente": servicio operativo.
        const detail =
          reason === 'secret-required'
            ? 'la API OpenAPI exige una clave secreta'
            : 'la descripción OpenAPI no está disponible'
        return this.result(
          'connected',
          `Servicio disponible y credenciales válidas: PostgREST responde (sonda de solo lectura, HTTP 404 = tabla inexistente). No se pudo enumerar el esquema porque ${detail}: el número de tablas es desconocido.`,
          null,
          status,
        )
      }
      return this.result(
        'service_unavailable',
        'El endpoint REST no respondió como se esperaba (HTTP 404).',
        null,
        status,
      )
    }

    return this.result(
      'service_unavailable',
      `El servicio no está disponible (HTTP ${status}).`,
      null,
      status,
    )
  }

  /** 401 en salud o sonda: distingue tipo de clave, ausencia o rechazo. */
  private async classify401(response: Response): Promise<SupabaseConnectionResult> {
    const body = await this.safeText(response)
    return this.classify401Body(body, response.status)
  }

  private classify401Body(body: string, status: number): SupabaseConnectionResult {
    if (/secret api key required/i.test(body)) {
      return this.result(
        'insufficient_permissions',
        'Permisos insuficientes: este endpoint exige una clave secreta; la clave publicable no tiene acceso.',
        null,
        status,
      )
    }
    if (/no api key found/i.test(body)) {
      return this.result(
        'misconfigured',
        'La solicitud salió sin cabecera apikey: error interno de integración.',
        null,
        status,
      )
    }
    return this.result(
      'invalid_credentials',
      'Credenciales incorrectas: el servicio rechazó la clave publicable.',
      null,
      status,
    )
  }

  private networkFailure(error: unknown): SupabaseConnectionResult {
    const name = error instanceof Error ? error.name : ''
    const isTimeout = name === 'TimeoutError' || name === 'AbortError'
    const code = this.causeCode(error)

    const detail = isTimeout
      ? 'se agotó el tiempo de espera'
      : code !== null
        ? `fallo de red (${code})`
        : 'no se pudo contactar con el servicio'

    return this.result(
      'network_error',
      `Error de red: ${detail}. Comprueba la conectividad y vuelve a intentarlo.`,
      null,
      null,
    )
  }

  /** Extrae un código tipo `ENOTFOUND` sin exponer mensajes con la URL. */
  private causeCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null) return null
    const cause = (error as { cause?: unknown }).cause
    if (typeof cause !== 'object' || cause === null) return null
    const code = (cause as { code?: unknown }).code
    return typeof code === 'string' ? code : null
  }

  private async safeText(response: Response): Promise<string> {
    try {
      return await response.text()
    } catch {
      return ''
    }
  }

  private result(
    status: SupabaseConnectionStatus,
    message: string,
    tableCount: number | null,
    httpStatus: number | null,
  ): SupabaseConnectionResult {
    return {
      status,
      message,
      tableCount,
      httpStatus,
      checkedAt: new Date().toISOString(),
    }
  }
}
