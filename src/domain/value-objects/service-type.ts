export type ServiceType = 'lunch' | 'breakfast' | 'snack'

export const SERVICE_TYPES: readonly ServiceType[] = ['lunch', 'breakfast', 'snack'] as const

export function isServiceType(value: unknown): value is ServiceType {
  return value === 'lunch' || value === 'breakfast' || value === 'snack'
}