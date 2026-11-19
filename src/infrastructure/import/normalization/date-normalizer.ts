/**
 * Normalizador de fechas para importación de datos.
 *
 * Reglas del contrato (Fase 3):
 * - Soporta ISO 8601, `M/D/YYYY` (estadounidense, ej. 8/24/2026),
 *   `DD-MM-YYYY` (ej. 14-09-2026) y fechas seriales de Excel (1900/1904).
 * - Una fecha ambigua (ej. 07-09-2026) se BLOQUEA con error cuando no existe
 *   contexto suficiente para determinar el formato. Nunca se adivina el día
 *   y el mes.
 * - Con contexto (fechas no ambiguas del mismo origen que fijan el formato),
 *   la ambigüedad se resuelve con incidente, no de forma silenciosa.
 * - Siempre se conserva el valor original, el valor normalizado y el criterio.
 */

export interface ParsedDate {
  original: string;
  normalized: string; // ISO 8601: YYYY-MM-DD
  format: string;
  ambiguous: boolean;
  confidence: 'high' | 'medium' | 'low';
}

;

/**
 * Formatos de fecha soportados con sus patrones regex.
 */
const DATE_PATTERNS: Array<{
  name: string;
  regex: RegExp;
  parse: (match: RegExpMatchArray) => { year: number; month: number; day: number };
  /** `slash` = estilo estadounidense M/D; `dash` = estilo latinoamericano D-M. */
  separator: 'slash' | 'dash';
}> = [
  // ISO 8601: 2026-08-24 (no ambigua)
  {
    name: 'ISO 8601',
    regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    parse: (m) => ({ year: parseInt(m[1], 10), month: parseInt(m[2], 10), day: parseInt(m[3], 10) }),
    separator: 'dash',
  },
  // M/D/YYYY: 8/24/2026 (estadounidense)
  {
    name: 'M/D/YYYY',
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parse: (m) => ({ year: parseInt(m[3], 10), month: parseInt(m[1], 10), day: parseInt(m[2], 10) }),
    separator: 'slash',
  },
  // D/M/YYYY: 31/8/2026 (día primero con barras)
  {
    name: 'D/M/YYYY',
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parse: (m) => ({ year: parseInt(m[3], 10), month: parseInt(m[2], 10), day: parseInt(m[1], 10) }),
    separator: 'slash',
  },
  // DD-MM-YYYY: 14-09-2026 (latinoamericano)
  {
    name: 'DD-MM-YYYY',
    regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    parse: (m) => ({ year: parseInt(m[3], 10), month: parseInt(m[2], 10), day: parseInt(m[1], 10) }),
    separator: 'dash',
  },
];

/**
 * Valida si una fecha es válida (mes 1-12, día 1-31 según el mes).
 */
function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

/**
 * Fecha ambigua: el par (a, b) con a,b ≤ 12 podría leerse como M/D o D/M.
 */
function isAmbiguousPair(first: number, second: number): boolean {
  return first <= 12 && second <= 12 && first !== second;
}

/**
 * Intenta parsear una cadena de fecha con múltiples formatos.
 * Lanza un error cuando la fecha es ambigua y no puede resolverse de forma
 * segura, o cuando no coincide con ningún formato soportado.
 */
export function parseDate(input: string): ParsedDate {
  return parseDateWithContext(input)
}

export interface DateFormatContext {
  /** Formato confirmado por fechas no ambiguas del mismo origen. */
  readonly format: 'M/D/YYYY' | 'D/M/YYYY' | 'DD-MM-YYYY'
}

/**
 * Parsea una fecha con un contexto de formato explícito.
 * Cuando el formato de contexto resuelve la ambigüedad, el resultado se marca
 * como `ambiguous: true` con confianza baja para que el llamador registre la
 * decisión. Si el contexto no coincide con la cadena, se bloquea con error.
 */
export function parseDateWithContext(
  input: string,
  context?: DateFormatContext,
): ParsedDate {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Fecha vacía no es válida');
  }

  for (const pattern of DATE_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (!match) continue;

    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);

    if (pattern.name === 'ISO 8601') {
      const { year, month, day } = pattern.parse(match);
      if (!isValidDate(year, month, day)) continue;
      return {
        original: trimmed,
        normalized: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        format: pattern.name,
        ambiguous: false,
        confidence: 'high',
      };
    }

    // Ambigüedad: el par (a, b) podría leerse como M/D o D/M.
    const ambiguous = isAmbiguousPair(first, second);

    // Formato del contexto: solo aplica al formato correspondiente.
    if (context) {
      if (context.format !== pattern.name) {
        continue;
      }
    } else if (ambiguous) {
      // Sin contexto, una fecha ambigua se bloquea: no se adivina el formato.
      throw new Error(
        `Fecha ambigua '${trimmed}': el formato no puede determinarse de forma segura`,
      );
    }

    const { year, month, day } = pattern.parse(match);
    if (!isValidDate(year, month, day)) continue;

    const normalized = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
      original: trimmed,
      normalized,
      format: pattern.name,
      ambiguous,
      confidence: ambiguous ? 'low' : 'medium',
    };
  }

  throw new Error(`No se pudo parsear la fecha: "${input}"`);
}

/**
 * Convierte una fecha serial de Excel a fecha calendario.
 * Sistema 1900 por defecto; pasar `epoch1904: true` para libros Mac 1904.
 * Corrige el bug histórico del 1900 ficticio (serial 60): los seriales ≥ 60
 * se desplazan un día; el serial 60 (29-feb-1900, inexistente) es inválido.
 */
export function parseExcelSerialDate(
  serial: number,
  epoch1904 = false,
): ParsedDate {
  if (!Number.isFinite(serial) || serial < 0) {
    throw new Error(`Serial de fecha inválido: ${serial}`)
  }

  if (!epoch1904 && serial === 60) {
    throw new Error('Serial 60 corresponde al 29-feb-1900 ficticio del sistema 1900')
  }

  const days = epoch1904 ? serial : (serial < 60 ? serial : serial - 1)
  // Época base sistema 1904: serial 0 = 1904-01-01. Sistema 1900: base
  // 1899-12-31 de modo que serial 1 = 1900-01-01, con corrección del día
  // ficticio del bug del año bisiesto (serial ≥ 61 se desplaza -1 día).
  const base = epoch1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31)
  const date = new Date(base + days * 86_400_000)

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()

  return {
    original: String(serial),
    normalized: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    format: epoch1904 ? 'Excel serial (1904)' : 'Excel serial (1900)',
    ambiguous: false,
    confidence: 'high',
  }
}

/**
 * Deduce el formato de un conjunto de fechas del mismo origen.
 * Retorna el formato solo si TODAS las fechas no ambiguas coinciden en el
 * mismo criterio; en caso contrario retorna `null` (sin contexto seguro).
 */
export function deduceDateFormat(
  inputs: readonly string[],
): DateFormatContext | null {
  const proofs = new Set<DateFormatContext['format']>()

  for (const input of inputs) {
    const trimmed = input.trim()
    if (!trimmed) continue

    for (const pattern of DATE_PATTERNS) {
      if (pattern.name === 'ISO 8601') continue
      const match = trimmed.match(pattern.regex)
      if (!match) continue

      const first = parseInt(match[1], 10)
      const second = parseInt(match[2], 10)

      // Validez semántica: M/D interpreta (mes, día); D/M y DD-MM (día, mes).
      const monthFirst = pattern.name === 'M/D/YYYY' ? first : second
      const dayFirst = pattern.name === 'M/D/YYYY' ? second : first
      if (monthFirst < 1 || monthFirst > 12 || dayFirst < 1 || dayFirst > 31) {
        continue // esta interpretación es imposible; probar la siguiente
      }

      // Prueba de contexto: una posición > 12 fija el criterio sin ambigüedad.
      if (dayFirst > 12 && monthFirst <= 12) {
        proofs.add(pattern.name as DateFormatContext['format'])
        break
      }
      if (isAmbiguousPair(first, second)) {
        break // ambigua: no aporta prueba, pero corta la búsqueda
      }
      break
    }
  }

  if (proofs.size !== 1) return null
  return { format: [...proofs][0] }
}

/**
 * Convierte una fecha a formato ISO 8601 (YYYY-MM-DD).
 * Si la fecha es ambigua y no puede resolverse con seguridad, lanza un error
 * que el llamador debe convertir en incidencia ERROR (nunca se adivina).
 */
export function normalizeDate(input: string): ParsedDate {
  return parseDate(input)
}

/**
 * Valida si una cadena es una fecha válida en algún formato soportado.
 */
export function isValidDateString(input: string): boolean {
  try {
    parseDate(input);
    return true;
  } catch {
    return false;
  }
}
