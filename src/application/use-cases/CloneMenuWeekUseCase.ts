import type { MenuPlanRepository } from '../ports/MenuPlanRepository'

export interface CloneMenuWeekInput {
  /** weekStartDate de la semana origen (YYYY-MM-DD, lunes). */
  sourceWeekStartDate: string
  /** weekStartDate de la semana destino (YYYY-MM-DD, lunes). */
  targetWeekStartDate: string
}

export interface CloneMenuWeekResult {
  sourceWeekStartDate: string
  targetWeekStartDate: string
  clonedCells: number
}

export class CloneMenuWeekUseCase {
  private readonly repository: MenuPlanRepository

  constructor(repository: MenuPlanRepository) {
    this.repository = repository
  }

  async execute(input: CloneMenuWeekInput): Promise<CloneMenuWeekResult> {
    const sourceWeekStartDate = input.sourceWeekStartDate
    const targetWeekStartDate = input.targetWeekStartDate

    // Verificar que la semana origen existe
    const allCells = await this.repository.list()
    const sourceCells = allCells.filter(
      (cell) => cell.weekStartDate === sourceWeekStartDate,
    )

    if (sourceCells.length === 0) {
      throw new Error(`La semana origen ${sourceWeekStartDate} no existe o está vacía`)
    }

    // Verificar si la semana destino ya existe
    const targetExists = allCells.some(
      (cell) => cell.weekStartDate === targetWeekStartDate,
    )

    if (targetExists) {
      throw new Error(
        `La semana destino ${targetWeekStartDate} ya existe. Use la función Duplicar para encontrar la siguiente disponible.`,
      )
    }

    // Clonar las celdas: copiar y desplazar weekStartDate
    const clonedCells = sourceCells.map((cell) => ({
      ...cell,
      weekStartDate: targetWeekStartDate,
    }))

    // Persistir las celdas clonadas
    for (const cell of clonedCells) {
      await this.repository.setCell(cell)
    }

    return {
      sourceWeekStartDate,
      targetWeekStartDate,
      clonedCells: clonedCells.length,
    }
  }
}