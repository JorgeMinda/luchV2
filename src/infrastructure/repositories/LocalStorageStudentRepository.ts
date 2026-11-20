import type { Student, NewStudent } from '../../domain/entities'
import type { Money } from '../../domain/value-objects/money'
import { fromDollars } from '../../domain/value-objects/money'
import type { StudentRepository } from '../../application/ports/StudentRepository'
import { readStoredCollection, writeStoredCollection } from '../storage/localStorage'

const STORAGE_KEY = 'lunch-students'

/** Convierte saldos heredados (número en dólares) a Money. */
function normalizeStudent(student: Student): Student {
  const balance: unknown = student.balance
  if (typeof balance === 'number') {
    return { ...student, balance: fromDollars(balance) }
  }
  return student
}

function isStudent(value: unknown): value is Student {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Student).id === 'string' &&
    typeof (value as Student).name === 'string' &&
    typeof (value as Student).qrCode === 'string' &&
    typeof (value as Student).isActive === 'boolean'
  )
}

function readStudents(): Student[] {
  return (
    readStoredCollection<Student>(STORAGE_KEY, isStudent) ?? []
  ).map(normalizeStudent)
}

export class LocalStorageStudentRepository implements StudentRepository {
  async findById(id: string): Promise<Student | null> {
    const students = readStudents()
    return students.find((s: Student) => s.id === id) ?? null
  }

  async updateBalance(id: string, balance: Money): Promise<Student> {
    const students = readStudents()
    const index = students.findIndex((s: Student) => s.id === id)
    if (index === -1) {
      throw new Error(`Estudiante ${id} no encontrado`)
    }
    const updated = { ...students[index], balance }
    students[index] = updated
    writeStoredCollection(STORAGE_KEY, students)
    return updated
  }

  async list(): Promise<Student[]> {
    return readStudents()
  }

  async findByParentId(parentId: string): Promise<Student[]> {
    const students = readStudents()
    return students.filter((s) => s.parentId === parentId)
  }

  async findByQrCode(qrCode: string): Promise<Student | null> {
    const students = readStudents()
    return students.find((s) => s.qrCode === qrCode) ?? null
  }

  async save(student: NewStudent): Promise<Student> {
    const students = readStudents()
    const newStudent: Student = {
      id: student.id ?? `student-${crypto.randomUUID()}`,
      parentId: student.parentId,
      name: student.name,
      grade: student.grade,
      balance: student.balance,
      qrCode: student.qrCode,
      isActive: true,
      deletedAt: undefined,
      deletedBy: undefined,
    }
    students.push(newStudent)
    writeStoredCollection(STORAGE_KEY, students)
    return newStudent
  }

  async delete(id: string, deletedBy: string): Promise<void> {
    const students = readStudents()
    const index = students.findIndex((s) => s.id === id)
    if (index !== -1) {
      students[index] = {
        ...students[index],
        isActive: false,
        deletedAt: new Date().toISOString(),
        deletedBy,
      }
      writeStoredCollection(STORAGE_KEY, students)
    }
  }
}