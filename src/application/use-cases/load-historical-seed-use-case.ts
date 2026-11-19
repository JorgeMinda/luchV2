import type {
  LoadHistoricalSeedInput,
  LoadHistoricalSeedOutput,
} from '../dtos/import-dtos'

export interface LoadHistoricalSeedUseCase {
  execute(input: LoadHistoricalSeedInput): Promise<LoadHistoricalSeedOutput>
}
