/**
 * Estado clasificado de una comprobación de conexión (solo lectura)
 * contra el servicio Supabase.
 *
 * - `connected` y `no_tables` NO son fallos: el servicio responde.
 * - El resto distingue el tipo de fallo para poder informarlo bien.
 */
export type SupabaseConnectionStatus =
  /** Servicio disponible: credenciales válidas y API accesible. */
  | 'connected'
  /** Servicio disponible pero sin tablas publicadas (no es un fallo). */
  | 'no_tables'
  /** El servicio rechazó la clave publicable (HTTP 401). */
  | 'invalid_credentials'
  /** La clave fue aceptada pero no puede leer el esquema (HTTP 403). */
  | 'insufficient_permissions'
  /** Sin respuesta: fallo de red, DNS, timeout o servicio caído. */
  | 'network_error'
  /** El endpoint respondió con error (404/5xx) o respuesta inesperada. */
  | 'service_unavailable'
  /** Variables de entorno ausentes/inválidas o URL que no es Supabase. */
  | 'misconfigured'

export interface SupabaseConnectionResult {
  status: SupabaseConnectionStatus
  /** Apto para logs/UI: nunca incluye la clave pública ni la URL. */
  message: string
  /**
   * Tablas expuestas por la API REST.
   * `null` = no se pudo enumerar el esquema (p. ej. la API OpenAPI
   * requiere clave secreta en este proyecto); no implica ausencia de tablas.
   * `0` solo cuando la enumeración sí se completó y no había tablas.
   */
  tableCount: number | null
  /** Código HTTP de la respuesta determinante, o null si no hubo respuesta. */
  httpStatus: number | null
  /** Momento de la comprobación en ISO-8601. */
  checkedAt: string
}

export interface SupabaseConnectionPort {
  checkConnection(): Promise<SupabaseConnectionResult>
}
