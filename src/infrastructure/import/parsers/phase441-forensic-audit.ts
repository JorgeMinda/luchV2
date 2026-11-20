import { readFileSync, statSync } from 'fs'
import { createHash } from 'crypto'
import XLSX from 'xlsx'

/**
 * Phase 4.4.1-DOC — Auditoría forense completa del Excel corregido
 * Lee fórmulas originales (data_only=False) y valores calculados (data_only=True)
 */

const FILE_PATH = 'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'

function getFileInfo() {
  const buffer = readFileSync(FILE_PATH)
  const hash = createHash('sha256').update(buffer).digest('hex')
  const stats = statSync(FILE_PATH)
  return { hash, size: stats.size, modified: stats.mtime }
}

function analyzeSheet(workbook: XLSX.WorkBook, sheetName: string, dataOnly: boolean) {
  const ws = workbook.Sheets[sheetName]
  if (!ws) return null
  
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const rows = range.e.r + 1
  const cols = range.e.c + 1
  
  let formulas = 0
  let values = 0
  let errors: Record<string, number> = { '#VALUE!': 0, '#REF!': 0, '#DIV/0!': 0, '#N/A': 0, '#NAME?': 0, '#NULL!': 0, '#NUM!': 0 }
  let empty = 0
  const errorCells: Array<{cell: string, value: any}> = []
  const formulaCells: Array<{cell: string, formula: string}> = []
  
  for (let R = 0; R <= range.e.r; R++) {
    for (let C = 0; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[cellAddr]
      if (!cell) { empty++; continue }
      
      if (cell.f && !dataOnly) {
        formulas++
        formulaCells.push({ cell: cellAddr, formula: cell.f })
      }
      
      const val = cell.v
      if (val !== undefined && val !== null && val !== '') {
        values++
        const valStr = String(val)
        if (valStr.startsWith('#')) {
          errors[valStr] = (errors[valStr] || 0) + 1
          errorCells.push({ cell: cellAddr, value: valStr })
        }
      } else {
        empty++
      }
    }
  }
  
  return { rows, cols, formulas, values, empty, errors, errorCells, formulaCells }
}

function main() {
  console.log('=== AUDITORÍA FORENSE FASE 4.4.1-DOC ===\n')
  
  const info = getFileInfo()
  console.log('ARCHIVO:', FILE_PATH)
  console.log('SHA-256:', info.hash)
  console.log('Tamaño:', info.size, 'bytes')
  console.log('Modificado:', info.modified)
  console.log()
  
  // Leer CON fórmulas (data_only=false)
  const wbFormulas = XLSX.readFile(FILE_PATH, { cellFormula: true, cellNF: true, cellText: true })
  
  // Leer CON valores calculados (data_only=true)
  const wbValues = XLSX.readFile(FILE_PATH, { cellFormula: false, cellNF: true, cellText: true })
  
  const sheets = [
    'CATALOGO COSTEO 17-08-2',
    'COSTEO RECETA ALMUERZOS',
    'MENÚ AGSTO-JULIO2026-2027',
    'COSTEO REFRIGERIOS ',
    'MENU REFRIGERIOS',
    'COMPOSICION DE CADA PLATO'
  ]
  
  console.log('=== DIMENSIONES Y CONTENIDO POR HOJA ===\n')
  
  // Guardar resultados para uso posterior
  const sheetResults: Record<string, { withFormulas: ReturnType<typeof analyzeSheet>; withValues: ReturnType<typeof analyzeSheet> }> = {}
  
  for (const sheetName of sheets) {
    console.log(`--- ${sheetName} ---`)
    
    const withFormulas = analyzeSheet(wbFormulas, sheetName, false)
    const withValues = analyzeSheet(wbValues, sheetName, true)
    sheetResults[sheetName] = { withFormulas: withFormulas!, withValues: withValues! }
    
    if (!withFormulas || !withValues) {
      console.log('  HOJA NO ENCONTRADA')
      continue
    }
    
    console.log(`  Dimensiones: ${withFormulas.rows} filas × ${withFormulas.cols} columnas`)
    console.log(`  Fórmulas originales: ${withFormulas.formulas}`)
    console.log(`  Valores no vacíos: ${withValues.values}`)
    console.log(`  Celdas vacías: ${withFormulas.empty}`)
    console.log(`  Errores almacenados:`)
    for (const [err, count] of Object.entries(withValues.errors)) {
      if (count > 0) console.log(`    ${err}: ${count}`)
    }
    console.log()
  }
  
  // Análisis detallado HOJA 1: CATALOGO
  console.log('=== DETALLE HOJA 1: CATALOGO COSTEO 17-08-2 ===')
  const ws1 = wbFormulas.Sheets['CATALOGO COSTEO 17-08-2']
  if (ws1) {
    const range1 = XLSX.utils.decode_range(ws1['!ref'] || 'A1')
    console.log(`Filas físicas: ${range1.e.r + 1} (esperado 463)`)
    
    // Verificar encabezados fila 1
    const headers: string[] = []
    for (let C = 0; C <= range1.e.c; C++) {
      const cell = ws1[XLSX.utils.encode_cell({ r: 0, c: C })]
      headers.push(cell ? String(cell.v) : '')
    }
    console.log('Encabezados:', headers)
    
    // Verificar códigos 1-462
    let codesFound = 0
    let emptyCodes = 0
    for (let R = 1; R <= range1.e.r; R++) {
      const cell = ws1[XLSX.utils.encode_cell({ r: R, c: 0 })] // Columna A = Código
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        codesFound++
      } else {
        emptyCodes++
      }
    }
    console.log(`Códigos no vacíos: ${codesFound}`)
    console.log(`Códigos vacíos: ${emptyCodes}`)
    
    // Filas 459-463 (índices 458-462)
    console.log('\nFilas 459-463 (índices 458-462):')
    for (let R = 458; R <= 462; R++) {
      const row: any = {}
      for (let C = 0; C <= Math.min(5, range1.e.c); C++) {
        const cell = ws1[XLSX.utils.encode_cell({ r: R, c: C })]
        row[C] = cell ? { v: cell.v, f: cell.f, t: cell.t } : null
      }
      console.log(`  Fila ${R+1}:`, JSON.stringify(row))
    }
    
    // Fila 140 (KIWI - índice 139): contenido '5*1.00' sin =
    console.log('\nFila 140 (KIWI - índice 139):')
    for (let C = 0; C <= Math.min(5, range1.e.c); C++) {
      const cell = ws1[XLSX.utils.encode_cell({ r: 139, c: C })]
      console.log(`  Col ${C}:`, cell ? { v: cell.v, f: cell.f, t: cell.t } : null)
    }
    
    // Fila 253 (QUESO CREMA - índice 252): contenido '1.0.3'
    console.log('\nFila 253 (QUESO CREMA - índice 252):')
    for (let C = 0; C <= Math.min(5, range1.e.c); C++) {
      const cell = ws1[XLSX.utils.encode_cell({ r: 252, c: C })]
      console.log(`  Col ${C}:`, cell ? { v: cell.v, f: cell.f, t: cell.t } : null)
    }
    
    // Contar fórmulas reales en columna costo (E, índice 4)
    let formulasInCost = 0
    for (let R = 1; R <= range1.e.r; R++) {
      const cell = ws1[XLSX.utils.encode_cell({ r: R, c: 4 })]
      if (cell && cell.f) formulasInCost++
    }
    console.log(`\nFórmulas en columna costo (E): ${formulasInCost} (esperado 22)`)
  }
  
  // Análisis detallado HOJA 2: COSTEO RECETA ALMUERZOS
  console.log('\n=== DETALLE HOJA 2: COSTEO RECETA ALMUERZOS ===')
  const ws2 = wbFormulas.Sheets['COSTEO RECETA ALMUERZOS']
  if (ws2) {
    const range2 = XLSX.utils.decode_range(ws2['!ref'] || 'A1')
    const withFormulas2 = analyzeSheet(wbFormulas, 'COSTEO RECETA ALMUERZOS', false)
    console.log(`Dimensiones: ${range2.e.r + 1} filas × ${range2.e.c + 1} columnas (esperado 4844 × 25)`)
    console.log(`Fórmulas totales: ${withFormulas2?.formulas || 'N/A'} (esperado ~19,370)`)
    
    // Analizar bloques detectados vs esperados
    const ws2Vals = wbValues.Sheets['COSTEO RECETA ALMUERZOS']
    let blocks = 0
    let blockRows: number[] = []
    for (let R = 0; R <= range2.e.r; R++) {
      const cell = ws2Vals[XLSX.utils.encode_cell({ r: R, c: 0 })]
      if (cell && cell.v && typeof cell.v === 'string' && cell.v.trim() !== '') {
        const val = cell.v.trim()
        // Detectar títulos de plato (no encabezados)
        if (val !== 'Ingrediente' && val !== 'Presentación de compra' && val !== 'PVP compra' && 
            val !== 'Cantidad de compra-presentación' && val !== 'Costo por gr-o unidad' &&
            val !== 'Cantidad en receta' && val !== 'Costo en receta' && !val.startsWith('Subtotal') &&
            !val.startsWith('+5%') && !val.startsWith('+3%') && val !== 'Total' && val !== 'Marcador') {
          blocks++
          blockRows.push(R + 1)
        }
      }
    }
    console.log(`Bloques detectados por título en col A: ${blocks} (esperado 249, parser previo 259)`)
    
    // Mostrar primeros 30 títulos
    console.log('Primeros 30 títulos detectados:')
    blockRows.slice(0, 30).forEach((r, i) => {
      const cell = ws2Vals[XLSX.utils.encode_cell({ r: r-1, c: 0 })]
      console.log(`  ${i+1}. Fila ${r}: "${cell?.v}"`)
    })
  }
  
  // Análisis detallado HOJA 3: MENÚ ANUAL
  console.log('\n=== DETALLE HOJA 3: MENÚ AGSTO-JULIO2026-2027 ===')
  const ws3 = wbFormulas.Sheets['MENÚ AGSTO-JULIO2026-2027']
  if (ws3) {
    const range3 = XLSX.utils.decode_range(ws3['!ref'] || 'A1')
    console.log(`Dimensiones: ${range3.e.r + 1} filas × ${range3.e.c + 1} columnas`)
    
    const ws3Vals = wbValues.Sheets['MENÚ AGSTO-JULIO2026-2027']
    let refErrors = 0
    let refErrorRows: number[] = []
    for (let R = 0; R <= range3.e.r; R++) {
      for (let C = 0; C <= range3.e.c; C++) {
        const cell = ws3Vals[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell && cell.v === '#REF!') {
          refErrors++
          if (!refErrorRows.includes(R+1)) refErrorRows.push(R+1)
        }
      }
    }
    console.log(`Celdas #REF! totales: ${refErrors} (esperado 883)`)
    console.log(`Filas con #REF!: ${refErrorRows.length}`)
    if (refErrorRows.length > 0) {
      console.log(`  Primera fila con #REF!: ${refErrorRows[0]}`)
      console.log(`  Última fila con #REF!: ${refErrorRows[refErrorRows.length-1]}`)
    }
    
    // Semanas
    let weeks = 0
    for (let R = 0; R <= range3.e.r; R++) {
      const cell = ws3Vals[XLSX.utils.encode_cell({ r: R, c: 0 })]
      if (cell && cell.v && typeof cell.v === 'string' && cell.v.trim().startsWith('SEMANA')) {
        weeks++
        console.log(`  ${cell.v.trim()} en fila ${R+1}`)
      }
    }
    console.log(`Semanas detectadas: ${weeks} (esperado 14)`)
    
    // Semana con fecha serial 0
    console.log('\nBuscando semana con fecha serial 0...')
    for (let R = 0; R <= range3.e.r; R++) {
      for (let C = 1; C <= 5; C++) {
        const cell = ws3[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell && cell.v === 0 && cell.t === 'n') {
          console.log(`  Fecha serial 0 en fila ${R+1}, col ${C}`)
        }
      }
    }
  }
  
  // Análisis detallado HOJA 4: COSTEO REFRIGERIOS
  console.log('\n=== DETALLE HOJA 4: COSTEO REFRIGERIOS ===')
  const ws4 = wbFormulas.Sheets['COSTEO REFRIGERIOS ']
  if (ws4) {
    const range4 = XLSX.utils.decode_range(ws4['!ref'] || 'A1')
    const withFormulas4 = analyzeSheet(wbFormulas, 'COSTEO REFRIGERIOS ', false)
    console.log(`Dimensiones: ${range4.e.r + 1} filas × ${range4.e.c + 1} columnas (esperado 973 × 13)`)
    console.log(`Fórmulas totales: ${withFormulas4?.formulas}`)
    
    const ws4Vals = wbValues.Sheets['COSTEO REFRIGERIOS ']
    let blocks4 = 0
    for (let R = 0; R <= range4.e.r; R++) {
      const cell = ws4Vals[XLSX.utils.encode_cell({ r: R, c: 0 })]
      if (cell && cell.v && typeof cell.v === 'string' && cell.v.trim() !== '' &&
          cell.v.trim() !== 'Ingrediente' && cell.v.trim() !== 'Presentación de compra' &&
          cell.v.trim() !== 'PVP compra' && cell.v.trim() !== 'Cantidad de compra-presentación' &&
          cell.v.trim() !== 'Costo por gr-o unidad' && cell.v.trim() !== 'Cantidad en receta' &&
          cell.v.trim() !== 'Costo en receta' && !cell.v.trim().startsWith('Subtotal') &&
          !cell.v.trim().startsWith('+5%') && !cell.v.trim().startsWith('+3%') &&
          cell.v.trim() !== 'Total' && cell.v.trim() !== 'Marcador') {
        blocks4++
      }
    }
    console.log(`Bloques detectados: ${blocks4} (esperado 10)`)
  }
  
  // Análisis detallado HOJA 5: MENU REFRIGERIOS
  console.log('\n=== DETALLE HOJA 5: MENU REFRIGERIOS ===')
  const ws5 = wbFormulas.Sheets['MENU REFRIGERIOS']
  if (ws5) {
    const range5 = XLSX.utils.decode_range(ws5['!ref'] || 'A1')
    console.log(`Dimensiones: ${range5.e.r + 1} filas × ${range5.e.c + 1} columnas (esperado 79 × 6)`)
    
    const ws5Vals = wbValues.Sheets['MENU REFRIGERIOS']
    console.log('\nTodas las filas (contenido col A):')
    for (let R = 0; R <= range5.e.r; R++) {
      const row: any = {}
      for (let C = 0; C <= range5.e.c; C++) {
        const cell = ws5Vals[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          row[C] = cell.v
        }
      }
      if (Object.keys(row).length > 0) {
        console.log(`  Fila ${R+1}:`, row)
      }
    }
    
    // Contar bloques OPCION PLATO
    let optionPlato = 0
    for (let R = 0; R <= range5.e.r; R++) {
      const cell = ws5Vals[XLSX.utils.encode_cell({ r: R, c: 0 })]
      if (cell && cell.v && String(cell.v).trim() === 'OPCION PLATO') {
        optionPlato++
        console.log(`  OPCION PLATO en fila ${R+1}`)
      }
    }
    console.log(`\nBloques OPCION PLATO: ${optionPlato} (esperado 14)`)
  }
  
  // Análisis detallado HOJA 6: COMPOSICION
  console.log('\n=== DETALLE HOJA 6: COMPOSICION DE CADA PLATO ===')
  const ws6 = wbFormulas.Sheets['COMPOSICION DE CADA PLATO']
  if (ws6) {
    const range6 = XLSX.utils.decode_range(ws6['!ref'] || 'A1')
    console.log(`Dimensiones: ${range6.e.r + 1} filas × ${range6.e.c + 1} columnas (esperado 45 × 5)`)
    
    const ws6Vals = wbValues.Sheets['COMPOSICION DE CADA PLATO']
    console.log('\nContenido completo:')
    for (let R = 0; R <= range6.e.r; R++) {
      const row: any = {}
      for (let C = 0; C <= range6.e.c; C++) {
        const cell = ws6Vals[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          row[C] = cell.v
        }
        const cellF = ws6[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cellF && cellF.f) {
          row[`f${C}`] = cellF.f
        }
      }
      if (Object.keys(row).length > 0) {
        console.log(`  Fila ${R+1}:`, row)
      }
    }
  }
  
  console.log('\n=== AUDITORÍA FORENSE COMPLETADA ===')
}

try {
  main()
} catch (e) {
  console.error(e)
}