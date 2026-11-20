import type { Money } from '../value-objects/money'

export type ConsumptionSource = 'qr' | 'manual'

export interface Consumption {
  id: string
  studentId: string
  meals: number
  total: Money
  source: ConsumptionSource
  createdAt: string
}