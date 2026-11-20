import type { SourceType } from '../../domain/value-objects/source-type'

export type RawCellType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'error'
  | 'empty'

export interface RawCell {
  readonly value: unknown
  readonly type: RawCellType
  /** Texto formateado original cuando difiere del valor (ej. errores de fórmula). */
  readonly formatted?: string
  /** Fórmula original de la celda (ej. "=A1+B1", "5*1.00") cuando existe. */
  readonly formula?: string
  /** Coordenada de la celda en notación A1 (ej. "E140", "J1079"). */
  readonly sourceCell?: string
  /** Nombre de la hoja de origen. */
  readonly sourceSheet?: string
  /** Nombre del archivo de origen. */
  readonly sourceFile?: string
}

export interface RawSheetData {
  readonly index: number
  readonly originalName: string
  readonly normalizedName: string
  readonly rows: readonly RawCell[][]
}

export interface ReaderIncident {
  readonly code: string
  readonly severity: 'INFO' | 'WARNING' | 'ERROR'
  readonly description: string
  readonly sheetName?: string
  readonly rowNumber?: number
  readonly column?: string
  readonly originalValue?: unknown
  readonly context?: string
}

export interface RawWorkbookData {
  readonly fileName: string
  readonly fileSize: number
  readonly encoding: string
  readonly format: 'csv' | 'xlsx' | 'xls'
  readonly sheets: readonly RawSheetData[]
  readonly incidents: readonly ReaderIncident[]
}

export interface RawFileData {
  readonly fileName: string
  readonly fileSize: number
  readonly encoding: string
  readonly format: 'csv' | 'xlsx' | 'xls'
  readonly rawText?: string
  /** Matriz de valores por hoja (compatibilidad con el pipeline de análisis). */
  readonly sheets?: Record<string, unknown[][]>
  /** Metadatos completos por hoja: tipos de celda y detección de SourceType. */
  readonly sheetData?: readonly RawSheetData[]
  /** Detección auditable del tipo de fuente por hoja. */
  readonly sheetTypes?: readonly SheetTypeDetection[]
  /** Incidencias del lector (codificación, formato, errores estructurales). */
  readonly incidents?: readonly ReaderIncident[]
}

export interface SheetTypeDetection {
  readonly sheetName: string
  readonly sheetIndex: number
  readonly sourceType?: SourceType
  readonly ruleId?: string
  readonly matchedKeyword?: string
  readonly confidence: 'HIGH' | 'MEDIUM' | 'NONE'
  readonly alternatives?: readonly SourceType[]
}

export interface ImportFileReaderPort {
  detectFormat(file: File): Promise<'csv' | 'xlsx' | 'xls'>
  detectEncoding(file: File): Promise<string>
  readFile(file: File): Promise<RawFileData>
  readWorkbook(file: File): Promise<RawWorkbookData>
}
