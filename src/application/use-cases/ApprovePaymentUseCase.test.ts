import { describe, expect, it, vi } from 'vitest'
import { ApprovePaymentUseCase } from './ApprovePaymentUseCase'
import { fromCents, fromDollars } from '../../domain/value-objects/money'
import type { Student, Transaction } from '../../domain/entities'
import type { PaymentStatus } from '../ports/PaymentRepository'

function makeStudent(balance: number) {
  return {
    id: 'student-1',
    parentId: 'parent-1',
    name: 'Sofía Martínez',
    grade: '5° B',
    balance: fromDollars(balance),
    qrCode: 'QR-001',
    isActive: true,
    deletedAt: undefined,
    deletedBy: undefined,
  }
}

function makePayment(
  status: PaymentStatus = 'pending',
  amount: number = 15.0,
): Transaction {
  return {
    id: 'payment-1',
    studentId: 'student-1',
    parentId: 'parent-1',
    amount: fromDollars(amount),
    receiptUrl: 'https://example.com/receipt',
    status,
    createdAt: '2026-01-01T00:00:00Z',
    approvedAt: null,
  }
}

function makeStudentRepository(
  student: Student,
  newBalanceCents?: number,
) {
  const updatedBalance = newBalanceCents ?? student.balance.cents
  const updatedStudent = { ...student, balance: fromCents(updatedBalance) }
  return {
    findById: vi.fn().mockResolvedValue(student),
    updateBalance: vi.fn().mockResolvedValue(updatedStudent),
    list: vi.fn().mockResolvedValue([]),
  }
}

function makePaymentRepository(payment: Transaction | null) {
  return {
    findById: vi.fn().mockResolvedValue(payment),
    updateStatus: vi.fn().mockResolvedValue({
      ...payment!,
      status: 'approved',
      approvedAt: '2026-01-01T12:00:00Z',
    }),
    create: vi.fn(),
  }
}

describe('ApprovePaymentUseCase', () => {
  it('aprueba un pago pendiente y suma al saldo del estudiante', async () => {
    const student = makeStudent(5.0)
    const payment = makePayment('pending', 15.0)
    const studentRepo = makeStudentRepository(student, 2000)
    const paymentRepo = makePaymentRepository(payment)
    const useCase = new ApprovePaymentUseCase(studentRepo, paymentRepo)

    const result = await useCase.execute({ paymentId: 'payment-1' })

    expect(result.status).toBe('approved')
    expect(result.amount.cents).toBe(1500)
    expect(result.newBalance.cents).toBe(2000) // 5.0 + 15.0 = 20.0
    expect(paymentRepo.updateStatus).toHaveBeenCalledWith(
      'payment-1',
      'approved',
      expect.any(String),
    )
    expect(studentRepo.updateBalance).toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({ cents: 2000 }),
    )
  })

  it('lanza error si el pago no existe', async () => {
    const paymentRepo = makePaymentRepository(null)
    const studentRepo = makeStudentRepository(makeStudent(5.0))
    const useCase = new ApprovePaymentUseCase(studentRepo, paymentRepo)

    await expect(
      useCase.execute({ paymentId: 'inexistente' }),
    ).rejects.toThrow('Pago')
  })

  it('lanza error si el pago ya no está pendiente', async () => {
    const payment = makePayment('approved', 15.0)
    const paymentRepo = makePaymentRepository(payment)
    const studentRepo = makeStudentRepository(makeStudent(5.0))
    const useCase = new ApprovePaymentUseCase(studentRepo, paymentRepo)

    await expect(
      useCase.execute({ paymentId: 'payment-1' }),
    ).rejects.toThrow('ya está')
  })
})
