import type { ValidateImportInput, ValidateImportOutput } from '../dtos/import-dtos'

export interface ValidateImportUseCase {
  execute(input: ValidateImportInput): Promise<ValidateImportOutput>
}
