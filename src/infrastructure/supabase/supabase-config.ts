/**
 * Configuración centralizada de Supabase (capa Infrastructure).
 *
 * - Única fuente de verdad de las variables `VITE_SUPABASE_URL` y
 *   `VITE_SUPABASE_PUBLISHABLE_KEY` (ya declaradas en `.env.local`).
 * - Nunca incluye los valores en los mensajes de error: solo se
 *   mencionan los nombres de las variables.
 */

export interface SupabaseConfig {
  /** URL base del proyecto (sin barra final). */
  url: string
  /** Clave publicable (anon/publishable) del proyecto. */
  publishableKey: string
}

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupabaseConfigError'
  }
}

type EnvLike = Record<string, unknown>

/** Valores de ejemplo típicos: se rechazan para forzar la clave real. */
const PLACEHOLDER_KEY = /^(your|xxx+|todo|placeholder|change[-_ ]?me)/i

function readRequired(env: EnvLike, name: string): string {
  const raw = env[name]
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new SupabaseConfigError(
      `La variable ${name} no está definida en .env.local (o está vacía). ` +
        'Añádela con su valor; los valores nunca se muestran en mensajes ni en la UI.',
    )
  }
  return raw.trim()
}

/** Valida el entorno y devuelve la configuración lista para usar. */
export function resolveSupabaseConfig(env: EnvLike): SupabaseConfig {
  const rawUrl = readRequired(env, 'VITE_SUPABASE_URL')
  const publishableKey = readRequired(env, 'VITE_SUPABASE_PUBLISHABLE_KEY')

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new SupabaseConfigError(
      'VITE_SUPABASE_URL no es una URL válida (se espera algo como https://<proyecto>.supabase.co).',
    )
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SupabaseConfigError('VITE_SUPABASE_URL debe empezar por https:// o http://.')
  }

  // Un host válido contiene al menos un punto (p. ej. proyecto.supabase.co)
  // o es un alias local. Detecta valores mal pegados como
  // "https:https://proyecto.supabase.co", que el parser de URL acepta
  // interpretando el host como "https" y provocando un ENOTFOUND falso.
  const isLocalHost =
    parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost')
  if (!isLocalHost && !parsed.hostname.includes('.')) {
    throw new SupabaseConfigError(
      'VITE_SUPABASE_URL no contiene un nombre de host válido (revisa que la URL ' +
        'no tenga el esquema duplicado, por ejemplo "https:https://...").',
    )
  }

  if (PLACEHOLDER_KEY.test(publishableKey)) {
    throw new SupabaseConfigError(
      'VITE_SUPABASE_PUBLISHABLE_KEY contiene un valor de ejemplo; sustitúyelo por la clave real del proyecto.',
    )
  }

  return { url: rawUrl.replace(/\/+$/, ''), publishableKey }
}

/** Lee la configuración desde `import.meta.env` (inyectada por Vite). */
export function getSupabaseConfig(): SupabaseConfig {
  return resolveSupabaseConfig(import.meta.env)
}
