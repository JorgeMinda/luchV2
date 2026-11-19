export class DomainError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export class InsufficientBalanceError extends DomainError {
  constructor() {
    super('Saldo insuficiente', 'INSUFFICIENT_BALANCE')
    this.name = 'InsufficientBalanceError'
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class InvalidIngredientError extends DomainError {
  constructor(reason: string) {
    super(`Ingrediente inválido: ${reason}`, 'INVALID_INGREDIENT')
    this.name = 'InvalidIngredientError'
  }
}

export { ImportEncodingError } from './import-errors'
export { ImportParsingError } from './import-errors'
export { ImportValidationError } from './import-errors'
export { ImportIdentityConflictError } from './import-errors'
export { ImportPersistenceError } from './import-errors'
