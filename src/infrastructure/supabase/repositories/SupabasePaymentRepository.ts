import type { Transaction } from '../../../domain/entities/transaction'
import type { Money } from '../../../domain/value-objects/money'
import type { PaymentRepository, PaymentStatus } from '../../../application/ports/PaymentRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'
import type { TransactionsRow, TransactionsInsert, TransactionsUpdate } from '../database.types'

/**
 * Mapea fila de BD a Transaction de dominio.
 */
function mapRowToTransaction(row: TransactionsRow): Transaction {
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
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
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
    const update: TransactionsUpdate = {
      status,
      approved_at: approvedAt,
    }

    await this.updateRows<TransactionsUpdate>('transactions', update, { id })

    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single() as { data: TransactionsRow | null; error: Error | null }

    if (error) this.handleError(error, 'buscar transacción tras actualizar')
    if (!data) throw new Error('Transacción no encontrada tras actualización')
    return mapRowToTransaction(data)
  }

  async create(input: {
    studentId: string
    parentId: string
    amount: Money
    receiptUrl: string
  }): Promise<Transaction> {
    const insert: TransactionsInsert = {
      student_id: input.studentId,
      parent_id: input.parentId,
      amount_cents: input.amount.cents,
      receipt_url: input.receiptUrl,
      status: 'pending',
    }

    const data = await this.insertOne<TransactionsRow, TransactionsInsert>('transactions', insert)
    return mapRowToTransaction(data)
  }

  async listByParent(parentId: string): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false })

    if (error) this.handleError(error, 'listar transacciones por padre')
    return (data ?? []).map(mapRowToTransaction)
  }

  async listByStudent(studentId: string): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) this.handleError(error, 'listar transacciones por estudiante')
    return (data ?? []).map(mapRowToTransaction)
  }

  async listAll(): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) this.handleError(error, 'listar todas las transacciones')
    return (data ?? []).map(mapRowToTransaction)
  }
}