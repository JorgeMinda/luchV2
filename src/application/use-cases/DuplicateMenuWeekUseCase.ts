import type { MenuPlanRepository } from '../ports/MenuPlanRepository'
import { normalizeToMonday, addWeeks } from '../../domain/value-objects/week'

export interface DuplicateMenuWeekInput {
  /** weekStartDate de la semana activa (YYYY-MM-DD, lunes). */
  activeWeekStartDate: string
}

export interface DuplicateMenuWeekResult {
  sourceWeekStartDate: string
  targetWeekStartDate: string
  clonedCells: number
  skippedWeeks: number
}

export class DuplicateMenuWeekUseCase {
  private readonly repository: MenuPlanRepository

  constructor(repository: MenuPlanRepository) {
    this.repository = repository
  }

  async execute(input: DuplicateMenuWeekInput): Promise<DuplicateMenuWeekResult> {
    const sourceWeekStartDate = normalizeToMonday(input.activeWeekStartDate)

    // Verificar que la semana origen existe
    const allCells = await this.repository.list()
    const sourceCells = allCells.filter(
      (cell) => cell.weekStartDate === sourceWeekStartDate,
    )

    if (sourceCells.length === 0) {
      throw new Error(`La semana activa ${sourceWeekStartDate} no existe o está vacía`)
    }

    // Buscar la siguiente semana disponible (+7, +14, +21, ...)
    let targetWeekStartDate = addWeeks(sourceWeekStartDate, 1)
    let skippedWeeks = 0

    while (true) {
      const exists = allCells.some(
        (cell) => cell.weekStartDate === targetWeekStartDate,
      )
      if (!exists) break

      skippedWeeks += 1
      targetWeekStartDate = addWeeks(targetWeekStartDate, 1)
    }

    // Clonar las celdas
    const clonedCells = sourceCells.map((cell) => ({
      ...cell,
      weekStartDate: targetWeekStartDate,
    }))

    // Persistir
    for (const cell of clonedCells) {
      await this.repository.setCell(cell)
    }

    return {
      sourceWeekStartDate,
      targetWeekStartDate,
      clonedCells: clonedCells.length,
      skippedWeeks,
    }
  }
}