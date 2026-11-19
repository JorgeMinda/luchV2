export type UnitOfMeasure = 'g' | 'kg' | 'ml' | 'l' | 'un' | 'lb' | 'oz'

export interface UnitConversion {
  readonly from: UnitOfMeasure
  readonly to: UnitOfMeasure
  readonly factor: number
  readonly requiresDensity: boolean
}
