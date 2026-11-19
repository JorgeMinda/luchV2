import { describe, expect, it, vi } from 'vitest'
import { SupabaseConnectionService } from './SupabaseConnectionService'
import { SupabaseConfigError } from './supabase-config'

const CONFIG = {
  url: 'https://demo-project.supabase.co',
  publishableKey: 'sb_publishable_demo',
}

function makeService(
  responses: Array<(url: string) => Response | Error>,
): SupabaseConnectionService {
  const queue = [...responses]
  const fetchImpl = vi.fn(async (url: string) => {
    const next = queue.shift()
    if (!next) throw new Error('No hay más respuestas encoladas')
    const out = next(url)
    if (out instanceof Error) throw out
    return out
  }) as unknown as (input: string, init?: RequestInit) => Promise<Response>
  return new SupabaseConnectionService({ fetchImpl, loadConfig: () => CONFIG })
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('SupabaseConnectionService', () => {
  it('reporta misconfiguration cuando faltan las variables', async () => {
    const service = new SupabaseConnectionService({
      fetchImpl: vi.fn(),
      loadConfig: () => {
        throw new SupabaseConfigError('Falta VITE_SUPABASE_URL.')
      },
    })

    const result = await service.checkConnection()
    expect(result.status).toBe('misconfigured')
    expect(result.message).toContain('VITE_SUPABASE_URL')
    expect(result.httpStatus).toBeNull()
  })

  it('clasifica un fallo de red con ENOTFOUND', async () => {
    const service = makeService([
      () => Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }),
    ])

    const result = await service.checkConnection()
    expect(result.status).toBe('network_error')
    expect(result.message).toContain('ENOTFOUND')
    expect(result.message).not.toContain(CONFIG.url)
    expect(result.httpStatus).toBeNull()
  })

  it('clasifica un timeout de red', async () => {
    const timeoutError = Object.assign(new Error('The operation timed out'), {
      name: 'TimeoutError',
    })
    const service = makeService([() => timeoutError])

    const result = await service.checkConnection()
    expect(result.status).toBe('network_error')
    expect(result.message).toContain('tiempo de espera')
  })

  it('clasifica credenciales inválidas en la comprobación de salud', async () => {
    const service = makeService([
      () =>
        textResponse(401, JSON.stringify({ message: 'Invalid API key' })),
    ])

    const result = await service.checkConnection()
    expect(result.status).toBe('invalid_credentials')
    expect(result.httpStatus).toBe(401)
    expect(result.message).not.toContain(CONFIG.publishableKey)
  })

  it('enumera las tablas expuestas cuando OpenAPI responde 200', async () => {
    const service = makeService([
      () => jsonResponse(200, { version: '2.0.0' }),
      () =>
        jsonResponse(200, {
          paths: {
            '/menus': { get: {} },
            '/weekly_menus': { get: {} },
            '/rpc/some_fn': { post: {} },
          },
        }),
    ])

    const result = await service.checkConnection()
    expect(result.status).toBe('connected')
    // Los endpoints /rpc/ no se cuentan como tablas.
    expect(result.tableCount).toBe(2)
    expect(result.httpStatus).toBe(200)
    expect(result.message).toContain('2 tabla(s)')
  })

  it('reporta no_tables (no es fallo) cuando OpenAPI responde sin tablas', async () => {
    const service = makeService([
      () => jsonResponse(200, { version: '2.0.0' }),
      () => jsonResponse(200, { paths: { '/rpc/ping': { post: {} } } }),
    ])

    const result = await service.checkConnection()
    expect(result.status).toBe('no_tables')
    expect(result.tableCount).toBe(0)
  })

  it('usa la sonda PostgREST cuando OpenAPI exige clave secreta', async () => {
    const service = makeService([
      () => jsonResponse(200, { version: '2.0.0' }),
      () =>
        textResponse(
          401,
          JSON.stringify({
            message: 'Secret API key required',
            hint: 'Only secret API keys can be used for this endpoint.',
          }),
        ),
      () =>
        textResponse(
          404,
          JSON.stringify({
            code: 'PGRST205',
            message: "Could not find the table 'public.__lunch_connection_probe__' in the schema cache",
          }),
        ),
    ])

    const result = await service.checkConnection()
    expect(result.status).toBe('connected')
    expect(result.tableCount).toBeNull()
    expect(result.message).toContain('clave secreta')
    expect(result.message).toContain('desconocido')
  })

  it('usa la sonda PostgREST cuando la raíz OpenAPI no está disponible', async () => {
    const service = makeService([
      () => jsonResponse(200, { version: '2.0.0' }),
      () => textResponse(404, 'Not Found'),
      () =>
        textResponse(
          404,
          JSON.stringify({ code: 'PGRST205', message: 'table not found' }),
        ),
    ])

    const result = await service.checkConnection()
    expect(result.status).toBe('connected')
    expect(result.message).toContain('descripción OpenAPI no está disponible')
  })

  it('clasifica permisos insuficientes en la sonda (403)', async () => {
    const service = makeService([
      () => jsonResponse(200, { version: '2.0.0' }),
      () => textResponse(401, JSON.stringify({ message: 'Secret API key required' })),
      () => textResponse(403, JSON.stringify({ message: 'RLS enabled' })),
    ])

    const result = await service.checkConnection()
    expect(result.status).toBe('insufficient_permissions')
    expect(result.httpStatus).toBe(403)
  })

  it('reporta servicio no disponible ante un 500 en la salud', async () => {
    const service = makeService([
      () => textResponse(500, 'Internal error'),
      () => textResponse(500, 'Internal error'),
      () => textResponse(500, 'Internal error'),
    ])

    const result = await service.checkConnection()
    expect(result.status).toBe('service_unavailable')
    expect(result.httpStatus).toBe(500)
  })

  it('no incluye la clave pública ni la URL en ningún mensaje', async () => {
    const service = makeService([
      () => textResponse(401, JSON.stringify({ message: 'Invalid API key' })),
    ])

    const result = await service.checkConnection()
    expect(result.message).not.toContain(CONFIG.publishableKey)
    expect(result.message).not.toContain(CONFIG.url)
  })

  it('aplica timeout en las peticiones', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(
              Object.assign(new Error('aborted'), { name: 'TimeoutError' }),
            )
          })
        }),
    ) as unknown as (input: string, init?: RequestInit) => Promise<Response>

    const service = new SupabaseConnectionService({
      fetchImpl,
      loadConfig: () => CONFIG,
      timeoutMs: 50,
    })

    const result = await service.checkConnection()
    expect(result.status).toBe('network_error')
    expect(result.message).toContain('tiempo de espera')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
