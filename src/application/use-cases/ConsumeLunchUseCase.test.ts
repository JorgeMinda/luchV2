import { describe, expect, it, vi } from 'vitest'
import { ConsumeLunchUseCase } from './ConsumeLunchUseCase'
import { fromDollars } from '../../domain/value-objects/money'
import type { Student } from '../../domain/entities'
import type { StudentRepository } from '../ports/StudentRepository'
import type { ConsumptionRepository } from '../ports/ConsumptionRepository'

function makeStudent(balance: number): Student {
  return {
    id: 'student-1',
    parentId: 'parent-1',
    name: 'Sofía Martínez',
    grade: '5° B',
    balance: fromDollars(balance),
    qrCode: 'QR-001',
  }
}

function makeStudentRepository(student: Student | null): StudentRepository {
  return {
    findById: vi.fn().mockResolvedValue(student),
    updateBalance: vi.fn().mockResolvedValue(student!),
    list: vi.fn().mockResolvedValue([]),
  }
}

function makeConsumptionRepository(): ConsumptionRepository {
  return {
    record: vi.fn().mockResolvedValue({
      id: 'consumption-1',
      studentId: 'student-1',
      meals: 1,
      total: fromDollars(2.5),
      source: 'manual',
      createdAt: '2026-01-01T00:00:00Z',
    }),
    listByStudent: vi.fn().mockResolvedValue([]),
  }
}

describe('ConsumeLunchUseCase', () => {
  it('descuenta el saldo y registra el consumo', async () => {
    const student = makeStudent(10.0)
    const studentRepo = makeStudentRepository(student)
    const consumptionRepo = makeConsumptionRepository()
    const useCase = new ConsumeLunchUseCase(studentRepo, consumptionRepo)

    const result = await useCase.execute({
      studentId: 'student-1',
      meals: 2,
      unitPrice: fromDollars(2.5),
      source: 'manual',
    })

    expect(result.meals).toBe(2)
    expect(result.total.cents).toBe(500) // 2.5 * 2 = 5.00
    expect(result.newBalance.cents).toBe(500) // 10.0 - 5.0 = 5.0
    expect(consumptionRepo.record).toHaveBeenCalledTimes(1)
    expect(studentRepo.updateBalance).toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({ cents: 500 }),
    )
  })

  it('lanza error si el estudiante no existe', async () => {
    const studentRepo = makeStudentRepository(null)
    const consumptionRepo = makeConsumptionRepository()
    const useCase = new ConsumeLunchUseCase(studentRepo, consumptionRepo)

    await expect(
      useCase.execute({
        studentId: 'inexistente',
        meals: 1,
        unitPrice: fromDollars(2.5),
        source: 'qr',
      }),
    ).rejects.toThrow('Estudiante')
  })

  it('lanza error si el saldo es insuficiente', async () => {
    const student = makeStudent(1.0) // solo 1.00, necesita 5.00
    const studentRepo = makeStudentRepository(student)
    const consumptionRepo = makeConsumptionRepository()
    const useCase = new ConsumeLunchUseCase(studentRepo, consumptionRepo)

    await expect(
      useCase.execute({
        studentId: 'student-1',
        meals: 2,
        unitPrice: fromDollars(2.5),
        source: 'qr',
      }),
    ).rejects.toThrow('Saldo insuficiente')
  })
})
