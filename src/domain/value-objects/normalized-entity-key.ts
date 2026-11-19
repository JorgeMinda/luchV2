export interface NormalizedEntityKey {
  readonly key: string
  readonly original: string
  readonly normalized: string
  readonly canonicalId?: string
  readonly aliases?: readonly string[]
  readonly suggestedMatches?: readonly string[]
  readonly matchStatus?: 'EXACT' | 'ALIAS' | 'AMBIGUOUS' | 'NEW'
}
