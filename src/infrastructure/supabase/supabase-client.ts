import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig, type SupabaseConfig } from './supabase-config'
import type { Database } from './database.types'

let cachedClient: SupabaseClient<Database> | null = null

/**
 * Crea el cliente Supabase a partir de una configuración ya validada.
 * No realiza peticiones de red al crearse.
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.publishableKey)
}

/**
 * Cliente centralizado y perezoso: solo se crea (y solo se validan las
 * variables de entorno) en el primer uso, de modo que importar este
 * módulo nunca falla si falta la configuración.
 *
 * Las capas de aplicación consumen este cliente a través de puertos;
 * ningún componente React consulta Supabase directamente.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (cachedClient === null) {
    cachedClient = createSupabaseClient(getSupabaseConfig())
  }
  return cachedClient
}
