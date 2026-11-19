export type SourceType =
  | 'CATALOG'
  | 'RECIPE_COSTING'
  | 'MENU_PLAN'
  | 'MEAL_COMPOSITION'

export const SOURCE_TYPES: readonly SourceType[] = [
  'CATALOG',
  'RECIPE_COSTING',
  'MENU_PLAN',
  'MEAL_COMPOSITION',
] as const

export function isSourceType(value: unknown): value is SourceType {
  return (
    value === 'CATALOG' ||
    value === 'RECIPE_COSTING' ||
    value === 'MENU_PLAN' ||
    value === 'MEAL_COMPOSITION'
  )
}
