import type { Money } from '../value-objects/money'

export type TransactionStatus = 'pending' | 'approved' | 'rejected'

export interface Transaction {
  id: string
  studentId: string
  parentId: string
  amount: Money
  receiptUrl: string
  status: TransactionStatus
  createdAt: string
  approvedAt: string | null
}
