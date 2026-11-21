import { SpreadsheetFileReader } from './src/infrastructure/import/file-reader/spreadsheet-file-reader.js';
import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';

const reader = new SpreadsheetFileReader();
const buffer = readFileSync('C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx');
const file = new File([buffer], 'test.xlsx');

// Also check raw XLSX
const data = new Uint8Array(buffer);
const workbook = XLSX.read(data, { type: 'array', cellDates: true });
console.log('SheetNames:', workbook.SheetNames);
console.log('--- Raw sheet 0 (CATALOGO) ---');
const sheet0 = workbook.Sheets[workbook.SheetNames[0]];
console.log('!ref:', sheet0['!ref']);
const range = XLSX.utils.decode_range(sheet0['!ref']);
for (let row = 0; row <= Math.min(5, range.e.r); row++) {
  const cells = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const addr = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = sheet0[addr];
    cells.push({ addr, v: cell?.v, w: cell?.w, f: cell?.f, t: cell?.t });
  }
  console.log('Row', row, cells);
}
console.log('\n--- Raw sheet 0 rows 138-142 (KIWI) ---');
for (let row = 138; row <= 142; row++) {
  const cells = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const addr = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = sheet0[addr];
    cells.push({ addr, v: cell?.v, w: cell?.w, f: cell?.f, t: cell?.t });
  }
  console.log('Row', row, cells);
}
console.log('\n--- Raw sheet 0 rows 251-255 (QUESO CREMA) ---');
for (let row = 251; row <= 255; row++) {
  const cells = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const addr = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = sheet0[addr];
    cells.push({ addr, v: cell?.v, w: cell?.w, f: cell?.f, t: cell?.t });
  }
  console.log('Row', row, cells);
}