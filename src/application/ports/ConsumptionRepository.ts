import type { Consumption } from '../../domain/entities/consumption'
import type { Money } from '../../domain/value-objects/money'

export interface ConsumptionRepository {
  record(input: {
    studentId: string
    meals: number
    total: Money
    source: 'qr' | 'manual'
  }): Promise<Consumption>
  listByStudent(studentId: string): Promise<Consumption[]>
}
