import type { Money } from '../value-objects/money'

export interface Student {
  id: string
  parentId: string
  name: string
  grade: string
  balance: Money
  qrCode: string
}
