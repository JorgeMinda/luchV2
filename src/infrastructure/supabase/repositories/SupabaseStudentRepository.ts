import type { Student, NewStudent } from '../../../domain/entities/student'
import type { Money } from '../../../domain/value-objects/money'
import type { StudentRepository } from '../../../application/ports/StudentRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'
import type { StudentsRow, StudentsInsert, StudentsUpdate } from '../database.types'

/**
 * Mapea fila de BD a Student de dominio.
 */
function mapRowToStudent(row: StudentsRow): Student {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    grade: row.grade,
    balance: fromCents(row.balance_cents),
    qrCode: row.qr_code,
    isActive: row.is_active,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: undefined,
  }
}

/**
 * Repositorio Supabase para Students.
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
 * Borrado lógico (is_active, deleted_at, deleted_by).
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
      .eq('is_active', true)
      .maybeSingle()

    if (error) this.handleError(error, 'buscar estudiante por ID')
    return data ? mapRowToStudent(data) : null
  }

  async updateBalance(id: string, balance: Money): Promise<Student> {
    const update: StudentsUpdate = {
      balance_cents: balance.cents,
    }

    await this.updateRows<StudentsUpdate>('students', update, { id })

    const { data, error } = await this.client
      .from('students')
      .select('*')
      .eq('id', id)
      .single() as { data: StudentsRow | null; error: Error | null }

    if (error) this.handleError(error, 'buscar estudiante tras actualizar balance')
    if (!data) throw new Error('Estudiante no encontrado tras actualización')
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

  async findByParentId(parentId: string): Promise<Student[]> {
    const { data, error } = await this.client
      .from('students')
      .select('*')
      .eq('parent_id', parentId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) this.handleError(error, 'buscar estudiantes por padre')
    return (data ?? []).map(mapRowToStudent)
  }

  async findByQrCode(qrCode: string): Promise<Student | null> {
    const { data, error } = await this.client
      .from('students')
      .select('*')
      .eq('qr_code', qrCode)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') return null
      this.handleError(error, 'buscar estudiante por QR')
    }
    return data ? mapRowToStudent(data) : null
  }

  async save(student: NewStudent): Promise<Student> {
    const insert: StudentsInsert = {
      parent_id: student.parentId,
      name: student.name,
      grade: student.grade,
      balance_cents: student.balance.cents,
      qr_code: student.qrCode,
      is_active: true,
    }

    const data = await this.insertOne<StudentsRow, StudentsInsert>('students', insert)
    return mapRowToStudent(data)
  }

  async delete(id: string, deletedBy: string): Promise<void> {
    const update: StudentsUpdate = {
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy,
    }

    await this.updateRows<StudentsUpdate>('students', update, { id })
  }
}