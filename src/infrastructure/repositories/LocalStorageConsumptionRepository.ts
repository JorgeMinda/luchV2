import type { Consumption } from '../../domain/entities/consumption'
import type { Money } from '../../domain/value-objects/money'
import type { ConsumptionRepository } from '../../application/ports/ConsumptionRepository'
import { readStoredCollection, writeStoredCollection } from '../storage/localStorage'

const STORAGE_KEY = 'lunch-consumptions'

export class LocalStorageConsumptionRepository implements ConsumptionRepository {
  async record(input: {
    studentId: string
    meals: number
    total: Money
    source: 'qr' | 'manual'
  }): Promise<Consumption> {
    const consumptions = readStoredCollection<Consumption>(STORAGE_KEY, isConsumption) ?? []
    const consumption: Consumption = {
      id: `consumption-${crypto.randomUUID()}`,
      studentId: input.studentId,
      meals: input.meals,
      total: input.total,
      source: input.source,
      createdAt: new Date().toISOString(),
    }
    consumptions.push(consumption)
    writeStoredCollection(STORAGE_KEY, consumptions)
    return consumption
  }

  async listByStudent(studentId: string): Promise<Consumption[]> {
    const consumptions = readStoredCollection<Consumption>(STORAGE_KEY, isConsumption) ?? []
    return consumptions.filter((c: Consumption) => c.studentId === studentId)
  }
}

function isConsumption(value: unknown): value is Consumption {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Consumption).id === 'string' &&
    typeof (value as Consumption).studentId === 'string'
  )
}
