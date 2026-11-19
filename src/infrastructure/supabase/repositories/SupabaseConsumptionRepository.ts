import type { Consumption } from '../../../domain/entities/consumption'
import type { Money } from '../../../domain/value-objects/money'
import type { ConsumptionRepository } from '../../../application/ports/ConsumptionRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'

/**
 * Mapea fila de BD a Consumption de dominio.
 */
function mapRowToConsumption(row: {
  id: string
  student_id: string
  meals: number
  total_cents: number
  source: 'qr' | 'manual'
  created_at: string
}): Consumption {
  return {
    id: row.id,
    studentId: row.student_id,
    meals: row.meals,
    total: fromCents(row.total_cents),
    source: row.source,
    createdAt: row.created_at,
  }
}

/**
 * Repositorio Supabase para Consumptions.
 * Respeta RLS por school_id (F.1).
 */
export class SupabaseConsumptionRepository
  extends SupabaseRepositoryBase
  implements ConsumptionRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  async record(input: {
    studentId: string
    meals: number
    total: Money
    source: 'qr' | 'manual'
  }): Promise<Consumption> {
    const { data, error } = await this.client
      .from('consumptions')
      .insert({
        student_id: input.studentId,
        meals: input.meals,
        total_cents: input.total.cents,
        source: input.source,
      } as any)
      .select()
      .single()

    if (error) this.handleError(error, 'registrar consumo')
    return mapRowToConsumption(data)
  }

  async listByStudent(studentId: string): Promise<Consumption[]> {
    const { data, error } = await this.client
      .from('consumptions')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) this.handleError(error, 'listar consumos por estudiante')
    return (data ?? []).map(mapRowToConsumption)
  }
}