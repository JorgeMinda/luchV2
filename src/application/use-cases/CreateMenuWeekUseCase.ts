import type { MenuPlanRepository } from '../ports/MenuPlanRepository'
import { normalizeToMonday } from '../../domain/value-objects/week'

export interface CreateMenuWeekInput {
  /** Fecha de referencia (cualquier día de la semana). Se normalizará al lunes. */
  referenceDate: string
}

export interface CreateMenuWeekResult {
  weekStartDate: string
  created: boolean
}

export class CreateMenuWeekUseCase {
  private readonly repository: MenuPlanRepository

  constructor(repository: MenuPlanRepository) {
    this.repository = repository
  }

  async execute(input: CreateMenuWeekInput): Promise<CreateMenuWeekResult> {
    const weekStartDate = normalizeToMonday(input.referenceDate)

    // Verificar si ya existe una semana con ese weekStartDate
    const cells = await this.repository.list()
    const exists = cells.some((cell) => cell.weekStartDate === weekStartDate)

    if (exists) {
      return { weekStartDate, created: false }
    }

    // No es necesario crear celdas vacías explícitamente.
    // La semana existe conceptualmente cuando se le asigna al menos una celda.
    // Retornamos éxito para que la UI pueda seleccionarla.
    return { weekStartDate, created: true }
  }
}