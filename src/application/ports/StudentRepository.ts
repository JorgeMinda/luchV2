import type { Student } from '../../domain/entities'
import type { Money } from '../../domain/value-objects/money'

export interface StudentRepository {
  findById(id: string): Promise<Student | null>
  updateBalance(id: string, balance: Money): Promise<Student>
  list(): Promise<Student[]>
}
