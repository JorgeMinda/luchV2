/**
 * Comprobación de conexión REAL (solo lectura) contra Supabase.
 *
 * Uso: `npm run check:supabase`
 *
 * - Carga las variables VITE_* desde .env.local con la API de Vite.
 * - Ejecuta el mismo caso de uso y servicio usados por la aplicación.
 * - Solo hace peticiones GET de solo lectura (salud, descripción OpenAPI
 *   y sonda a PostgREST): no crea tablas, no ejecuta migraciones ni
 *   escribe/elimina datos.
 * - Nunca imprime la clave pública ni la URL del proyecto.
 *
 * Código de salida: 0 si el servicio responde (connected/no_tables),
 * 1 si hay fallo clasificado.
 */
import { loadEnv } from 'vite'
import {
  CheckSupabaseConnectionUseCase,
  isConnectionFailure,
} from '../src/application/use-cases/CheckSupabaseConnectionUseCase'
import { SupabaseConnectionService } from '../src/infrastructure/supabase/SupabaseConnectionService'
import { resolveSupabaseConfig } from '../src/infrastructure/supabase/supabase-config'

const env = loadEnv('development', process.cwd(), 'VITE_')

let config
try {
  config = resolveSupabaseConfig(env)
} catch (error) {
  console.error('Configuración inválida:')
  console.error(`  - ${(error as Error).message}`)
  process.exit(1)
}

const service = new SupabaseConnectionService({ loadConfig: () => config })
const result = await new CheckSupabaseConnectionUseCase(service).execute()

console.log('Comprobación de conexión Supabase (solo lectura)')
console.log(`  Estado:     ${result.status}`)
console.log(`  Detalle:    ${result.message}`)
console.log(`  HTTP:       ${result.httpStatus ?? 'sin respuesta'}`)
console.log(`  Tablas:     ${result.tableCount ?? 'no enumerable'}`)
console.log(`  Comprobado: ${result.checkedAt}`)

process.exitCode = isConnectionFailure(result) ? 1 : 0
