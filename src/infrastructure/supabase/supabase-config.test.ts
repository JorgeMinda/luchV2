import { describe, expect, it } from 'vitest'
import {
  resolveSupabaseConfig,
  SupabaseConfigError,
} from './supabase-config'

const URL = 'https://demo-project.supabase.co'
const KEY = 'sb_publishable_dummy_value_for_tests'

describe('resolveSupabaseConfig', () => {
  it('devuelve la configuración normalizada (sin barra final)', () => {
    const config = resolveSupabaseConfig({
      VITE_SUPABASE_URL: `${URL}/`,
      VITE_SUPABASE_PUBLISHABLE_KEY: ` ${KEY} `,
    })

    expect(config).toEqual({ url: URL, publishableKey: KEY })
  })

  it('falla con un mensaje comprensible si falta la URL, sin exponer la clave', () => {
    let thrown: unknown
    try {
      resolveSupabaseConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: KEY })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(SupabaseConfigError)
    const message = (thrown as Error).message
    expect(message).toContain('VITE_SUPABASE_URL')
    expect(message).not.toContain(KEY)
  })

  it('falla con un mensaje comprensible si falta la clave', () => {
    expect(() =>
      resolveSupabaseConfig({ VITE_SUPABASE_URL: URL }),
    ).toThrowError(/VITE_SUPABASE_PUBLISHABLE_KEY/)
  })

  it('rechaza claves vacías o en blanco', () => {
    expect(() =>
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: '   ',
      }),
    ).toThrowError(/VITE_SUPABASE_PUBLISHABLE_KEY/)
  })

  it('rechaza una URL que no sea http(s)', () => {
    expect(() =>
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: 'ftp://demo.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
      }),
    ).toThrowError(/VITE_SUPABASE_URL/)
  })

  it('rechaza una URL con el esquema duplicado (host "https" inválido)', () => {
    let thrown: unknown
    try {
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: 'https:https://demo-project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(SupabaseConfigError)
    expect((thrown as Error).message).toContain('esquema duplicado')
    expect((thrown as Error).message).not.toContain('demo-project')
  })

  it('rechaza claves de ejemplo (placeholders)', () => {
    expect(() =>
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'your-publishable-key',
      }),
    ).toThrowError(/valor de ejemplo/)
  })

  it('los mensajes de error nunca incluyen los valores del entorno', () => {
    const attempts = [
      { VITE_SUPABASE_PUBLISHABLE_KEY: KEY },
      { VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: '' },
      { VITE_SUPABASE_URL: 'not-a-url', VITE_SUPABASE_PUBLISHABLE_KEY: KEY },
      { VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'your-key' },
    ]

    for (const env of attempts) {
      try {
        resolveSupabaseConfig(env)
      } catch (error) {
        const message = (error as Error).message
        expect(message).not.toContain(KEY)
        expect(message).not.toContain(URL)
      }
    }
  })
})
