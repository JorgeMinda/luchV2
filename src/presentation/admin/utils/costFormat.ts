import type { Money } from '../../../domain/value-objects/money'
import { toDollars } from '../../../domain/value-objects/money'

const costFormatter = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const unitCostFormatter = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

const quantityFormatter = new Intl.NumberFormat('es-EC', {
  maximumFractionDigits: 4,
})

/** Convierte un monto Money o dólares a número para formatear. */
function toDollarsAmount(amount: number | Money): number {
  return typeof amount === 'number' ? amount : toDollars(amount)
}

export function formatCostCurrency(amount: number | Money): string {
  const dollars = toDollarsAmount(amount)
  return costFormatter.format(Number.isFinite(dollars) ? dollars : 0)
}

export function formatUnitCost(amount: number | Money): string {
  const dollars = toDollarsAmount(amount)
  return unitCostFormatter.format(
    Number.isFinite(dollars) ? dollars : 0,
  )
}

export function formatRecipeQuantity(quantity: number): string {
  return quantityFormatter.format(
    Number.isFinite(quantity) ? quantity : 0,
  )
}

export function parseCostNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  let text = String(value ?? '').trim()
  if (!text) return null

  const isNegative = /^\(.*\)$/.test(text)
  text = text.replace(/[^\d.,-]/g, '')

  if (!text) return null

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  let normalized = text

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ','
    normalized = text
      .split(thousandsSeparator)
      .join('')
      .replace(decimalSeparator, '.')
  } else if (lastComma >= 0) {
    const parts = text.split(',')
    normalized =
      parts.length > 2
        ? `${parts.slice(0, -1).join('')}.${parts.at(-1)}`
        : `${parts[0]}.${parts[1] ?? ''}`
  } else if (lastDot >= 0) {
    const parts = text.split('.')
    const lastGroup = parts.at(-1) ?? ''

    if (
      parts.length === 2 &&
      lastGroup.length === 3 &&
      parts[0] !== '0' &&
      !parts[0].startsWith('-0')
    ) {
      normalized = parts.join('')
    } else if (parts.length > 2) {
      normalized = `${parts.slice(0, -1).join('')}.${lastGroup}`
    }
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null

  return isNegative ? -Math.abs(parsed) : parsed
}

export function parseQuantityNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  let text = String(value ?? '').trim()
  if (!text) return null

  const isNegative = /^\(.*\)$/.test(text)
  text = text.replace(/[^\d.,-]/g, '')

  if (!text) return null

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ','
    return parseSignedNumber(
      text
        .split(thousandsSeparator)
        .join('')
        .replace(decimalSeparator, '.'),
      isNegative,
    )
  }

  if (lastComma >= 0) {
    const parts = text.split(',')

    if (parts.length > 2) {
      return parseSignedNumber(
        parts.at(-1)?.length === 3
          ? parts.join('')
          : `${parts.slice(0, -1).join('')}.${parts.at(-1)}`,
        isNegative,
      )
    }

    const [whole = '', decimals = ''] = parts
    const looksLikeThousands =
      decimals.length === 3 && whole !== '0' && !whole.startsWith('-0')

    return parseSignedNumber(
      looksLikeThousands ? `${whole}${decimals}` : `${whole}.${decimals}`,
      isNegative,
    )
  }

  if (lastDot >= 0) {
    const parts = text.split('.')
    const lastGroup = parts.at(-1) ?? ''

    if (
      parts.length === 2 &&
      lastGroup.length === 3 &&
      parts[0] !== '0' &&
      !parts[0].startsWith('-0')
    ) {
      return parseSignedNumber(parts.join(''), isNegative)
    }

    if (parts.length > 2) {
      return parseSignedNumber(
        `${parts.slice(0, -1).join('')}.${lastGroup}`,
        isNegative,
      )
    }
  }

  return parseSignedNumber(text, isNegative)
}

function parseSignedNumber(
  normalized: string,
  isNegative: boolean,
): number | null {
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null

  return isNegative ? -Math.abs(parsed) : parsed
}
