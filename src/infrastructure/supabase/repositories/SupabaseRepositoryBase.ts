import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { getSupabaseClient } from '../supabase-client'
import type { UsersRow } from '../database.types'

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
 * Tipo para resultados de queries Supabase.
 */
export type SupabaseResult<T> = { data: T | null; error: Error | null }
export type SupabaseSingleResult<T> = { data: T | null; error: Error | null }
export type SupabaseErrorResult = { error: Error | null }

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

  /**
   * Obtiene el usuario actual autenticado.
   */
  protected async getCurrentUser(): Promise<{ id: string; role: string } | null> {
    const { data: { user }, error } = await this.client.auth.getUser()
    if (error || !user) return null

    const { data: profile } = await this.client
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { id: user.id, role: 'parent' }
    }

    const typedProfile = profile as Pick<UsersRow, 'role'>
    return { id: user.id, role: typedProfile.role }
  }

  /**
   * Helper para upsert con array.
   */
  protected async upsertMany<TRow, TInsert>(
    table: string,
    rows: TInsert[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): Promise<TRow[]> {
    const { data, error } = await this.client
      .from(table)
      .upsert(rows as never[], options)
      .select() as SupabaseResult<TRow[]>

    if (error) this.handleError(error, `upsert en ${table}`)
    return data ?? []
  }

  /**
   * Helper para upsert single.
   */
  protected async upsertOne<TRow, TInsert>(
    table: string,
    row: TInsert,
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): Promise<TRow> {
    const { data, error } = await this.client
      .from(table)
      .upsert([row] as never[], options)
      .select()
      .single() as SupabaseSingleResult<TRow>

    if (error) this.handleError(error, `upsert en ${table}`)
    if (!data) throw new Error(`No se retornaron datos en upsert ${table}`)
    return data
  }

  /**
   * Helper para update.
   */
  protected async updateRows<TUpdate>(
    table: string,
    update: TUpdate,
    filters: Record<string, unknown>,
  ): Promise<void> {
    let query = this.client.from(table).update(update as never)
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value as never)
    }
    const { error } = await query as SupabaseErrorResult
    if (error) this.handleError(error, `update en ${table}`)
  }

  /**
   * Helper para insert.
   */
  protected async insertRows<TRow, TInsert>(
    table: string,
    rows: TInsert[],
  ): Promise<TRow[]> {
    const { data, error } = await this.client
      .from(table)
      .insert(rows as never[])
      .select() as SupabaseResult<TRow[]>

    if (error) this.handleError(error, `insert en ${table}`)
    return data ?? []
  }

  /**
   * Helper para insert single.
   */
  protected async insertOne<TRow, TInsert>(
    table: string,
    row: TInsert,
  ): Promise<TRow> {
    const { data, error } = await this.client
      .from(table)
      .insert([row] as never[])
      .select()
      .single() as SupabaseSingleResult<TRow>

    if (error) this.handleError(error, `insert en ${table}`)
    if (!data) throw new Error(`No se retornaron datos en insert ${table}`)
    return data
  }
}