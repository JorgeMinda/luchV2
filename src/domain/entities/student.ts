import type { Money } from '../value-objects/money'

export interface Student {
  id: string
  parentId: string
  name: string
  grade: string
  balance: Money
  qrCode: string
  /** Borrado lógico: indica si el registro está activo. */
  isActive: boolean
  /** Timestamp de borrado lógico. */
  deletedAt?: string
  /** Usuario que realizó el borrado lógico. */
  deletedBy?: string
}

export interface NewStudent extends Omit<Student, 'id' | 'isActive' | 'deletedAt' | 'deletedBy'> {
  id?: string
}