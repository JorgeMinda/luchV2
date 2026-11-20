import type { Student, WeekDay } from '../../../domain/entities'
import { LUNCH_PRICE } from '../../../domain/entities'
import type { Money } from '../../../domain/value-objects/money'
import { fromDollars } from '../../../domain/value-objects/money'

export { LUNCH_PRICE }

export const demoStudent: Student = {
  id: 'student-001',
  parentId: 'parent-001',
  name: 'Sofía Martínez',
  grade: '5° B',
  balance: fromDollars(18.5),
  qrCode: 'LUNCH-SOFIA-5B-001',
  isActive: true,
  deletedAt: undefined,
  deletedBy: undefined,
}

export interface MenuDayView {
  day: WeekDay
  dayLabel: string
  dateLabel: string
  mainDish: string
  sideDish: string
  drink: string
  isToday: boolean
}

export const demoLunchesThisMonth = 12

export interface RecentConsumption {
  id: string
  dateLabel: string
  description: string
  amount: Money
}

export const demoRecentConsumptions: RecentConsumption[] = [
  {
    id: 'consumption-001',
    dateLabel: 'Hoy · 12:34',
    description: 'Almuerzo · Carne guisada',
    amount: LUNCH_PRICE,
  },
  {
    id: 'consumption-002',
    dateLabel: 'Lun 2 nov · 12:20',
    description: 'Almuerzo · Pollo al horno',
    amount: LUNCH_PRICE,
  },
  {
    id: 'consumption-003',
    dateLabel: 'Vie 30 oct · 12:41',
    description: 'Almuerzo · Arroz con pollo',
    amount: LUNCH_PRICE,
  },
]

export interface BankAccount {
  bank: string
  accountType: string
  accountNumber: string
  holder: string
  documentId: string
}

export const demoBankAccount: BankAccount = {
  bank: 'Banco Pichincha',
  accountType: 'Cuenta de Ahorros',
  accountNumber: '2100 3456 7890',
  holder: 'Comedor Escolar Lunch',
  documentId: '1712345678-001',
}
