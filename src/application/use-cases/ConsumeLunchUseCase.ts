import type { Money } from '../../domain/value-objects/money'
import { multiplyMoney } from '../../domain/value-objects/money'
import {
  InsufficientBalanceError,
  NotFoundError,
} from '../../domain/errors'
import type { StudentRepository } from '../ports/StudentRepository'
import type { ConsumptionRepository } from '../ports/ConsumptionRepository'

export interface ConsumeLunchInput {
  studentId: string
  meals: number
  unitPrice: Money
  source: 'qr' | 'manual'
}

export interface ConsumeLunchOutput {
  studentId: string
  meals: number
  total: Money
  newBalance: Money
}

export class ConsumeLunchUseCase {
  private readonly studentRepository: StudentRepository
  private readonly consumptionRepository: ConsumptionRepository

  constructor(
    studentRepository: StudentRepository,
    consumptionRepository: ConsumptionRepository,
  ) {
    this.studentRepository = studentRepository
    this.consumptionRepository = consumptionRepository
  }

  async execute(input: ConsumeLunchInput): Promise<ConsumeLunchOutput> {
    const student = await this.studentRepository.findById(input.studentId)
    if (!student) {
      throw new NotFoundError('Estudiante')
    }

    const total = multiplyMoney(input.unitPrice, input.meals)

    if (student.balance.cents < total.cents) {
      throw new InsufficientBalanceError()
    }

    const newBalance = {
      __brand: 'Money' as const,
      cents: student.balance.cents - total.cents,
    }

    const updatedStudent = await this.studentRepository.updateBalance(
      student.id,
      newBalance,
    )

    await this.consumptionRepository.record({
      studentId: student.id,
      meals: input.meals,
      total,
      source: input.source,
    })

    return {
      studentId: updatedStudent.id,
      meals: input.meals,
      total,
      newBalance,
    }
  }
}
