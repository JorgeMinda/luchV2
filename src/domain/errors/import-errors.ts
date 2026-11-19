export class ImportEncodingError extends Error {
  readonly code: string
  constructor(message: string) {
    super(message)
    this.name = 'ImportEncodingError'
    this.code = 'IMPORT_ENCODING_ERROR'
  }
}

export class ImportParsingError extends Error {
  readonly code: string
  constructor(message: string) {
    super(message)
    this.name = 'ImportParsingError'
    this.code = 'IMPORT_PARSING_ERROR'
  }
}

export class ImportValidationError extends Error {
  readonly code: string
  constructor(message: string) {
    super(message)
    this.name = 'ImportValidationError'
    this.code = 'IMPORT_VALIDATION_ERROR'
  }
}

export class ImportIdentityConflictError extends Error {
  readonly code: string
  constructor(message: string) {
    super(message)
    this.name = 'ImportIdentityConflictError'
    this.code = 'INGREDIENT_IDENTITY_CONFLICT'
  }
}

export class ImportPersistenceError extends Error {
  readonly code: string
  constructor(message: string) {
    super(message)
    this.name = 'ImportPersistenceError'
    this.code = 'IMPORT_PERSISTENCE_ERROR'
  }
}
