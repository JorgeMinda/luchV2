import type { Ingredient, IngredientStatus } from '../../../domain/entities'
import { fromDollars, type Money } from '../../../domain/value-objects/money'
import {
  downloadCsv,
  normalizeText,
  readSpreadsheetMatrix,
} from './spreadsheet'

export interface ParsedIngredientRow {
  rowNumber: number
  code: string
  category: string
  product: string
  presentation: string
  cost: Money | null
  rawCost: string
  status: IngredientStatus
  errors: string[]
}

const TEMPLATE_ROWS = [
  [
    'Código',
    'Bodega (Categoría)',
    'Producto',
    'Presentación',
    'Costo',
    'Estado',
  ],
  [
    'NP-101',
    'No perecibles',
    'Arroz extra largo',
    'Saco 50 kg',
    '42.50',
    'ACTIVO',
  ],
  [
    'FV-101',
    'Frutas y vegetales',
    'Tomate riñón',
    'Caja 10 kg',
    '18.00',
    'ACTIVO',
  ],
  [
    'CG-101',
    'Congelados',
    'Pechuga de pollo',
    'Funda 2 kg',
    '9.75',
    'ACTIVO',
  ],
  [
    'SM-101',
    'Suministros',
    'Vasos desechables',
    'Paquete 100 u',
    '3.20',
    'INACTIVO',
  ],
  ['LA-101', 'Lácteos', 'Leche entera', 'Caja 12 L', '14.40', 'ACTIVO'],
]

function parseCost(raw: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, '')

  if (!cleaned) return Number.NaN

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const normalized =
    lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')

  return Number(normalized)
}

function findColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.includes(header))
}

function buildRows(
  matrix: unknown[][],
  existingCodes: Set<string>,
): ParsedIngredientRow[] {
  const nonEmptyRows = matrix.filter((row) =>
    row.some((cell) => String(cell ?? '').trim() !== ''),
  )

  if (nonEmptyRows.length < 2) {
    throw new Error(
      'El archivo debe incluir una fila de encabezados y al menos un producto.',
    )
  }

  const headers = nonEmptyRows[0].map((cell) =>
    normalizeText(String(cell ?? '')),
  )

  const columns = {
    code: findColumn(headers, ['codigo', 'cod', 'code', 'cod producto']),
    category: findColumn(headers, [
      'bodega',
      'bodega categoria',
      'categoria',
      'category',
    ]),
    product: findColumn(headers, [
      'producto',
      'product',
      'nombre',
      'descripcion',
    ]),
    presentation: findColumn(headers, [
      'presentacion',
      'presentation',
      'formato',
    ]),
    cost: findColumn(headers, ['costo', 'cost', 'precio', 'costo unitario']),
    status: findColumn(headers, ['estado', 'status']),
  }

  const missingColumns: string[] = []
  if (columns.code === -1) missingColumns.push('Código')
  if (columns.product === -1) missingColumns.push('Producto')
  if (columns.cost === -1) missingColumns.push('Costo')

  if (missingColumns.length > 0) {
    throw new Error(
      `Faltan columnas obligatorias: ${missingColumns.join(', ')}. Descarga la plantilla para revisar el formato.`,
    )
  }

  const seenCodes = new Set<string>()

  return nonEmptyRows.slice(1).map((row, index) => {
    const getValue = (columnIndex: number) =>
      columnIndex >= 0 ? String(row[columnIndex] ?? '').trim() : ''

    const code = getValue(columns.code)
    const category = getValue(columns.category) || 'Sin categoría'
    const product = getValue(columns.product)
    const presentation = getValue(columns.presentation) || '—'
    const rawCost = getValue(columns.cost)
    const parsedCost = rawCost ? parseCost(rawCost) : Number.NaN
    const rawStatus = normalizeText(getValue(columns.status))

    const errors: string[] = []
    let status: IngredientStatus = 'ACTIVO'

    if (!code) errors.push('Código obligatorio')
    if (!product) errors.push('Producto obligatorio')

    if (!rawCost) {
      errors.push('Costo obligatorio')
    } else if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      errors.push('Costo inválido')
    }

    if (rawStatus === 'inactivo') {
      status = 'INACTIVO'
    } else if (rawStatus && rawStatus !== 'activo') {
      errors.push('Estado inválido (usa ACTIVO o INACTIVO)')
    }

    if (code) {
      const normalizedCode = code.toUpperCase()

      if (seenCodes.has(normalizedCode)) {
        errors.push('Código duplicado en el archivo')
      } else if (existingCodes.has(normalizedCode)) {
        errors.push('El código ya existe en el inventario')
      }

      seenCodes.add(normalizedCode)
    }

    return {
      rowNumber: index + 2,
      code,
      category,
      product,
      presentation,
      cost:
        rawCost && Number.isFinite(parsedCost) && parsedCost >= 0
          ? fromDollars(parsedCost)
          : null,
      rawCost,
      status,
      errors,
    }
  })
}

export async function parseCatalogFile(
  file: File,
  existingCodes: Set<string>,
): Promise<ParsedIngredientRow[]> {
  const matrix = await readSpreadsheetMatrix(file)
  return buildRows(matrix, existingCodes)
}

export function toNewIngredient(
  row: ParsedIngredientRow,
): Omit<Ingredient, 'id'> {
  return {
    code: row.code,
    category: row.category,
    product: row.product,
    presentation: row.presentation,
    cost: row.cost ?? fromDollars(0),
    status: row.status,
  }
}

export function downloadCatalogTemplate() {
  downloadCsv('plantilla-catalogo-costeo.csv', TEMPLATE_ROWS)
}
