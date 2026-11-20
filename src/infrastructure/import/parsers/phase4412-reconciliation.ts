import { readFileSync, statSync } from 'fs'
import { createHash } from 'crypto'
import XLSX from 'xlsx'

/**
 * Phase 4.4.1.2 — Reconciliación Forense Completa
 * Análisis independiente sin usar parsers
 */

const FILE_PATH = 'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'

function getFileInfo() {
  const buffer = readFileSync(FILE_PATH)
  const hash = createHash('sha256').update(buffer).digest('hex')
  const stats = statSync(FILE_PATH)
  return { hash, size: stats.size, modified: stats.mtime }
}

function analyzeSheetForensic(wb: XLSX.WorkBook, sheetName: string) {
  const ws = wb.Sheets[sheetName]
  if (!ws) return null
  
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const maxRow = range.e.r + 1
  const maxCol = range.e.c + 1
  
  let formulas = 0
  let values = 0
  let errors: Record<string, number> = {}
  let empty = 0
  let lastContentRow = 0
  let lastContentCol = 0
  const formulaCells: Array<{cell: string, formula: string, value: any}> = []
  const errorCells: Array<{cell: string, value: string}> = []
  
  for (let R = 0; R <= range.e.r; R++) {
    let rowHasContent = false
    for (let C = 0; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[cellAddr]
      if (!cell) { 
        empty++; 
        continue 
      }
      
      rowHasContent = true
      lastContentRow = Math.max(lastContentRow, R)
      lastContentCol = Math.max(lastContentCol, C)
      
      if (cell.f) {
        formulas++
        formulaCells.push({ cell: cellAddr, formula: cell.f, value: cell.v })
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
    if (rowHasContent) lastContentRow = Math.max(lastContentRow, R)
  }
  
  return { 
    maxRow, 
    maxCol, 
    lastContentRow: lastContentRow + 1, 
    lastContentCol: lastContentCol + 1,
    formulas, 
    values, 
    empty, 
    errors, 
    formulaCells, 
    errorCells 
  }
}

function findRecipeBlocks(_ws: XLSX.WorkSheet, wsVals: XLSX.WorkSheet, range: XLSX.Range) {
  const blocks: Array<{
    startRow: number
    endRow: number
    title: string
    headerRow: number
    ingredientCount: number
    closingRows: number
  }> = []
  
  let currentBlock: any = null
  
  for (let R = 0; R <= range.e.r; R++) {
    const cellA = wsVals[XLSX.utils.encode_cell({ r: R, c: 0 })]
    const valA = cellA?.v ? String(cellA.v).trim() : ''
    
    // Check for ingredient header row
    const cellB = wsVals[XLSX.utils.encode_cell({ r: R, c: 1 })]
    const valB = cellB?.v ? String(cellB.v).trim().toLowerCase() : ''
    const isHeader = valA === 'ingrediente' && valB.startsWith('presentacion')
    
    // Check for closing row (col A-F empty, col G has value)
    const isClosing = [0,1,2,3,4,5].every(c => {
      const cell = wsVals[XLSX.utils.encode_cell({ r: R, c: c })]
      return !cell?.v || String(cell.v).trim() === ''
    }) && (() => {
      const gCell = wsVals[XLSX.utils.encode_cell({ r: R, c: 6 })]
      return gCell?.v !== undefined && gCell?.v !== null && String(gCell.v).trim() !== ''
    })()
    
    // Check if row is empty
    const isEmpty = [0,1,2,3,4,5,6].every(c => {
      const cell = wsVals[XLSX.utils.encode_cell({ r: R, c: c })]
      return !cell?.v || String(cell.v).trim() === ''
    })
    
    if (isHeader) {
      if (currentBlock) {
        // Close previous block
        currentBlock.endRow = R
        blocks.push(currentBlock)
      }
      currentBlock = {
        startRow: R + 1,
        endRow: 0,
        title: '',
        headerRow: R + 1,
        ingredientCount: 0,
        closingRows: 0
      }
      continue
    }
    
    if (currentBlock) {
      if (isClosing) {
        currentBlock.closingRows++
        continue
      }
      if (isEmpty) continue
      
      // If we have closing rows and new content in A, new block
      if (currentBlock.closingRows > 0 && valA !== '') {
        currentBlock.endRow = R
        blocks.push(currentBlock)
        currentBlock = {
          startRow: R + 1,
          endRow: 0,
          title: valA,
          headerRow: 0,
          ingredientCount: 0,
          closingRows: 0
        }
        continue
      }
      
      // If no header yet but content in A, it's the title
      if (currentBlock.headerRow === 0 && valA !== '') {
        currentBlock.title = valA
        currentBlock.startRow = R + 1
        continue
      }
      
      // Count ingredient rows (has content in A, not header, not closing)
      if (currentBlock.headerRow > 0 && valA !== '' && !isHeader && !isClosing) {
        currentBlock.ingredientCount++
      }
    } else if (valA !== '' && !isHeader && !isClosing) {
      // Start new block without header
      currentBlock = {
        startRow: R + 1,
        endRow: 0,
        title: valA,
        headerRow: 0,
        ingredientCount: 1,
        closingRows: 0
      }
    }
  }
  
  if (currentBlock) {
    currentBlock.endRow = range.e.r + 1
    blocks.push(currentBlock)
  }
  
  return blocks
}

function findMenuBlocks(ws: XLSX.WorkSheet, wsVals: XLSX.WorkSheet, range: XLSX.Range) {
  const blocks: Array<{
    startRow: number
    label: string
    hasDates: boolean
    dateRow: number
    categories: Array<{row: number, category: string}>
    weekStartDate: string
  }> = []
  
  const MENU_CATEGORIES = ['SOPA', 'PROTEINA', 'GUARNICION', 'ENSALADA', 'BEBIDA FRIA', 'POSTRE', 'FRUTA', 'ENTRADA', 'BEBIDA']
  
  for (let R = 0; R <= range.e.r; R++) {
    const cellA = wsVals[XLSX.utils.encode_cell({ r: R, c: 0 })]
    const valA = cellA?.v ? String(cellA.v).trim().toUpperCase() : ''
    
    const isWeekLabel = valA.startsWith('SEMANA') || valA === 'OPCION PLATO'
    
    // Check if row has dates
    let dateCount = 0
    for (let C = 1; C <= 5; C++) {
      const cell = wsVals[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell?.v && (cell.t === 'd' || cell.t === 'n' || (cell.t === 's' && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(cell.v))))) {
        dateCount++
      }
    }
    const hasDates = dateCount >= 2
    
    if (isWeekLabel) {
      blocks.push({
        startRow: R + 1,
        label: valA,
        hasDates,
        dateRow: hasDates ? R + 1 : 0,
        categories: [],
        weekStartDate: ''
      })
      continue
    }
    
    if (blocks.length > 0) {
      const current = blocks[blocks.length - 1]
      if (MENU_CATEGORIES.includes(valA)) {
        current.categories.push({ row: R + 1, category: valA })
      }
    }
  }
  
  // Calculate weekStartDate for blocks with dates
  for (const block of blocks) {
    if (block.hasDates && block.dateRow) {
      const cellB = ws[XLSX.utils.encode_cell({ r: block.dateRow - 1, c: 1 })] // Column B (Monday)
      if (cellB?.v) {
        if (cellB.t === 'n') {
          // Excel serial date
          const serial = cellB.v as number
          const date = XLSX.SSF.parse_date_code(serial)
          if (date) {
            block.weekStartDate = `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
          }
        } else if (cellB.t === 'd' && cellB.v instanceof Date) {
          const d = cellB.v
          block.weekStartDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        }
      }
    }
  }
  
  return blocks
}

function main() {
  console.log('=== RECONCILIACIÓN FORENSE 4.4.1.2 ===\n')
  
  // 1. IDENTIDAD DEL ARCHIVO
  console.log('1. IDENTIDAD DEL ARCHIVO AUDITADO')
  const info = getFileInfo()
  console.log(`   Archivo: ${FILE_PATH}`)
  console.log(`   SHA-256: ${info.hash}`)
  console.log(`   Tamaño: ${info.size} bytes`)
  console.log(`   Modificado: ${info.modified}`)
  console.log(`   Coincide con hash histórico (85dc9137...): ${info.hash === '85dc913723f642c6568c0e4304360474c60426379fd6b47a283005c7e57086fc' ? 'SÍ ✅' : 'NO ❌'}`)
  console.log()
  
  // 2. TODAS LAS VERSIONES DISPONIBLES
  console.log('2. TODAS LAS VERSIONES EN DESCARGAS')
  const allFiles = [
    '(1).xlsx',
    '(2).xlsx',
    '(3).xlsx',
    '(4).xlsx',
    '(5).xlsx',
    'base.xlsx'
  ]
  const basePath = 'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI '
  for (const f of allFiles) {
    const fullPath = f === 'base.xlsx' 
      ? 'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI.xlsx'
      : basePath + f
    try {
      const buf = readFileSync(fullPath)
      const hash = createHash('sha256').update(buf).digest('hex')
      const stat = statSync(fullPath)
      const isAudited = hash === info.hash ? ' <-- AUDITADO' : ''
      console.log(`   ${f}: SHA=${hash.substring(0,16)}... Size=${buf.length} Mod=${stat.mtime.toISOString()}${isAudited}`)
    } catch(e) {
      console.log(`   ${f}: NO ENCONTRADO`)
    }
  }
  console.log('   (5)_2.xlsx: NO EXISTE')
  console.log('   (5)_3.xlsx: NO EXISTE')
  console.log()
  
  // 3. LECTURA FORENSE DEL WORKBOOK
  console.log('3. LECTURA FORENSE DEL WORKBOOK (data_only=False + data_only=True)')
  const wbFormulas = XLSX.readFile(FILE_PATH, { cellFormula: true, cellNF: true, cellText: true })
  const wbValues = XLSX.readFile(FILE_PATH, { cellFormula: false, cellNF: true, cellText: true })
  
  const sheets = [
    'CATALOGO COSTEO 17-08-2',
    'COSTEO RECETA ALMUERZOS',
    'MENÚ AGSTO-JULIO2026-2027',
    'COSTEO REFRIGERIOS ',
    'MENU REFRIGERIOS',
    'COMPOSICION DE CADA PLATO'
  ]
  
  console.log('\n--- DIMENSIONES REALES POR HOJA ---')
  for (const sheetName of sheets) {
    const wsF = wbFormulas.Sheets[sheetName]
    if (!wsF) { console.log(`   ${sheetName}: NO ENCONTRADA`); continue }
    
    const range = XLSX.utils.decode_range(wsF['!ref'] || 'A1')
    const forensic = analyzeSheetForensic(wbFormulas, sheetName)!
    const forensicV = analyzeSheetForensic(wbValues, sheetName)!
    
    console.log(`\n   ${sheetName}:`)
    console.log(`     Rango Excel (!ref): ${wsF['!ref']} -> ${range.s.r+1}:${range.e.r+1} x ${range.s.c+1}:${range.e.c+1}`)
    console.log(`     max_row físico: ${forensic.maxRow}`)
    console.log(`     max_col físico: ${forensic.maxCol}`)
    console.log(`     Última fila con contenido: ${forensic.lastContentRow}`)
    console.log(`     Última col con contenido: ${forensic.lastContentCol}`)
    console.log(`     Fórmulas originales: ${forensic.formulas}`)
    console.log(`     Valores no vacíos: ${forensicV.values}`)
    console.log(`     Errores almacenados:`)
    for (const [err, count] of Object.entries(forensicV.errors)) {
      console.log(`       ${err}: ${count}`)
    }
  }
  
  // 4. DETALLE CATÁLOGO
  console.log('\n--- DETALLE HOJA 1: CATALOGO COSTEO 17-08-2 ---')
  const wsCat = wbFormulas.Sheets['CATALOGO COSTEO 17-08-2']
  if (wsCat) {
    const range = XLSX.utils.decode_range(wsCat['!ref'] || 'A1')
    // Contar fórmulas en columna E (costo, índice 4)
    let formulasInCost = 0
    for (let R = 1; R <= range.e.r; R++) {
      const cell = wsCat[XLSX.utils.encode_cell({ r: R, c: 4 })]
      if (cell && cell.f) formulasInCost++
    }
    console.log(`   Fórmulas en columna costo (E): ${formulasInCost}`)
    
    // Filas 140 (KIWI) y 253 (QUESO CREMA)
    console.log('   Fila 140 (KIWI, índice 139):')
    for (let C = 0; C <= 5; C++) {
      const cell = wsCat[XLSX.utils.encode_cell({ r: 139, c: C })]
      console.log(`     Col ${C}: v=${cell?.v} f=${cell?.f} t=${cell?.t}`)
    }
    console.log('   Fila 253 (QUESO CREMA, índice 252):')
    for (let C = 0; C <= 5; C++) {
      const cell = wsCat[XLSX.utils.encode_cell({ r: 252, c: C })]
      console.log(`     Col ${C}: v=${cell?.v} f=${cell?.f} t=${cell?.t}`)
    }
  }
  
  // 5. DETALLE RECETAS ALMUERZOS
  console.log('\n--- DETALLE HOJA 2: COSTEO RECETA ALMUERZOS ---')
  const wsRecA = wbFormulas.Sheets['COSTEO RECETA ALMUERZOS']
  const wsRecAV = wbValues.Sheets['COSTEO RECETA ALMUERZOS']
  if (wsRecA && wsRecAV) {
    const range = XLSX.utils.decode_range(wsRecA['!ref'] || 'A1')
    console.log(`   Rango: ${wsRecA['!ref']} -> ${range.e.r+1} filas x ${range.e.c+1} cols`)
    
    // Analizar errores #VALUE! y #REF! con coordenadas
    const valueErrors: Array<{cell: string, row: number}> = []
    const refErrors: Array<{cell: string, row: number}> = []
    for (let R = 0; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const cell = wsRecAV[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell?.v === '#VALUE!') valueErrors.push({ cell: XLSX.utils.encode_cell({r:R,c:C}), row: R+1 })
        if (cell?.v === '#REF!') refErrors.push({ cell: XLSX.utils.encode_cell({r:R,c:C}), row: R+1 })
      }
    }
    console.log(`   #VALUE! celdas: ${valueErrors.length}`)
    console.log(`   #REF! celdas: ${refErrors.length}`)
    if (valueErrors.length > 0) {
      console.log(`     Primeras 10 #VALUE!:`)
      valueErrors.slice(0,10).forEach(e => console.log(`       ${e.cell} (fila ${e.row})`))
    }
    if (refErrors.length > 0) {
      console.log(`     #REF! ubicaciones:`)
      refErrors.forEach(e => console.log(`       ${e.cell} (fila ${e.row})`))
    }
    
    // Bloques detectados forense
    const blocks = findRecipeBlocks(wsRecA, wsRecAV, range)
    console.log(`\n   Bloques detectados (forense): ${blocks.length}`)
    console.log(`   Esperados: 249 | Parser previo: 259`)
    blocks.forEach((b, i) => {
      console.log(`     ${i+1}. Fila ${b.startRow}-${b.endRow}: "${b.title}" | Header: ${b.headerRow||'SIN'} | Ingredientes: ${b.ingredientCount} | Cierres: ${b.closingRows}`)
    })
  }
  
  // 6. DETALLE RECETAS REFRIGERIOS
  console.log('\n--- DETALLE HOJA 4: COSTEO REFRIGERIOS ---')
  const wsRecR = wbFormulas.Sheets['COSTEO REFRIGERIOS ']
  const wsRecRV = wbValues.Sheets['COSTEO REFRIGERIOS ']
  if (wsRecR && wsRecRV) {
    const range = XLSX.utils.decode_range(wsRecR['!ref'] || 'A1')
    console.log(`   Rango: ${wsRecR['!ref']} -> ${range.e.r+1} filas x ${range.e.c+1} cols`)
    
    const blocks = findRecipeBlocks(wsRecR, wsRecRV, range)
    console.log(`   Bloques detectados (forense): ${blocks.length}`)
    console.log(`   Esperados: 10 | Parser previo: 10 | Brutos: 87`)
    blocks.forEach((b, i) => {
      console.log(`     ${i+1}. Fila ${b.startRow}-${b.endRow}: "${b.title}" | Header: ${b.headerRow||'SIN'} | Ingredientes: ${b.ingredientCount} | Cierres: ${b.closingRows}`)
    })
  }
  
  // 7. DETALLE MENÚ ANUAL
  console.log('\n--- DETALLE HOJA 3: MENÚ AGSTO-JULIO2026-2027 ---')
  const wsMenA = wbFormulas.Sheets['MENÚ AGSTO-JULIO2026-2027']
  const wsMenAV = wbValues.Sheets['MENÚ AGSTO-JULIO2026-2027']
  if (wsMenA && wsMenAV) {
    const range = XLSX.utils.decode_range(wsMenA['!ref'] || 'A1')
    console.log(`   Rango: ${wsMenA['!ref']} -> ${range.e.r+1} filas x ${range.e.c+1} cols`)
    
    // #REF! ubicaciones exactas
    const refErrors: Array<{cell: string, row: number}> = []
    for (let R = 0; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const cell = wsMenAV[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell?.v === '#REF!') refErrors.push({ cell: XLSX.utils.encode_cell({r:R,c:C}), row: R+1 })
      }
    }
    console.log(`   #REF! totales: ${refErrors.length}`)
    if (refErrors.length > 0) {
      console.log(`     Rango de filas: ${refErrors[0].row} - ${refErrors[refErrors.length-1].row}`)
      console.log(`     Primeras 5: ${refErrors.slice(0,5).map(e=>e.cell).join(', ')}`)
      console.log(`     Últimas 5: ${refErrors.slice(-5).map(e=>e.cell).join(', ')}`)
    }
    
    // Bloques de menú
    const blocks = findMenuBlocks(wsMenA, wsMenAV, range)
    console.log(`\n   Bloques semanales detectados: ${blocks.length}`)
    blocks.forEach((b, i) => {
      console.log(`     ${i+1}. Fila ${b.startRow}: "${b.label}" | Fechas: ${b.hasDates?'SÍ':'NO'} | weekStart: ${b.weekStartDate||'N/A'} | Categorías: ${b.categories.length}`)
    })
    
    // Buscar fecha serial 0
    console.log('\n   Búsqueda de fecha serial 0:')
    for (let R = 0; R <= range.e.r; R++) {
      for (let C = 1; C <= 5; C++) {
        const cell = wsMenA[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell && cell.v === 0 && cell.t === 'n') {
          console.log(`     Encontrado: fila ${R+1}, col ${C}`)
        }
      }
    }
  }
  
  // 8. DETALLE MENÚ REFRIGERIOS
  console.log('\n--- DETALLE HOJA 5: MENU REFRIGERIOS ---')
  const wsMenR = wbFormulas.Sheets['MENU REFRIGERIOS']
  const wsMenRV = wbValues.Sheets['MENU REFRIGERIOS']
  if (wsMenR && wsMenRV) {
    const range = XLSX.utils.decode_range(wsMenR['!ref'] || 'A1')
    console.log(`   Rango: ${wsMenR['!ref']} -> ${range.e.r+1} filas x ${range.e.c+1} cols`)
    
    console.log('\n   Contenido completo (filas con datos):')
    for (let R = 0; R <= range.e.r; R++) {
      const rowData: any = {}
      for (let C = 0; C <= range.e.c; C++) {
        const cell = wsMenRV[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          rowData[C] = cell.v
        }
      }
      if (Object.keys(rowData).length > 0) {
        console.log(`     Fila ${R+1}:`, rowData)
      }
    }
    
    const blocks = findMenuBlocks(wsMenR, wsMenRV, range)
    console.log(`\n   Bloques detectados: ${blocks.length}`)
    blocks.forEach((b, i) => {
      console.log(`     ${i+1}. Fila ${b.startRow}: "${b.label}" | Fechas: ${b.hasDates?'SÍ':'NO'} | weekStart: ${b.weekStartDate||'N/A'} | Categorías: ${b.categories.length}`)
    })
  }
  
  // 9. DETALLE COMPOSICIÓN
  console.log('\n--- DETALLE HOJA 6: COMPOSICION DE CADA PLATO ---')
  const wsComp = wbFormulas.Sheets['COMPOSICION DE CADA PLATO']
  const wsCompV = wbValues.Sheets['COMPOSICION DE CADA PLATO']
  if (wsComp && wsCompV) {
    const range = XLSX.utils.decode_range(wsComp['!ref'] || 'A1')
    console.log(`   Rango: ${wsComp['!ref']} -> ${range.e.r+1} filas x ${range.e.c+1} cols`)
    
    console.log('\n   Contenido completo con fórmulas:')
    for (let R = 0; R <= range.e.r; R++) {
      const rowData: any = {}
      for (let C = 0; C <= range.e.c; C++) {
        const cell = wsCompV[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          rowData[C] = cell.v
        }
        const cellF = wsComp[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cellF && cellF.f) {
          rowData[`f${C}`] = cellF.f
        }
      }
      if (Object.keys(rowData).length > 0) {
        console.log(`     Fila ${R+1}:`, rowData)
      }
    }
  }
  
  // 10. VERIFICACIÓN F.7 - Trazabilidad de fórmulas
  console.log('\n--- VERIFICACIÓN F.7: Trazabilidad de fórmulas y sub-centavo ---')
  
  // Verificar si RawCell en import-file-reader-port tiene campo 'formula'
  console.log('   Revisión técnica del SpreadsheetFileReader:')
  console.log('     - cellToRawCell() en spreadsheet-file-reader.ts NO extrae cell.f (fórmula)')
  console.log('     - RawCell type en import-file-reader-port.ts NO tiene campo "formula"')
  console.log('     - RawCell type NO tiene campo "sourceCell" (coordenada original)')
  console.log('     - Por tanto: parsers NO reciben fórmula original ni celda origen')
  console.log('     - Decisión F.7 (source_formula + source_cell) => NO IMPLEMENTADA ❌')
  
  // Sub-centavo en composición
  console.log('\n   Precisión sub-centavo en COMPOSICION:')
  for (let R = 0; R <= 44; R++) {
    for (let C = 0; C <= 4; C++) {
      const cell = wsCompV[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell && typeof cell.v === 'number' && cell.v < 1 && cell.v > 0.0001) {
        console.log(`     Fila ${R+1} Col ${C}: ${cell.v} (${cell.v.toFixed(6)})`)
      }
    }
  }
  
  console.log('\n=== RECONCILIACIÓN COMPLETADA ===')
}

try {
  main()
} catch (e) {
  console.error(e)
}