import type {
  RevalidateImportRowInput,
  RevalidateImportRowOutput,
} from '../dtos/import-dtos'

export interface RevalidateImportRowUseCase {
  execute(input: RevalidateImportRowInput): Promise<RevalidateImportRowOutput>
}
