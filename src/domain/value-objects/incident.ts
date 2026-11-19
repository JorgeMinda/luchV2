import type { SourceType } from './source-type'
import type { ImportProvenance } from './import-provenance'

export type IncidentSeverity = 'VALID' | 'WARNING' | 'ERROR'
export interface ImportIncident {
  readonly sourceType?: SourceType

  readonly code: string
  readonly field: string
  readonly originalValue: unknown
  readonly normalizedValue?: unknown
  readonly description: string
  readonly severity: IncidentSeverity
  readonly recommendedAction: string
  readonly provenance?: ImportProvenance
  readonly context?: string
}
