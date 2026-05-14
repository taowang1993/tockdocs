/**
 * Pure utility functions for TockDocs search — no Nuxt/Nitro/H3 dependencies.
 * Testable in isolation without a Nuxt runtime.
 */

// ─── Unicode ranges for scripts without word boundaries ──────────────────────
// Covers: CJK ideographs, Korean Hangul, Japanese kana, Thai, Lao, Khmer, Myanmar.

export const WITHOUT_WORD_BOUNDARIES_RANGE = '\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF\\uAC00-\\uD7AF\\u3040-\\u309F\\u30A0-\\u30FF\\u0E00-\\u0E7F\\u0E80-\\u0EFF\\u1780-\\u17FF\\u1000-\\u109F'
export const WITHOUT_WORD_BOUNDARIES = new RegExp(`[${WITHOUT_WORD_BOUNDARIES_RANGE}]`)

export const EXCERPT_LENGTH = 1000
export const EXCERPT_RADIUS = 500

// ─── Text normalization ──────────────────────────────────────────────────────

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeForMatch(value: string) {
  return normalizeWhitespace(value).toLowerCase()
}

// ─── Script detection & bigram tokenization ──────────────────────────────────

export function hasScriptWithoutWordBoundaries(text: string): boolean {
  return WITHOUT_WORD_BOUNDARIES.test(text)
}

export function scriptBigrams(text: string): string[] {
  const chars = [...text].filter(c => WITHOUT_WORD_BOUNDARIES.test(c)).join('')
  if (chars.length < 2) return chars.length === 1 ? [chars] : []
  const result: string[] = []
  for (let i = 0; i < chars.length - 1; i++) {
    result.push(chars[i]! + chars[i + 1]!)
  }
  return [...new Set(result)]
}

// ─── Query term extraction ───────────────────────────────────────────────────

export function normalizeQueryTerms(query: string) {
  const normalized = normalizeForMatch(query)

  if (!hasScriptWithoutWordBoundaries(normalized)) {
    return [...new Set(
      normalized
        .split(/[^\p{L}\p{N}]+/u)
        .filter(term => term.length >= 2),
    )]
  }

  const terms: string[] = []
  for (const chunk of normalized.split(new RegExp(`([${WITHOUT_WORD_BOUNDARIES_RANGE}]+)`, 'u'))) {
    if (hasScriptWithoutWordBoundaries(chunk)) {
      terms.push(...scriptBigrams(chunk))
    }
    else {
      const words = chunk.split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 2)
      terms.push(...words)
    }
  }

  return [...new Set(terms)]
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function getFieldMatchScore(text: string, queryTerms: string[]) {
  if (!text) return 0

  const normalizedText = normalizeForMatch(text)
  const fullQuery = normalizeWhitespace(queryTerms.join(' '))
  let score = 0

  if (fullQuery && normalizedText.includes(fullQuery)) {
    score += 2
  }

  for (const term of queryTerms) {
    if (normalizedText.includes(term)) {
      score += 1
    }
  }

  return score
}

export interface SearchCandidateLike {
  doc: { title: string, description: string, headings: string, pathTokens: string, content: string }
  flexIndex?: number
  fuseIndex?: number
  fuseScore?: number
}

export function scoreCandidate(candidate: SearchCandidateLike, query: string) {
  const queryTerms = normalizeQueryTerms(query)
  const { doc } = candidate

  let score = 0
  score += getFieldMatchScore(doc.title, queryTerms) * 140
  score += getFieldMatchScore(doc.headings, queryTerms) * 110
  score += getFieldMatchScore(doc.description, queryTerms) * 80
  score += getFieldMatchScore(doc.pathTokens, queryTerms) * 70
  score += getFieldMatchScore(doc.content, queryTerms) * 35

  if (candidate.flexIndex !== undefined) {
    score += 320 - candidate.flexIndex * 12
  }

  if (candidate.fuseIndex !== undefined) {
    score += 120 - candidate.fuseIndex * 6
  }

  if (candidate.fuseScore !== undefined) {
    score += Math.round((1 - candidate.fuseScore) * 100)
  }

  return score
}

// ─── Excerpt generation ──────────────────────────────────────────────────────

export function buildSearchExcerpt(content: string, query: string) {
  const normalizedContent = normalizeWhitespace(content)
  const lowerContent = normalizedContent.toLowerCase()
  const queryTerms = normalizeQueryTerms(query)

  const matchIndex = queryTerms
    .map(term => lowerContent.indexOf(term))
    .find(index => index >= 0) ?? 0

  const start = Math.max(0, matchIndex - EXCERPT_RADIUS)
  const end = Math.min(normalizedContent.length, start + EXCERPT_LENGTH)
  const excerpt = normalizedContent.slice(start, end).trim()

  if (start === 0 && end === normalizedContent.length) {
    return excerpt
  }

  return `${start > 0 ? '…' : ''}${excerpt}${end < normalizedContent.length ? '…' : ''}`
}
