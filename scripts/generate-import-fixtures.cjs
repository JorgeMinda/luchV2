/**
 * Genera fixtures binarios reales (xlsx y xls) para las pruebas del lector
 * y parsers de importación (Fase 3). Ejecutar: node scripts/generate-import-fixtures.cjs
 *
 * Los fixtures reproducen la estructura del documento real
 * `17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (4).xlsx`
 * con datos sintéticos representativos: múltiples hojas, nombre de hoja con
 * espacio final, fechas seriales, fechas texto D/M y errores de celda
 * (#REF!, #VALUE!, #DIV/0!).
 */
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const FIXTURES_DIR = path.join(__dirname, '..', 'src', 'infrastructure', 'import', '__fixtures__')

const ERROR_CELLS = {
  ref: { t: 'e', v: 0x1a, w: '#REF!' },
  value: { t: 'e', v: 0x0f, w: '#VALUE!' },
  div0: { t: 'e', v: 0x07, w: '#DIV/0!' },
}

function aoaToSheet(aoa) {
  const ws = {}
  aoa.forEach((row, r) => {
    row.forEach((value, c) => {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (value && typeof value === 'object' && 't' in value) {
        ws[addr] = value
      } else if (value !== null && value !== undefined && value !== '') {
        ws[addr] = { t: typeof value === 'number' ? 'n' : 's', v: value }
      }
    })
  })
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: aoa.length - 1, c: Math.max(...aoa.map((r) => r.length)) - 1 },
  })
  return ws
}

function catalogSheet() {
  return aoaToSheet([
    ['CÓDIGO', 'BODEGA', 'PRODUCTO', 'Presentación', 'costo', 'estado', 'Columna 1'],
    ['1', 'NO PERECIBLES', 'ACEITE DE PRUEBA 20 LT', '20 LITROS', 35.6, 'ACTIVO', ''],
    ['2', 'FRUTAS Y VEGETALES', 'ACELGA 500 GR', 'ATADO', 0.5, 'ACTIVO', ''],
    ['3', 'NO PERECIBLES', 'AJI PERUANO POLVO/350 GR', 'UNIDAD', 3, 'ACTIVO', ''],
    ['4', 'FRUTAS Y VEGETALES', 'AGUACATE/UNIDAD', 'UNIDAD', null, 'ACTIVO', ''],
    ['5', 'NO PERECIBLES', 'ACEITE DE OLIVA 500 ML', 'BOTELLA', '#REF!', 'ACTIVO', ''],
    ['6', 'NO PERECIBLES', 'ARROZ DE PRUEBA 1 LB', 'LIBRA', 1.25, 'INACTIVO', ''],
    ['7', 'FRUTAS Y VEGETALES', 'MANZANA DE PRUEBA', 'UNIDAD', 0.4, 'PENDIENTE', ''],
    ['8', 'NO PERECIBLES', 'SAL YODADA 1 KG', 'BOLSA', 0.49, 'ACTIVO', ''],
  ])
}

function recipeBlock(title, ingredients, closingNumbers) {
  const rows = [
    ['INGREDIENTES', 'GRAMAJES', 'PVP', 'PRESENTACIÓN ', 'COSTO POR GR', 'CANTIDAD RECETA ', 'TOTAL COSTO ', 'PROMEDIOS '],
    [title, '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['Ingrediente', 'Presentación de compra', 'PVP compra', 'Cantidad de compra-presentación', 'Costo por gr-o unidad', 'Cantidad en receta', 'Costo en receta', ''],
  ]
  for (const ing of ingredients) {
    rows.push(ing)
  }
  for (const closing of closingNumbers) {
    rows.push(['', '', '', '', '', '', closing, ''])
  }
  return rows
}

function recipeAlmuerzosSheet() {
  const rows = [
    ...recipeBlock(
      'SOPA DE PRUEBA/12 ONZAS',
      [
        ['HUESO DE RES 1 KILO', '1kg', 1.45, 1000, 0.00145, 25, 0.04, ''],
        ['CHIFLES PROCESADOS 300 GR', 'UNIDAD', 1.0, 300, 0.00333, 15, 0.05, ''],
        ['PIMIENTA LB', '1KG', 1.16, 1000, 0.00116, 2, 0.01, ''],
        ['INGREDIENTE DIV CERO', '1KG', 1.16, '#DIV/0!', 0.00116, 2, 0.01, ''],
      ],
      [0.5, 0.025, 0.015, 0.54, '$ -', 0.54],
    ),
    // Columna auxiliar I con #VALUE!: debe ignorarse.
    ['', '', '', '', '', '', '', 200, '#VALUE!'],
    ...recipeBlock(
      'ARROZ/35 GRAMOS',
      [['ARROZ MACAREÑO ARROBA', '25LB', 12.98, 11325, 0.001147, 50, 0.06, '']],
      [0.1, 0.005, 0.003, 0.108, '$ -', 0.108],
    ),
  ]
  return aoaToSheet(rows)
}

function recipeRefrigeriosSheet() {
  return aoaToSheet(
    recipeBlock(
      'GRANOLA-YOGURT-ENSALADA DE FRUTAS',
      [
        ['GRANOLA 250 GR - EL ARTESANAL', '250GR', 1.95, 250, 0.0078, 25, 0.2, ''],
        ['YOGURT NATURAL VITA 900 ML', '900ML', 1.16, 900, 0.00129, 28.4, 0.04, ''],
      ],
      [0.36, 0.018, 0.0108, 0.3888, '$ -', 0.3888],
    ),
  )
}

function menuAnualSheet() {
  return aoaToSheet([
    ['MENÚ DE AGOSTO 2026', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['SEMANA 1', '', '', '', '', ''],
    ['SEMANA 1', 46258, 46259, 46260, 46261, 46262],
    ['SOPA', 'Sopa de prueba 1', 'Sopa de prueba 2', 'Sopa de prueba 3', 'Sopa de prueba 4', 'Sopa de prueba 5'],
    ['PROTEINA', 'Pollo de prueba', 'Pescado de prueba', 'Cerdo de prueba', 'Res de prueba', 'Huevo de prueba'],
    ['GUARNICION', 'Purée de prueba', 'Papa de prueba', 'Arroz de prueba', 'Yuca de prueba', 'Menestra de prueba'],
    ['ENSALADA', 'Lechuga, tomate', 'Tomate, zanahoria', 'Cebolla, perejil', 'Aguacate, lechuga', 'Remolacha, tomate'],
    ['BEBIDA FRIA', 'Jugo de papaya', 'Jugo de mora', 'Limonada', 'Jugo de guayaba', 'Horchata'],
    ['POSTRE', 'Flan de prueba', 'Gelatina de prueba', 'Torta de prueba', 'Muffin de prueba', 'Fruta de prueba'],
    ['FRUTA', 'Piña', 'Fresas', 'Melón', 'Manzana', 'Guineo'],
    // Referencias externas rotas (simulan las ≈884 celdas del documento real)
    ['#REF!', '#REF!', '#REF!', '#REF!', '#REF!', '#REF!'],
    ['#REF!', '#REF!', '#REF!', '#REF!', '#REF!', '#REF!'],
    ['SEMANA 2', '', '', '', '', ''],
    ['SEMANA 2', 46265, 46266, 46267, 46268, 46269],
    ['SOPA', 'Sopa de prueba 6', 'Sopa de prueba 7', 'Sopa de prueba 8', 'Sopa de prueba 9', 'Sopa de prueba 10'],
    ['PROTEINA', 'Pollo a la prueba', 'Pescado a la prueba', 'Cerdo a la prueba', 'Res a la prueba', 'Huevo a la prueba'],
    ['FRUTA', 'Sandia', 'Pera', 'Naranja', 'Durazno', 'Mandarina'],
  ])
}

function menuRefrigeriosSheet() {
  return aoaToSheet([
    ['OPCION PLATO', '31/8/2026', '1/9/2026', '2/9/2026', '3/9/2026', '4/9/2026'],
    ['FRUTA', 'Ensalada de frutas', 'Melón', 'Piña', 'Mandarina', 'Duraznos'],
    ['BEBIDA', 'Yogurt natural', 'Jugo de naranjilla', 'Jugo guanabana', 'Jugo de mora', 'Jugo de piña'],
    ['ENTRADA', 'Granola', 'Tortilla de choclo', 'Tortillas verde', 'Chocho tostado', 'Arepa con carne'],
    ['', '', '', '', '', ''],
    ['OPCION PLATO', '7/9/2026', '8/9/2026', '9/9/2026', '10/9/2026', '11/9/2026'],
    ['FRUTA', 'Frutillas', 'Manzana', 'Melón', 'Sandia', 'Pera'],
    ['BEBIDA', 'Chocolate frío', 'Jugo de mango', 'Yogurt de frutilla', 'Jugo de mora', 'Jugo de naranja'],
    ['ENTRADA', 'Torta de naranja', 'Arepa con carne molida', 'Granola', 'Bolón de verde queso', 'Ensalada cesar'],
  ])
}

function mealCompositionSheet() {
  return aoaToSheet([
    ['Almuerzo Saludable Estudiantil', '', '', '', ''],
    ['Componente', 'Cantidad', 'Unidad', 'Costo Unitario', 'Costo por Porción'],
    ['PROTEINA', 100, 'GR', 0.0072, '$0.72'],
    ['GUARNICION', 50, 'GR', 0.001, '$0.05'],
    ['ARROZ', 40, 'GR', 0.003, '$0.12'],
    ['ENSALADA', 55, 'GR', 0.002, '$0.11'],
    ['FRUTA', 37, 'GR', 0.003, '$0.11'],
    ['Salsas', 3, 'GR', 0.004, '$0.01'],
    ['JUGO', 8, 'ONZ', 0.014, '$0.11'],
    ['', '', '', '', '$1.24'],
    ['', '', '', '', ''],
    ['Almuerzo Estudiantil Completo Especial', '', '', '', ''],
    ['Componente', 'Cantidad', 'Unidad', 'Costo Unitario', 'Costo por Porción'],
    ['SOPA', 10, 'ONZ', 0.015, '$0.15'],
    ['PROTEINA', 100, 'GR', 0.0072, '$0.72'],
    ['GUARNICION', 48, 'GR', 0.001, '$0.05'],
    ['ARROZ', 41, 'GR', 0.003, '$0.12'],
    ['ENSALADA', 42, 'GR', 0.002, '$0.08'],
    ['POSTRE MASA', 45, 'GR', 0.003, '$0.14'],
    ['Salsas', 3, 'GR', 0.004, '$0.01'],
    ['JUGO', 8, 'ONZ', 0.014, '$0.11'],
    ['', '', '', '', '$1.38'],
    ['', '', '', '', ''],
    ['Refrigerio prescolar/Primaria', '', '', '', ''],
    ['Componente', 'Cantidad', 'Unidad', 'Costo Unitario', 'Costo por Porción'],
    ['PROTEÍNA', 60, 'GR', 0.0047, '$0.28'],
    ['GUARNICIÓN', 40, 'GR', 0.0036, '$0.14'],
    ['ENSALADA', 15, 'GR', 0.0064, '$0.10'],
    ['FRUTA', 25, 'GR', 0.0064, '$0.16'],
    ['JUGO', 8, 'ONZ', 0.02, '$0.16'],
    ['', '', '', '', '$0.84'],
    ['', '', '', '', ''],
    ['Almuerzo Completo Administrativos', '', '', '', ''],
    ['Componente', 'Cantidad', 'Unidad', 'Costo Unitario', 'Costo por Porción'],
    ['SOPA', 12, 'ONZ', 0.015, '$0.18'],
    ['PROTEINA', 110, 'GR', 0.0072, '$0.79'],
    ['GUARNICION', 60, 'GR', 0.001, '$0.06'],
    ['ARROZ', 35, 'GR', 0.003, '$0.11'],
    ['ENSALADA', 42, 'GR', 0.002, '$0.08'],
    ['EXTRA DESCONOCIDO', 20, 'KK', 0.01, '$0.20'],
    ['POSTRE/masa o fruta', 45, 'GR', 0.0023, '$0.10'],
    ['Salsas', 2, 'GR', 0.004, '$0.01'],
    ['JUGO', 8, 'ONZ', 0.014, '$0.11'],
    ['', '', '', '', '$1.44'],
  ])
}

function buildWorkbook() {
  return {
    SheetNames: [
      'CATALOGO COSTEO 17-08-2',
      'COSTEO RECETA ALMUERZOS',
      'MENÚ AGSTO-JULIO2026-2027',
      'COSTEO REFRIGERIOS ',
      'MENU REFRIGERIOS',
      'COMPOSICION DE CADA PLATO',
    ],
    Sheets: {
      'CATALOGO COSTEO 17-08-2': catalogSheet(),
      'COSTEO RECETA ALMUERZOS': recipeAlmuerzosSheet(),
      'MENÚ AGSTO-JULIO2026-2027': menuAnualSheet(),
      'COSTEO REFRIGERIOS ': recipeRefrigeriosSheet(),
      'MENU REFRIGERIOS': menuRefrigeriosSheet(),
      'COMPOSICION DE CADA PLATO': mealCompositionSheet(),
    },
  }
}

if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true })
}

const workbook = buildWorkbook()

const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
fs.writeFileSync(path.join(FIXTURES_DIR, 'menu-fixtures.xlsx'), xlsxBuffer)

const xlsBuffer = XLSX.write(workbook, { bookType: 'biff8', type: 'buffer' })
fs.writeFileSync(path.join(FIXTURES_DIR, 'menu-fixtures.xls'), xlsBuffer)

console.log('Fixtures generados en', FIXTURES_DIR)
console.log('  menu-fixtures.xlsx:', xlsxBuffer.length, 'bytes')
console.log('  menu-fixtures.xls:', xlsBuffer.length, 'bytes')
