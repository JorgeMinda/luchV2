import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Carga un fixture binario real del directorio __fixtures__. */
export function fixtureFile(name: string): File {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url))
  const buffer = readFileSync(path)
  return new File([buffer], name)
}

/** Bytes de una cadena UTF-8 (para CSV). */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/** Bytes de una cadena UTF-8 con BOM (para CSV). */
export function utf8BomBytes(text: string): Uint8Array {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const body = new TextEncoder().encode(text)
  const result = new Uint8Array(bom.length + body.length)
  result.set(bom, 0)
  result.set(body, bom.length)
  return result
}

const CP1252_HIGH: Record<string, number> = {
  á: 0xe1, é: 0xe9, í: 0xed, ó: 0xf3, ú: 0xfa, ü: 0xfc, ñ: 0xf1,
  Á: 0xc1, É: 0xc9, Í: 0xcd, Ó: 0xd3, Ú: 0xda, Ü: 0xdc, Ñ: 0xd1,
  'º': 0xba, '°': 0xb0, '¿': 0xbf, '¡': 0xa1,
}

/** Bytes de una cadena codificada en Windows-1252 (para CSV). */
export function cp1252Bytes(text: string): Uint8Array {
  const bytes: number[] = []
  for (const ch of text) {
    if (CP1252_HIGH[ch] !== undefined) {
      bytes.push(CP1252_HIGH[ch])
    } else if (ch.charCodeAt(0) < 128) {
      bytes.push(ch.charCodeAt(0))
    } else {
      throw new Error(`Carácter no soportado en fixture cp1252: ${ch}`)
    }
  }
  return new Uint8Array(bytes)
}

export function csvFile(name: string, bytes: Uint8Array): File {
  return new File([bytes as BlobPart], name)
}
