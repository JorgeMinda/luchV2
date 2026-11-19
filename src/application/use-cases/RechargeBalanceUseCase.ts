import type { Money } from '../../domain/value-objects/money'
import type { PaymentRepository } from '../ports/PaymentRepository'

export interface RechargeBalanceInput {
  studentId: string
  parentId: string
  amount: Money
  receiptUrl: string
}

export interface RechargeBalanceOutput {
  paymentId: string
  status: 'pending'
  studentId: string
  amount: Money
}

export class RechargeBalanceUseCase {
  private readonly paymentRepository: PaymentRepository

  constructor(paymentRepository: PaymentRepository) {
    this.paymentRepository = paymentRepository
  }

  async execute(input: RechargeBalanceInput): Promise<RechargeBalanceOutput> {
    const payment = await this.paymentRepository.create({
      studentId: input.studentId,
      parentId: input.parentId,
      amount: input.amount,
      receiptUrl: input.receiptUrl,
    })

    return {
      paymentId: payment.id,
      status: 'pending',
      studentId: payment.studentId,
      amount: payment.amount,
    }
  }
}
