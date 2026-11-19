import { describe, expect, it } from 'vitest'
import { SpreadsheetFileReader } from './spreadsheet-file-reader'
import { cp1252Bytes, csvFile, fixtureFile, utf8BomBytes, utf8Bytes } from '../test-utils'

const reader = new SpreadsheetFileReader()

describe('SpreadsheetFileReader — CSV', () => {
  it('lee CSV UTF-8 sin BOM', async () => {
    const file = csvFile('utf8.csv', utf8Bytes('CÓDIGO,PRODUCTO\n1,ACEITE\n2,ARROZ'))
    const workbook = await reader.readWorkbook(file)

    expect(workbook.format).toBe('csv')
    expect(workbook.encoding).toBe('UTF-8')
    expect(workbook.sheets).toHaveLength(1)
    expect(workbook.sheets[0].rows[0].map((c) => c.value)).toEqual(['CÓDIGO', 'PRODUCTO'])
    expect(workbook.sheets[0].rows[1].map((c) => c.value)).toEqual(['1', 'ACEITE'])
  })

  it('lee CSV con BOM y retira el BOM del contenido', async () => {
    const file = csvFile('bom.csv', utf8BomBytes('A,B\n1,2'))
    const workbook = await reader.readWorkbook(file)

    expect(workbook.encoding).toBe('UTF-8 with BOM')
    expect(workbook.sheets[0].rows[0].map((c) => c.value)).toEqual(['A', 'B'])
  })

  it('decodifica CSV Windows-1252 con incidencia informativa', async () => {
    const file = csvFile('cp1252.csv', cp1252Bytes('CÓDIGO,PRODUCTO\n1,PAPAS FRIAS'))
    const workbook = await reader.readWorkbook(file)

    expect(workbook.encoding).toBe('Windows-1252')
    expect(workbook.sheets[0].rows[0].map((c) => c.value)).toEqual(['CÓDIGO', 'PRODUCTO'])
    const fallback = workbook.incidents.find((i) => i.code === 'ENC_FALLBACK')
    expect(fallback).toBeDefined()
    expect(fallback?.severity).toBe('INFO')
    expect(fallback?.description).toContain('Windows-1252')
  })

  it('detecta delimitador punto y coma', async () => {
    const file = csvFile('sep.csv', utf8Bytes('A;B;C\n1;2;3'))
    const workbook = await reader.readWorkbook(file)
    expect(workbook.sheets[0].rows[1].map((c) => c.value)).toEqual(['1', '2', '3'])
  })

  it('conserva campos entre comillas con separadores internos', async () => {
    const file = csvFile('quotes.csv', utf8Bytes('A,B\n"x, y",z'))
    const workbook = await reader.readWorkbook(file)
    expect(workbook.sheets[0].rows[1].map((c) => c.value)).toEqual(['x, y', 'z'])
  })

  it('detectEncoding reporta la codificación real', async () => {
    // 'PAPÁ' en Windows-1252: P=0x50, A=0x41, P=0x50, Á=0xE1
    // En UTF-8 sería 0xC3 0xA1; el byte 0xE1 solo no es UTF-8 válido
    const file = csvFile('enc.csv', cp1252Bytes('PAPÁ\n1,2'))
    expect(await reader.detectEncoding(file)).toBe('Windows-1252')
  })
})

describe('SpreadsheetFileReader — XLSX binario', () => {
  it('lee todas las hojas del libro con nombres originales y normalizados', async () => {
    const file = fixtureFile('menu-fixtures.xlsx')
    const workbook = await reader.readWorkbook(file)

    expect(workbook.format).toBe('xlsx')
    expect(workbook.sheets).toHaveLength(6)
    expect(workbook.sheets.map((s) => s.originalName)).toEqual([
      'CATALOGO COSTEO 17-08-2',
      'COSTEO RECETA ALMUERZOS',
      'MENÚ AGSTO-JULIO2026-2027',
      'COSTEO REFRIGERIOS ',
      'MENU REFRIGERIOS',
      'COMPOSICION DE CADA PLATO',
    ])
    // El nombre normalizado (trim) elimina el espacio final de la hoja 4.
    expect(workbook.sheets[3].normalizedName).toBe('COSTEO REFRIGERIOS')
  })

  it('conserva valores numéricos, tipos y fechas seriales sin convertirlos en cero', async () => {
    const file = fixtureFile('menu-fixtures.xlsx')
    const workbook = await reader.readWorkbook(file)

    const menu = workbook.sheets[2]
    // Fila de fechas seriales: 46258..46262 como números.
    const dateRow = menu.rows[3]
    expect(dateRow[1].type).toBe('number')
    expect(dateRow[1].value).toBe(46258)
  })

  it('conserva los errores de celda (#REF!, #VALUE!, #DIV/0!) con su valor original', async () => {
    const file = fixtureFile('menu-fixtures.xlsx')
    const workbook = await reader.readWorkbook(file)

    const menu = workbook.sheets[2]
    const refRow = menu.rows[11]
    expect(refRow[0].type).toBe('error')
    expect(refRow[0].value).toBe('#REF!')

    const recipe = workbook.sheets[1]
    const divRow = recipe.rows[7]
    expect(divRow[3].type).toBe('error')
    expect(divRow[3].value).toBe('#DIV/0!')
  })

  it('readFile expone compatibilidad (sheets como matriz de valores)', async () => {
    const file = fixtureFile('menu-fixtures.xlsx')
    const raw = await reader.readFile(file)

    expect(Object.keys(raw.sheets ?? {})).toHaveLength(6)
    expect(raw.sheetData).toHaveLength(6)
    expect(raw.sheetTypes).toHaveLength(6)
    const menuMatrix = raw.sheets?.['MENÚ AGSTO-JULIO2026-2027'] ?? []
    expect(menuMatrix[3][1]).toBe(46258)
  })
})

describe('SpreadsheetFileReader — XLS binario (BIFF8)', () => {
  it('lee el libro .xls con todas las hojas', async () => {
    const file = fixtureFile('menu-fixtures.xls')
    const workbook = await reader.readWorkbook(file)

    expect(workbook.format).toBe('xls')
    expect(workbook.sheets).toHaveLength(6)
    expect(workbook.sheets[3].normalizedName).toBe('COSTEO REFRIGERIOS')
  })

  it('conserva errores y fechas seriales en .xls', async () => {
    const file = fixtureFile('menu-fixtures.xls')
    const workbook = await reader.readWorkbook(file)

    const menu = workbook.sheets[2]
    expect(menu.rows[11][0].type).toBe('error')
    expect(menu.rows[11][0].value).toBe('#REF!')
    expect(menu.rows[3][1].type).toBe('number')
    expect(menu.rows[3][1].value).toBe(46258)
  })
})

describe('SpreadsheetFileReader — validaciones', () => {
  it('rechaza formatos no soportados', async () => {
    await expect(reader.detectFormat(new File([], 'doc.txt'))).rejects.toThrow('Formato no soportado')
  })

  it('rechaza archivos mayores al máximo permitido', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1)
    const file = csvFile('big.csv', big)
    await expect(reader.readWorkbook(file)).rejects.toThrow('tamaño máximo')
  })

  it('rechaza CSV vacío', async () => {
    const file = csvFile('empty.csv', utf8Bytes(''))
    await expect(reader.readWorkbook(file)).rejects.toThrow('no contiene datos')
  })
})
