/**
 * clean-menu.js
 * Limpia un CSV de menú semanal (menus.csv) y genera un CSV listo para importar
 * en el panel de catálogo de platillos (DishImportPanel).
 *
 * Uso:
 *   node scripts/clean-menu.js <archivo-entrada.csv> [archivo-salida.csv]
 *
 * Si no se indica archivo de salida, imprime a stdout.
 *
 * Elimina:
 *   - Filas de encabezado de semana ("SEMANA X")
 *   - Filas de fechas
 *   - Filas vacías
 *   - Filas con "#REF!"
 *   - Duplicados (mismo plato en misma categoría)
 *   - Columnas vacías al final
 *
 * Genera columnas: Categoría, Platillo, Descripción
 */

const fs = require('fs');
const path = require('path');

const CATEGORIAS_VALIDAS = new Set([
  'sopa',
  'proteina',
  'guarnicion',
  'ensalada',
  'bebida fria',
  'postre',
  'fruta',
]);

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isWeekRow(text) {
  return /semana/i.test(text);
}

function isDateRow(text) {
  return /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(text);
}

function isRefRow(text) {
  return /#ref/i.test(text);
}

function isEmptyRow(row) {
  return row.every((cell) => String(cell ?? '').trim() === '');
}

function escapeCsvField(value) {
  if (/[",;\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsv(text) {
  // Remover BOM si está presente
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function cleanMenu(inputPath, outputPath) {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const rows = parseCsv(raw);

  const seenKeys = new Set();
  const outputRows = [['Categoría', 'Platillo', 'Descripción']];

  let currentCategory = null;

  for (const row of rows) {
    if (isEmptyRow(row)) continue;

    const firstCell = String(row[0] ?? '').trim();
    const normalizedFirst = normalizeText(firstCell);

    // Detectar fila de categoría (primera celda es una categoría válida)
    if (CATEGORIAS_VALIDAS.has(normalizedFirst)) {
      currentCategory = firstCell;
      continue;
    }

    // Detectar fila de semana o fecha -> saltar
    if (isWeekRow(firstCell) || isDateRow(firstCell)) continue;

    // Detectar fila #REF! -> saltar
    if (isRefRow(firstCell)) continue;

    // Procesar celdas de la fila como platos
    for (let j = 1; j < row.length; j++) {
      const cellValue = String(row[j] ?? '').trim();
      if (!cellValue) continue;
      if (isRefRow(cellValue)) continue;

      const key = `${currentCategory}|${cellValue}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      outputRows.push([currentCategory, cellValue, '']);
    }
  }

  const csv = outputRows.map((r) => r.map(escapeCsvField).join(',')).join('\r\n');

  if (outputPath) {
    fs.writeFileSync(outputPath, `\uFEFF${csv}`, { encoding: 'utf8' });
    console.log(`✅ CSV limpio generado: ${outputPath}`);
    console.log(`   ${outputRows.length - 1} platos únicos importados`);
  } else {
    process.stdout.write(`\uFEFF${csv}`);
  }
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath) {
  console.error('Uso: node scripts/clean-menu.js <archivo-entrada.csv> [archivo-salida.csv]');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`❌ No se encuentra el archivo: ${inputPath}`);
  process.exit(1);
}

cleanMenu(inputPath, outputPath);
