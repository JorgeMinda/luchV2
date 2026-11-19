/**
 * Implementación de ImportFileReaderPort para CSV, XLSX y XLS.
 *
 * - CSV: detección de BOM, UTF-8 estricto con fallback a Windows-1252
 *   (se registra una incidencia informativa cuando se usa el fallback).
 * - XLSX/XLS: lectura binaria real con SheetJS (`xlsx`), conservando valores,
 *   tipos, fechas y errores de celda (#REF!, #VALUE!, #DIV/0!) sin convertirlos
 *   en cero ni descartarlos.
 *
 * Errores de codificación, delimitador y fórmula se reportan como datos,
 * nunca se convierten silenciosamente en cero.
 */

import type {
  ImportFileReaderPort,
  RawCell,
  RawCellType,
  RawFileData,
  RawSheetData,
  RawWorkbookData,
  ReaderIncident,
} from '../../../application/ports/import-file-reader-port'
import { detectSheetSourceType } from './sheet-type-detector'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const FORMULA_ERRORS = ['#REF!', '#VALUE!', '#N/A', '#DIV/0!', '#NAME?', '#NULL!', '#NUM!']

function hasBOMUTF8(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
}

function decodeBuffer(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer)

  if (hasBOMUTF8(bytes)) {
    return { text: new TextDecoder('utf-8').decode(buffer.slice(3)), encoding: 'UTF-8 with BOM' }
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    if (!text.includes('\uFFFD')) return { text, encoding: 'UTF-8' }
  } catch {
    // probar siguiente codificación
  }

  try {
    return { text: new TextDecoder('windows-1252').decode(buffer), encoding: 'Windows-1252' }
  } catch {
    return { text: new TextDecoder('iso-8859-1').decode(buffer), encoding: 'ISO-8859-1' }
  }
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestCount = -1
  for (const delimiter of candidates) {
    const count = firstLine.split(delimiter).length - 1
    if (count > bestCount) {
      bestCount = count
      best = delimiter
    }
  }
  return bestCount > 0 ? best : ','
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => String(cell ?? '').trim() !== ''))
}

function toCell(value: unknown, type: RawCellType, formatted?: string): RawCell {
  return { value, type, formatted }
}

function stringCell(text: string): RawCell {
  const trimmed = text.trim()
  if (trimmed === '') return toCell('', 'empty')
  return toCell(trimmed, FORMULA_ERRORS.includes(trimmed) ? 'error' : 'string', text)
}

interface SheetJsCell {
  t?: string
  v?: unknown
  w?: string
}

/** Mapa de códigos de error de celda de SheetJS a su texto canónico. */
const ERROR_CODE_TEXT: Record<number, string> = {
  0x00: '#NULL!',
  0x07: '#DIV/0!',
  0x0f: '#VALUE!',
  0x1a: '#REF!',
  0x1c: '#NAME?',
  0x1d: '#NUM!',
  0x1f: '#N/A',
}

function cellToRawCell(cell: SheetJsCell | undefined): RawCell {
  if (!cell || cell.v === undefined || cell.v === null) {
    return toCell('', 'empty')
  }

  switch (cell.t) {
    case 'e': {
      const text =
        typeof cell.w === 'string' && cell.w.trim() !== ''
          ? cell.w.trim()
          : ERROR_CODE_TEXT[Number(cell.v)] ?? `#ERROR_${Number(cell.v)}`
      return toCell(text, 'error', text)
    }
    case 'd':
      return toCell(cell.v, 'date', typeof cell.w === 'string' ? cell.w : undefined)
    case 'n':
      return toCell(cell.v, 'number', typeof cell.w === 'string' ? cell.w : undefined)
    case 'b':
      return toCell(cell.v, 'boolean')
    case 's':
      return stringCell(String(cell.v))
    default:
      return stringCell(String(cell.v))
  }
}

async function readExcelWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<{ sheets: RawSheetData[]; incidents: ReaderIncident[] }> {
  const XLSX = await import('xlsx')
  const data = new Uint8Array(buffer)
  let workbook
  try {
    workbook = XLSX.read(data, { type: 'array', cellDates: true })
  } catch (error) {
    throw new Error(
      `No se pudo leer el archivo Excel '${fileName}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  const incidents: ReaderIncident[] = []
  const workbookEpoch = workbook.Workbook as
    | { Date1904?: boolean; WBProps?: { date1904?: boolean } }
    | undefined
  const epoch1904 =
    workbookEpoch?.Date1904 === true ||
    workbookEpoch?.WBProps?.date1904 === true
  if (epoch1904) {
    incidents.push({
      code: 'EXCEL_EPOCH_1904',
      severity: 'INFO',
      description: `El libro '${fileName}' usa el sistema de fechas 1904; las fechas seriales se interpretan con esa época.`,
      context: 'Sistema de fechas del libro',
    })
  }

  const sheets: RawSheetData[] = workbook.SheetNames.map((name, index) => {
    const sheet = workbook.Sheets[name]
    const rows: RawCell[][] = []

    if (!sheet || !sheet['!ref']) {
      incidents.push({
        code: 'EMPTY_SHEET',
        severity: 'INFO',
        description: `La hoja '${name}' está vacía o no tiene rango legible.`,
        sheetName: name,
        context: 'Lectura de hojas del libro',
      })
      return {
        index,
        originalName: name,
        normalizedName: name.trim(),
        rows,
      }
    }

    const range = XLSX.utils.decode_range(sheet['!ref'])
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cells: RawCell[] = []
      for (let col = range.s.c; col <= range.e.c; col++) {
        const address = XLSX.utils.encode_cell({ r: row, c: col })
        cells.push(cellToRawCell(sheet[address] as SheetJsCell | undefined))
      }
      rows.push(cells)
    }

    return {
      index,
      originalName: name,
      normalizedName: name.trim(),
      rows,
    }
  })

  return { sheets, incidents }
}

export class SpreadsheetFileReader implements ImportFileReaderPort {
  async detectFormat(file: File): Promise<'csv' | 'xlsx' | 'xls'> {
    const name = file.name.toLowerCase()
    if (name.endsWith('.csv')) return 'csv'
    if (name.endsWith('.xlsx')) return 'xlsx'
    if (name.endsWith('.xls')) return 'xls'
    throw new Error('Formato no soportado. Use .csv, .xlsx o .xls.')
  }

  async detectEncoding(file: File): Promise<string> {
    const format = await this.detectFormat(file)
    if (format !== 'csv') return 'binary'
    const buffer = await file.arrayBuffer()
    return decodeBuffer(buffer).encoding
  }

  async readWorkbook(file: File): Promise<RawWorkbookData> {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error('El archivo supera el tamaño máximo permitido de 10 MB.')
    }

    const format = await this.detectFormat(file)
    const buffer = await file.arrayBuffer()

    if (format === 'csv') {
      const { text, encoding } = decodeBuffer(buffer)
      const incidents: ReaderIncident[] = []
      if (encoding === 'Windows-1252' || encoding === 'ISO-8859-1') {
        incidents.push({
          code: 'ENC_FALLBACK',
          severity: 'INFO',
          description: `El archivo '${file.name}' no es UTF-8 válido; se decodificó con ${encoding}.`,
          originalValue: encoding,
          context: 'Decodificación de CSV',
        })
      }
      const rows = parseDelimited(text, detectDelimiter(text))
      if (rows.length === 0) throw new Error('El archivo CSV no contiene datos.')
      const sheet: RawSheetData = {
        index: 0,
        originalName: file.name,
        normalizedName: file.name.trim(),
        rows: rows.map((r) => r.map(stringCell)),
      }
      return {
        fileName: file.name,
        fileSize: file.size,
        encoding,
        format,
        sheets: [sheet],
        incidents,
      }
    }

    const { sheets, incidents } = await readExcelWorkbook(buffer, file.name)
    if (sheets.length === 0) {
      throw new Error(`El archivo '${file.name}' no contiene hojas legibles.`)
    }
    return {
      fileName: file.name,
      fileSize: file.size,
      encoding: 'binary',
      format,
      sheets,
      incidents,
    }
  }

  async readFile(file: File): Promise<RawFileData> {
    const workbook = await this.readWorkbook(file)
    const sheetsRecord: Record<string, unknown[][]> = {}
    const sheetTypes = workbook.sheets.map((sheet) =>
      detectSheetSourceType(sheet.originalName, sheet.index),
    )
    for (const sheet of workbook.sheets) {
      sheetsRecord[sheet.originalName] = sheet.rows.map((cells) =>
        cells.map((cell) => (cell.type === 'empty' ? '' : cell.value)),
      )
    }
    const firstSheet = workbook.sheets[0]
    return {
      fileName: workbook.fileName,
      fileSize: workbook.fileSize,
      encoding: workbook.encoding,
      format: workbook.format,
      sheets: sheetsRecord,
      sheetData: workbook.sheets,
      sheetTypes,
      incidents: workbook.incidents,
      rawText: firstSheet.rows
        .map((r) => r.map((c) => (c.type === 'empty' ? '' : String(c.value))).join(','))
        .join('\n'),
    }
  }
}
