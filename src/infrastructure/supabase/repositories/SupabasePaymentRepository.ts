import type { Transaction } from '../../../domain/entities/transaction'
import type { Money } from '../../../domain/value-objects/money'
import type { PaymentRepository, PaymentStatus } from '../../../application/ports/PaymentRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'

/**
 * Mapea fila de BD a Transaction de dominio.
 */
function mapRowToTransaction(row: {
  id: string
  student_id: string
  parent_id: string
  amount_cents: number
  receipt_url: string
  status: PaymentStatus
  created_at: string
  approved_at: string | null
}): Transaction {
  return {
    id: row.id,
    studentId: row.student_id,
    parentId: row.parent_id,
    amount: fromCents(row.amount_cents),
    receiptUrl: row.receipt_url,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
  }
}

/**
 * Repositorio Supabase para Transactions (Payments).
 * Respeta RLS por school_id (F.1).
 */
export class SupabasePaymentRepository
  extends SupabaseRepositoryBase
  implements PaymentRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  async findById(id: string): Promise<Transaction | null> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) this.handleError(error, 'buscar transacción por ID')
    return data ? mapRowToTransaction(data) : null
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    approvedAt: string | null,
  ): Promise<Transaction> {
    const { data, error } = await this.client
      .from('transactions')
      .update({
        status,
        approved_at: approvedAt,
      } as never)
      .eq('id', id)
      .select()
      .single()

    if (error) this.handleError(error, 'actualizar estado de transacción')
    return mapRowToTransaction(data)
  }

  async create(input: {
    studentId: string
    parentId: string
    amount: Money
    receiptUrl: string
  }): Promise<Transaction> {
    const { data, error } = await this.client
      .from('transactions')
      .insert({
        student_id: input.studentId,
        parent_id: input.parentId,
        amount_cents: input.amount.cents,
        receipt_url: input.receiptUrl,
        status: 'pending',
      } as any)
      .select()
      .single()

    if (error) this.handleError(error, 'crear transacción')
    return mapRowToTransaction(data)
  }
}