export type Money = {
  readonly __brand: 'Money'
  readonly cents: number
}

export function fromDollars(dollars: number): Money {
  if (!Number.isFinite(dollars)) {
    throw new Error('Monto inválido')
  }
  return { __brand: 'Money', cents: Math.round(dollars * 100) }
}

export function fromCents(cents: number): Money {
  if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
    throw new Error('Monto inválido')
  }
  return { __brand: 'Money', cents }
}

export function addMoney(a: Money, b: Money): Money {
  return { __brand: 'Money', cents: a.cents + b.cents }
}

export function subtract(a: Money, b: Money): Money {
  const result = a.cents - b.cents
  if (result < 0) {
    throw new Error('Saldo insuficiente')
  }
  return { __brand: 'Money', cents: result }
}

export function multiplyMoney(a: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new Error('Factor inválido')
  }
  return { __brand: 'Money', cents: Math.round(a.cents * factor) }
}

export function isGreaterThanOrEqual(a: Money, b: Money): boolean {
  return a.cents >= b.cents
}

export function equals(a: Money, b: Money): boolean {
  return a.cents === b.cents
}

export function toDollars(m: Money): number {
  return m.cents / 100
}

export function toString(m: Money): string {
  return (m.cents / 100).toFixed(2)
}

export function divideMoney(a: Money, divisor: number): Money {
  if (!Number.isFinite(divisor) || divisor <= 0) {
    throw new Error('Divisor inválido')
  }
  return { __brand: 'Money', cents: Math.round(a.cents / divisor) }
}
