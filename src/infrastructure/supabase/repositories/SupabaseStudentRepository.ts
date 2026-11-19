import type { Student } from '../../../domain/entities/student'
import type { Money } from '../../../domain/value-objects/money'
import type { StudentRepository } from '../../../application/ports/StudentRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'

/**
 * Mapea fila de BD a Student de dominio.
 */
function mapRowToStudent(row: {
  id: string
  school_id: string
  parent_id: string
  name: string
  grade: string
  balance_cents: number
  qr_code: string
  is_active: boolean
}): Student {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    grade: row.grade,
    balance: fromCents(row.balance_cents),
    qrCode: row.qr_code,
  }
}

/**
 * Repositorio Supabase para Students.
 * Respeta RLS por school_id (F.1).
 */
export class SupabaseStudentRepository
  extends SupabaseRepositoryBase
  implements StudentRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  async findById(id: string): Promise<Student | null> {
    const { data, error } = await this.client
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) this.handleError(error, 'buscar estudiante por ID')
    return data ? mapRowToStudent(data) : null
  }

  async updateBalance(id: string, balance: Money): Promise<Student> {
    const { data, error } = await this.client
      .from('students')
      .update({ balance_cents: balance.cents } as never)
      .eq('id', id)
      .select()
      .single()

    if (error) this.handleError(error, 'actualizar balance de estudiante')
    return mapRowToStudent(data)
  }

  async list(): Promise<Student[]> {
    const { data, error } = await this.client
      .from('students')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) this.handleError(error, 'listar estudiantes')
    return (data ?? []).map(mapRowToStudent)
  }
}