import type { Money } from '../../../domain/value-objects/money'
import { toDollars } from '../../../domain/value-objects/money'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Acepta dólares (number) o un monto Money del dominio. */
export function formatCurrency(amount: number | Money): string {
  const dollars = typeof amount === 'number' ? amount : toDollars(amount)
  return currencyFormatter.format(dollars)
}
