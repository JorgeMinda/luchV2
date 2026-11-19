import type { Money } from '../../domain/value-objects/money'
import { addMoney } from '../../domain/value-objects/money'
import {
  NotFoundError,
} from '../../domain/errors'
import type { StudentRepository } from '../ports/StudentRepository'
import type { PaymentRepository, PaymentStatus } from '../ports/PaymentRepository'

export interface ApprovePaymentInput {
  paymentId: string
}

export interface ApprovePaymentOutput {
  paymentId: string
  status: PaymentStatus
  studentId: string
  amount: Money
  newBalance: Money
}

export class ApprovePaymentUseCase {
  private readonly studentRepository: StudentRepository
  private readonly paymentRepository: PaymentRepository

  constructor(
    studentRepository: StudentRepository,
    paymentRepository: PaymentRepository,
  ) {
    this.studentRepository = studentRepository
    this.paymentRepository = paymentRepository
  }

  async execute(input: ApprovePaymentInput): Promise<ApprovePaymentOutput> {
    const payment = await this.paymentRepository.findById(input.paymentId)
    if (!payment) {
      throw new NotFoundError('Pago')
    }
    if (payment.status !== 'pending') {
      throw new Error(`El pago ya está ${payment.status}`)
    }

    const student = await this.studentRepository.findById(payment.studentId)
    if (!student) {
      throw new NotFoundError('Estudiante')
    }

    const newBalance = addMoney(student.balance, payment.amount)

    const updatedStudent = await this.studentRepository.updateBalance(
      student.id,
      newBalance,
    )

    const updatedPayment = await this.paymentRepository.updateStatus(
      payment.id,
      'approved',
      new Date().toISOString(),
    )

    return {
      paymentId: updatedPayment.id,
      status: updatedPayment.status,
      studentId: updatedStudent.id,
      amount: payment.amount,
      newBalance: updatedStudent.balance,
    }
  }
}
