import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { getSupabaseClient } from '../supabase-client'

/**
 * Cliente Supabase tipado para la base de datos Lunch v2.
 * Usa los tipos generados en database.types.ts.
 */
export type TypedSupabaseClient = SupabaseClient<Database>

/**
 * Obtiene el cliente Supabase tipado.
 * Reutiliza el cliente singleton de supabase-client.ts.
 */
export function getTypedSupabaseClient(): TypedSupabaseClient {
  return getSupabaseClient() as TypedSupabaseClient
}

/**
 * Clase base para repositorios Supabase.
 * Proporciona utilidades comunes y manejo de errores.
 */
export abstract class SupabaseRepositoryBase {
  protected client: TypedSupabaseClient

  constructor(client?: TypedSupabaseClient) {
    this.client = client ?? getTypedSupabaseClient()
  }

  /**
   * Obtiene el school_id del contexto actual (desde RLS o header).
   * En el cliente, el RLS filtra automáticamente por school_id.
   * Este método es útil para validaciones explícitas.
   */
  protected async getCurrentSchoolId(): Promise<string | null> {
    const { data, error } = await this.client.rpc('current_user_school_id')
    if (error) {
      console.warn('No se pudo obtener school_id del usuario:', error.message)
      return null
    }
    return data
  }

  /**
   * Maneja errores de Supabase de forma consistente.
   */
  protected handleError(error: Error, operation: string): never {
    const message = `Error en ${operation}: ${error.message}`
    console.error(message, error)
    throw new Error(message)
  }

  /**
   * Verifica que una operación de escritura tuvo éxito.
   */
  protected assertWriteResult<T>(
    result: { data: T | null; error: Error | null },
    operation: string,
  ): T {
    if (result.error) {
      this.handleError(result.error, operation)
    }
    if (result.data === null) {
      throw new Error(`${operation}: no se retornaron datos`)
    }
    return result.data
  }
}