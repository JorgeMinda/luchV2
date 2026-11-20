import type { Consumption } from '../../../domain/entities/consumption'
import type { Money } from '../../../domain/value-objects/money'
import type { ConsumptionRepository } from '../../../application/ports/ConsumptionRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'
import type { ConsumptionsRow, ConsumptionsInsert } from '../database.types'

/**
 * Mapea fila de BD a Consumption de dominio.
 */
function mapRowToConsumption(row: ConsumptionsRow): Consumption {
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
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
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
    const insert: ConsumptionsInsert = {
      student_id: input.studentId,
      meals: input.meals,
      total_cents: input.total.cents,
      source: input.source,
    }

    const data = await this.insertOne<ConsumptionsRow, ConsumptionsInsert>('consumptions', insert)
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

  async listByDateRange(startDate: string, endDate: string): Promise<Consumption[]> {
    const { data, error } = await this.client
      .from('consumptions')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (error) this.handleError(error, 'listar consumos por rango de fechas')
    return (data ?? []).map(mapRowToConsumption)
  }

  async listAll(): Promise<Consumption[]> {
    const { data, error } = await this.client
      .from('consumptions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) this.handleError(error, 'listar todos los consumos')
    return (data ?? []).map(mapRowToConsumption)
  }
}