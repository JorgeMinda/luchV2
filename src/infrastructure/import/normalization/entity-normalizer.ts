/**
 * Identidad canónica para deduplicación de entidades (Fase 3).
 *
 * Normalización canónica: Unicode NFD, eliminación de diacríticos para
 * comparación, normalización de espacios y mojibake reparado solo cuando es
 * trazable y verificable. El valor original siempre se conserva en el
 * llamador; aquí solo se producen claves de comparación.
 *
 * Clasificación de coincidencias según el contrato `NormalizedEntityKey`:
 * `EXACT | ALIAS | AMBIGUOUS | NEW`. Nunca se fusionan entidades
 * automáticamente por similitud textual; las coincidencias múltiples se
 * marcan `AMBIGUOUS` conservando las alternativas.
 */

const FORMULA_ERRORS = ['#REF!', '#VALUE!', '#N/A', '#DIV/0!', '#NAME?', '#NULL!', '#NUM!']

/** Detecta texto con codificación dañada (UTF-8 leído como Windows-1252). */
export function looksLikeMojibake(text: string): boolean {
  return /[ÃÂ][\u0080-\u00bf]/.test(text) || /Ã[\u0000-\u00ff]{1,2}/.test(text)
}

/**
 * Repara mojibake reinterpreting los caracteres como bytes Latin-1 y
 * decodificando como UTF-8. Solo se aplica cuando el texto parece mojibake;
 * si el resultado contiene U+FFFD se descarta la reparación (no trazable).
 */
export function repairMojibake(text: string): { text: string; repaired: boolean } {
  if (!looksLikeMojibake(text)) {
    return { text, repaired: false }
  }
  try {
    const bytes = Uint8Array.from([...text].map((ch) => ch.charCodeAt(0) & 0xff))
    const decoded = new TextDecoder('utf-8').decode(bytes)
    if (decoded.includes('\uFFFD')) {
      return { text, repaired: false }
    }
    return { text: decoded, repaired: true }
  } catch {
    return { text, repaired: false }
  }
}

/**
 * Normalización canónica de un nombre para comparación:
 * reparación de mojibake (trazable), NFD, eliminación de diacríticos,
 * minúsculas y colapso de caracteres no alfanuméricos en un espacio.
 */
export function normalizeEntityName(name: string): string {
  if (!name) return ''
  if (FORMULA_ERRORS.includes(name.trim())) return name.trim()

  const repaired = repairMojibake(name).text
  return repaired
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Genera una clave compuesta para un ingrediente dentro de una categoría.
 * Ejemplo: "sopa|papa chola qq"
 */
export function entityKey(category: string, name: string): string {
  return `${normalizeEntityName(category)}|${normalizeEntityName(name)}`
}

/**
 * Calcula similitud simple entre dos cadenas normalizadas (0-1).
 * Usa comparación de tokens comunes (Jaccard simplificado).
 */
export function similarity(a: string, b: string): number {
  const na = normalizeEntityName(a);
  const nb = normalizeEntityName(b);

  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const setA = new Set(na.split(' '));
  const setB = new Set(nb.split(' '));

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Encuentra la mejor coincidencia para un nombre entre una lista de candidatos.
 * Retorna el mejor candidato y su puntuación de similitud.
 */
export function findBestMatch(
  name: string,
  candidates: string[],
  threshold: number = 0.8
): { match: string | null; score: number } {
  let best: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = similarity(name, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return bestScore >= threshold ? { match: best!, score: bestScore } : { match: null, score: bestScore };
}

/**
 * Clasifica el tipo de coincidencia entre dos entidades.
 */
export type MatchType = 'exact' | 'probable' | 'ambiguous' | 'none';

export function classifyMatch(
  entity1: string,
  entity2: string
): { type: MatchType; score: number } {
  const score = similarity(entity1, entity2);

  if (score === 1) {
    return { type: 'exact', score: 1 };
  }
  if (score >= 0.85) {
    return { type: 'probable', score };
  }
  if (score >= 0.6) {
    return { type: 'ambiguous', score };
  }
  return { type: 'none', score: 0 };
}

/** Estados de coincidencia del contrato `NormalizedEntityKey`. */
export type MatchStatus = 'EXACT' | 'ALIAS' | 'AMBIGUOUS' | 'NEW'

export interface MatchCandidate {
  readonly id: string
  readonly name: string
  readonly aliases?: readonly string[]
}

export interface MatchClassification {
  readonly status: MatchStatus
  /** Id de la entidad catalogada cuando la coincidencia es EXACT o ALIAS. */
  readonly canonicalId?: string
  /** Candidatos sugeridos ordenados por puntuación (revisión manual). */
  readonly suggestedMatches: readonly { id: string; name: string; score: number }[]
}

/**
 * Clasifica un nombre importado frente a un catálogo de entidades.
 *
 * - `EXACT`: igualdad literal (trim/case-insensitive) con el nombre catalogado.
 * - `ALIAS`: igualdad con un alias aprobado, o igualdad de clave canónica
 *   (acentos/espacios/mojibake) con el nombre catalogado.
 * - `AMBIGUOUS`: sin coincidencia canónica y 2 o más candidatos con similitud
 *   ≥ `threshold`; se conservan las alternativas sin fusionar nada.
 * - `NEW`: ninguna coincidencia ≥ `threshold`.
 */
export function classifyMatchStatus(
  name: string,
  catalog: readonly MatchCandidate[],
  threshold = 0.6,
): MatchClassification {
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()
  const canonical = normalizeEntityName(name)

  for (const candidate of catalog) {
    if (candidate.name.trim().toLowerCase() === lower) {
      return { status: 'EXACT', canonicalId: candidate.id, suggestedMatches: [] }
    }
  }

  for (const candidate of catalog) {
    const aliasHit = (candidate.aliases ?? []).some(
      (alias) => alias.trim().toLowerCase() === lower,
    )
    if (aliasHit || normalizeEntityName(candidate.name) === canonical) {
      return { status: 'ALIAS', canonicalId: candidate.id, suggestedMatches: [] }
    }
  }

  const suggestions = catalog
    .map((candidate) => ({ candidate, score: similarity(name, candidate.name) }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({ id: entry.candidate.id, name: entry.candidate.name, score: entry.score }))

  if (suggestions.length >= 2) {
    return { status: 'AMBIGUOUS', suggestedMatches: suggestions }
  }

  return { status: 'NEW', suggestedMatches: suggestions }
}
