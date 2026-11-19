import type { AnalyzeImportInput, AnalyzeImportOutput } from '../dtos/import-dtos'

export interface AnalyzeImportUseCase {
  execute(input: AnalyzeImportInput): Promise<AnalyzeImportOutput>
}
