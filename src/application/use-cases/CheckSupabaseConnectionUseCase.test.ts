import { describe, expect, it } from 'vitest'
import {
  CheckSupabaseConnectionUseCase,
  isConnectionFailure,
} from './CheckSupabaseConnectionUseCase'
import type {
  SupabaseConnectionPort,
  SupabaseConnectionResult,
} from '../ports/SupabaseConnectionPort'

function fakePort(status: SupabaseConnectionResult['status']): SupabaseConnectionPort {
  return {
    checkConnection: async (): Promise<SupabaseConnectionResult> => ({
      status,
      message: 'mensaje de prueba',
      tableCount: 0,
      httpStatus: 200,
      checkedAt: new Date().toISOString(),
    }),
  }
}

describe('CheckSupabaseConnectionUseCase', () => {
  it('devuelve el estado clasificado del puerto', async () => {
    const useCase = new CheckSupabaseConnectionUseCase(fakePort('connected'))
    const result = await useCase.execute()
    expect(result.status).toBe('connected')
  })

  it('propaga errores del puerto', async () => {
    const failingPort: SupabaseConnectionPort = {
      checkConnection: async () => {
        throw new Error('boom')
      },
    }
    const useCase = new CheckSupabaseConnectionUseCase(failingPort)
    await expect(useCase.execute()).rejects.toThrow('boom')
  })
})

describe('isConnectionFailure', () => {
  it('connected y no_tables no son fallos', () => {
    expect(isConnectionFailure(fakeResult('connected'))).toBe(false)
    expect(isConnectionFailure(fakeResult('no_tables'))).toBe(false)
  })

  it('el resto de estados sí son fallos', () => {
    const failures = [
      'invalid_credentials',
      'insufficient_permissions',
      'network_error',
      'service_unavailable',
      'misconfigured',
    ] as const
    for (const status of failures) {
      expect(isConnectionFailure(fakeResult(status))).toBe(true)
    }
  })
})

function fakeResult(status: SupabaseConnectionResult['status']): SupabaseConnectionResult {
  return {
    status,
    message: '',
    tableCount: 0,
    httpStatus: null,
    checkedAt: new Date().toISOString(),
  }
}
