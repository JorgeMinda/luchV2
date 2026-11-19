import type {
  RecipeCostComparisonInput,
  RecipeCostComparisonOutput,
} from '../dtos/import-dtos'

export interface CompareRecipeCostsUseCase {
  execute(input: RecipeCostComparisonInput): Promise<RecipeCostComparisonOutput>
}
