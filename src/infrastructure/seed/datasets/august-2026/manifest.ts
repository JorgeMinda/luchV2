export interface August2026DatasetManifest {
  readonly datasetId: string
  readonly version: string
  readonly period: string
  readonly recordCount: number
  readonly checksum: string
  readonly sourceFiles: string[]
  readonly loadedAt?: string
}
