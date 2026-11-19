import { describe, expect, it, vi } from 'vitest'
import { RechargeBalanceUseCase } from './RechargeBalanceUseCase'
import { fromDollars } from '../../domain/value-objects/money'
import type { Transaction } from '../../domain/entities'

function makePaymentRepository(payment: Transaction) {
  return {
    findById: vi.fn(),
    updateStatus: vi.fn(),
    create: vi.fn().mockResolvedValue(payment),
  }
}

describe('RechargeBalanceUseCase', () => {
  it('crea un pago pendiente para recarga', async () => {
    const payment = {
      id: 'payment-rec-1',
      studentId: 'student-1',
      parentId: 'parent-1',
      amount: fromDollars(20.0),
      receiptUrl: 'https://example.com/receipt',
      status: 'pending' as const,
      createdAt: '2026-01-01T00:00:00Z',
      approvedAt: null,
    }
    const paymentRepo = makePaymentRepository(payment)
    const useCase = new RechargeBalanceUseCase(paymentRepo)

    const result = await useCase.execute({
      studentId: 'student-1',
      parentId: 'parent-1',
      amount: fromDollars(20.0),
      receiptUrl: 'https://example.com/receipt',
    })

    expect(result.status).toBe('pending')
    expect(result.amount.cents).toBe(2000)
    expect(result.studentId).toBe('student-1')
    expect(paymentRepo.create).toHaveBeenCalledWith({
      studentId: 'student-1',
      parentId: 'parent-1',
      amount: expect.objectContaining({ cents: 2000 }),
      receiptUrl: 'https://example.com/receipt',
    })
  })
})
