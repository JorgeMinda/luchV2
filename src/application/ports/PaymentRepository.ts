import type { Transaction } from '../../domain/entities'
import type { Money } from '../../domain/value-objects/money'

export type PaymentStatus = 'pending' | 'approved' | 'rejected'

export interface PaymentRepository {
  findById(id: string): Promise<Transaction | null>
  updateStatus(
    id: string,
    status: PaymentStatus,
    approvedAt: string | null,
  ): Promise<Transaction>
  create(input: {
    studentId: string
    parentId: string
    amount: Money
    receiptUrl: string
  }): Promise<Transaction>
}
