import type {
  SupabaseConnectionPort,
  SupabaseConnectionResult,
} from '../ports/SupabaseConnectionPort'

/**
 * `connected` y `no_tables` indican que el servicio Supabase responde:
 * la ausencia de tablas no es un fallo de conexión.
 */
export function isConnectionFailure(result: SupabaseConnectionResult): boolean {
  return result.status !== 'connected' && result.status !== 'no_tables'
}

/**
 * Comprobación de conexión solo lectura: delega en el puerto de
 * infraestructura y devuelve el estado clasificado. No crea tablas,
 * no ejecuta migraciones ni escribe datos.
 */
export class CheckSupabaseConnectionUseCase {
  private readonly port: SupabaseConnectionPort

  constructor(port: SupabaseConnectionPort) {
    this.port = port
  }

  async execute(): Promise<SupabaseConnectionResult> {
    return this.port.checkConnection()
  }
}
