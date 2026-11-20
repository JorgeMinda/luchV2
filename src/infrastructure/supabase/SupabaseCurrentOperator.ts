import type { CurrentOperatorPort } from '../../application/ports/current-operator-port'
import { getSupabaseClient } from './supabase-client'
import type { UsersRow } from './database.types'

/**
 * Implementación de CurrentOperatorPort usando Supabase Auth.
 * Obtiene el operador actual (usuario autenticado) vía `supabase.auth.getUser()`.
 * El rol se resuelve consultando la tabla `public.users` sincronizada via trigger.
 */
export class SupabaseCurrentOperator implements CurrentOperatorPort {
  private client = getSupabaseClient()

  /**
   * Obtiene el operador actual autenticado.
   * Retorna null si no hay sesión activa.
   */
  async getCurrentOperator(): Promise<{ id: string; role: string } | null> {
    const { data: { user }, error } = await this.client.auth.getUser()

    if (error || !user) {
      return null
    }

    // Obtener rol desde public.users (sincronizado via trigger handle_new_user)
    const { data: profile, error: profileError } = await this.client
      .from('users')
      .select('role')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()

    if (profileError || !profile) {
      // Fallback: si no hay perfil, asumir rol 'parent' (por defecto en trigger)
      return { id: user.id, role: 'parent' }
    }

    // Type assertion since the select('role') narrows the type
    const typedProfile = profile as Pick<UsersRow, 'role'>
    return { id: user.id, role: typedProfile.role }
  }

  /**
   * Verifica si hay un operador autenticado actualmente.
   */
  async isAuthenticated(): Promise<boolean> {
    const operator = await this.getCurrentOperator()
    return operator !== null
  }

  /**
   * Obtiene solo el ID del usuario actual (útil para auditoría).
   */
  async getCurrentUserId(): Promise<string | null> {
    const operator = await this.getCurrentOperator()
    return operator?.id ?? null
  }

  /**
   * Obtiene solo el rol del usuario actual.
   */
  async getCurrentUserRole(): Promise<string | null> {
    const operator = await this.getCurrentOperator()
    return operator?.role ?? null
  }
}