import type { CommitImportInput, CommitImportOutput } from '../dtos/import-dtos'

export interface CommitImportUseCase {
  execute(input: CommitImportInput): Promise<CommitImportOutput>
}
