import type { Transaction } from '../../domain/entities'
import type { Money } from '../../domain/value-objects/money'
import { fromDollars } from '../../domain/value-objects/money'
import type { PaymentRepository, PaymentStatus } from '../../application/ports/PaymentRepository'
import { readStoredCollection, writeStoredCollection } from '../storage/localStorage'

const STORAGE_KEY = 'lunch-payments'

/** Convierte montos heredados (número en dólares) a Money. */
function normalizeTransaction(transaction: Transaction): Transaction {
  const amount: unknown = transaction.amount
  if (typeof amount === 'number') {
    return { ...transaction, amount: fromDollars(amount) }
  }
  return transaction
}

function readPayments(): Transaction[] {
  return (
    readStoredCollection<Transaction>(STORAGE_KEY, isTransaction) ?? []
  ).map(normalizeTransaction)
}

export class LocalStoragePaymentRepository implements PaymentRepository {
  async findById(id: string): Promise<Transaction | null> {
    const payments = readPayments()
    return payments.find((p: Transaction) => p.id === id) ?? null
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    approvedAt: string | null,
  ): Promise<Transaction> {
    const payments = readPayments()
    const index = payments.findIndex((p: Transaction) => p.id === id)
    if (index === -1) {
      throw new Error(`Pago ${id} no encontrado`)
    }
    const updated = { ...payments[index], status, approvedAt }
    payments[index] = updated
    writeStoredCollection(STORAGE_KEY, payments)
    return updated
  }

  async create(input: {
    studentId: string
    parentId: string
    amount: Money
    receiptUrl: string
  }): Promise<Transaction> {
    const payments = readPayments()
    const payment: Transaction = {
      id: `payment-${crypto.randomUUID()}`,
      studentId: input.studentId,
      parentId: input.parentId,
      amount: input.amount,
      receiptUrl: input.receiptUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
      approvedAt: null,
    }
    payments.push(payment)
    writeStoredCollection(STORAGE_KEY, payments)
    return payment
  }
}

function isTransaction(value: unknown): value is Transaction {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Transaction).id === 'string' &&
    typeof (value as Transaction).status === 'string'
  )
}
