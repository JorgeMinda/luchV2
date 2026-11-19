/**
 * Tipo JSON genérico para compatibilidad con Supabase/PostgreSQL.
 * Permite cualquier valor JSON válido.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]