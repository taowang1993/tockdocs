import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildSearchExcerpt,
  getFieldMatchScore,
  hasScriptWithoutWordBoundaries,
  normalizeQueryTerms,
  scoreCandidate,
  scriptBigrams,
  WITHOUT_WORD_BOUNDARIES,
} from '../server/utils/docs-search-helpers'

// ─── hasScriptWithoutWordBoundaries ──────────────────────────────────────────

test('hasScriptWithoutWordBoundaries detects CJK ideographs', () => {
  assert.equal(hasScriptWithoutWordBoundaries('能层'), true)
  assert.equal(hasScriptWithoutWordBoundaries('電子'), true)
})

test('hasScriptWithoutWordBoundaries detects Japanese kana', () => {
  assert.equal(hasScriptWithoutWordBoundaries('あいう'), true)
  assert.equal(hasScriptWithoutWordBoundaries('インストール'), true)
})

test('hasScriptWithoutWordBoundaries detects Korean Hangul', () => {
  assert.equal(hasScriptWithoutWordBoundaries('전자 배치'), true)
  assert.equal(hasScriptWithoutWordBoundaries('한글'), true)
})

test('hasScriptWithoutWordBoundaries detects Thai, Lao, Khmer, Myanmar', () => {
  assert.equal(hasScriptWithoutWordBoundaries('การจัดเรียง'), true) // Thai
  assert.equal(hasScriptWithoutWordBoundaries('ການຈັດ'), true) // Lao
  assert.equal(hasScriptWithoutWordBoundaries('ការរៀបចំ'), true) // Khmer
  assert.equal(hasScriptWithoutWordBoundaries('မြန်မာ'), true) // Myanmar
})

test('hasScriptWithoutWordBoundaries returns false for Latin, Arabic, Cyrillic', () => {
  assert.equal(hasScriptWithoutWordBoundaries('electron'), false)
  assert.equal(hasScriptWithoutWordBoundaries('تكوين'), false)
  assert.equal(hasScriptWithoutWordBoundaries('конфигурация'), false)
  assert.equal(hasScriptWithoutWordBoundaries('इलेक्ट्रॉन'), false) // Devanagari used with spaces
})

test('hasScriptWithoutWordBoundaries returns false for empty string', () => {
  assert.equal(hasScriptWithoutWordBoundaries(''), false)
})

// ─── scriptBigrams ───────────────────────────────────────────────────────────

test('scriptBigrams generates bigrams from CJK text', () => {
  assert.deepEqual(
    scriptBigrams('能层和能级'),
    ['能层', '层和', '和能', '能级'],
  )
})

test('scriptBigrams filters out non-script characters', () => {
  assert.deepEqual(
    scriptBigrams('能层 and 能级'),
    ['能层', '层能', '能级'],
  )
})

test('scriptBigrams returns single char for length 1', () => {
  assert.deepEqual(scriptBigrams('能'), ['能'])
})

test('scriptBigrams returns empty for no matching chars', () => {
  assert.deepEqual(scriptBigrams('hello world'), [])
})

test('scriptBigrams deduplicates identical bigrams', () => {
  assert.deepEqual(scriptBigrams('能能能'), ['能能'])
})

test('scriptBigrams handles Korean Hangul', () => {
  const result = scriptBigrams('전자배치')
  assert.ok(result.includes('전자'))
  assert.ok(result.includes('자배'))
  assert.ok(result.includes('배치'))
  assert.equal(result.length, 3)
})

test('scriptBigrams handles Japanese kana', () => {
  const result = scriptBigrams('あいうえお')
  assert.deepEqual(result, ['あい', 'いう', 'うえ', 'えお'])
})

test('scriptBigrams handles empty string', () => {
  assert.deepEqual(scriptBigrams(''), [])
})

// ─── normalizeQueryTerms ─────────────────────────────────────────────────────

test('normalizeQueryTerms splits Latin text into words ≥ 2 chars', () => {
  const terms = normalizeQueryTerms('electron configuration rules')
  assert.deepEqual(terms, ['electron', 'configuration', 'rules'])
})

test('normalizeQueryTerms lowercases and deduplicates', () => {
  const terms = normalizeQueryTerms('Electron electron')
  assert.deepEqual(terms, ['electron'])
})

test('normalizeQueryTerms filters out single-character words', () => {
  const terms = normalizeQueryTerms('a big test')
  assert.deepEqual(terms, ['big', 'test'])
})

test('normalizeQueryTerms generates bigrams for CJK text', () => {
  const terms = normalizeQueryTerms('能层和能级')
  assert.deepEqual(terms, ['能层', '层和', '和能', '能级'])
})

test('normalizeQueryTerms handles mixed CJK and Latin', () => {
  const terms = normalizeQueryTerms('能级 energy level')
  // CJK portion → bigrams, Latin portion → words
  assert.ok(terms.includes('能级'), 'Should contain 能级 bigram')
  assert.ok(terms.includes('energy'), 'Should contain energy')
  assert.ok(terms.includes('level'), 'Should contain level')
})

test('normalizeQueryTerms handles Korean', () => {
  const terms = normalizeQueryTerms('전자 배치 규칙')
  assert.ok(terms.length > 0)
  // Korean with spaces still generates bigrams for hangul runs
  assert.ok(terms.some(t => WITHOUT_WORD_BOUNDARIES.test(t)), 'Should contain hangul terms')
})

test('normalizeQueryTerms handles empty query', () => {
  assert.deepEqual(normalizeQueryTerms(''), [])
})

test('normalizeQueryTerms handles query with only punctuation', () => {
  assert.deepEqual(normalizeQueryTerms('?? !!'), [])
})

// ─── getFieldMatchScore ──────────────────────────────────────────────────────

test('getFieldMatchScore returns 0 for empty text', () => {
  assert.equal(getFieldMatchScore('', ['electron']), 0)
})

test('getFieldMatchScore scores exact full-query match higher', () => {
  const scoreExact = getFieldMatchScore('electron configuration', ['electron', 'configuration'])
  const scorePartial = getFieldMatchScore('electron only', ['electron', 'configuration'])
  assert.ok(scoreExact > scorePartial, `exact ${scoreExact} should be > partial ${scorePartial}`)
})

test('getFieldMatchScore is case insensitive', () => {
  const score1 = getFieldMatchScore('Electron Configuration', ['electron', 'configuration'])
  const score2 = getFieldMatchScore('electron configuration', ['electron', 'configuration'])
  assert.equal(score1, score2)
})

test('getFieldMatchScore handles CJK terms', () => {
  const score = getFieldMatchScore('能层和能级的区别', ['能层', '能级'])
  assert.ok(score > 0, 'CJK terms should match')
})

// ─── scoreCandidate ──────────────────────────────────────────────────────────

test('scoreCandidate returns higher score for title match', () => {
  const doc = {
    id: '1',
    path: '/test',
    kb: '',
    locale: '',
    title: 'Electron Configuration',
    description: '',
    headings: '',
    pathTokens: '',
    rawContent: '',
    content: '',
  }

  const candidate = { doc, flexIndex: 0 }
  const score = scoreCandidate(candidate, 'electron configuration')
  assert.ok(score > 100, 'Title match should score high')
})

test('scoreCandidate flex ranking affects score', () => {
  const doc = {
    id: '1',
    path: '/test',
    kb: '',
    locale: '',
    title: 'Test',
    description: '',
    headings: '',
    pathTokens: '',
    rawContent: '',
    content: '',
  }

  const first = { doc, flexIndex: 0 }
  const second = { doc, flexIndex: 1 }
  assert.ok(scoreCandidate(first, 'test') > scoreCandidate(second, 'test'))
})

test('scoreCandidate empty candidate returns 0', () => {
  const doc = {
    id: '1',
    path: '/test',
    kb: '',
    locale: '',
    title: '',
    description: '',
    headings: '',
    pathTokens: '',
    rawContent: '',
    content: '',
  }

  assert.equal(scoreCandidate({ doc }, ''), 0)
})

// ─── buildSearchExcerpt ──────────────────────────────────────────────────────

test('buildSearchExcerpt returns content centered on query match', () => {
  // Build content long enough that the 1000-char excerpt is a proper subset
  const before = 'A'.repeat(600)
  const after = 'B'.repeat(600)
  const content = `${before} electron configuration ${after}`
  const excerpt = buildSearchExcerpt(content, 'electron configuration')
  assert.ok(excerpt.includes('electron configuration'), 'Should include query terms')
  // Excerpt should be ~1000 chars centered on the match
  assert.ok(excerpt.length >= 900 && excerpt.length <= 1100, `Expected ~1000 chars, got ${excerpt.length}`)
})

test('buildSearchExcerpt returns full content when shorter than excerpt length', () => {
  const content = 'Short text.'
  const excerpt = buildSearchExcerpt(content, 'Short')
  assert.equal(excerpt, 'Short text.')
})

test('buildSearchExcerpt adds ellipsis when truncated', () => {
  const before = 'x'.repeat(600)
  const after = 'y'.repeat(600)
  const content = `${before} target match ${after}`
  const excerpt = buildSearchExcerpt(content, 'target match')
  assert.ok(excerpt.includes('target match'), 'Should contain target')
  // With 600 chars padding on each side and 500 radius, excerpt should truncate
  assert.ok(excerpt.startsWith('…') || excerpt.endsWith('…'), `Expected ellipsis in: ${excerpt.slice(0, 50)}...`)
})

test('buildSearchExcerpt handles CJK content', () => {
  const content = '能层是按电子能量高低划分的层次，能级是在同一能层中按轨道形状和能量进一步划分的亚层。能层和能级的核心区别在于划分维度不同。'
  const excerpt = buildSearchExcerpt(content, '能层和能级')
  assert.ok(excerpt.includes('能层'), 'Should contain CJK terms')
})

test('buildSearchExcerpt handles empty content', () => {
  assert.equal(buildSearchExcerpt('', 'query'), '')
})

test('buildSearchExcerpt handles empty query', () => {
  assert.equal(buildSearchExcerpt('some content here', ''), 'some content here')
})

// ─── Second-chance fallback: script-only query extraction ───────────────────

test('script-only extraction strips Latin from mixed query', () => {
  const query = '硫酸 化学 成分 H2SO4'
  const scriptOnly = [...query]
    .filter(c => WITHOUT_WORD_BOUNDARIES.test(c))
    .join('')
    .trim()
  assert.equal(scriptOnly, '硫酸化学成分')
})

test('script-only extraction returns empty for Latin-only query', () => {
  const query = 'electron configuration'
  const scriptOnly = [...query]
    .filter(c => WITHOUT_WORD_BOUNDARIES.test(c))
    .join('')
    .trim()
  assert.equal(scriptOnly, '')
})

test('script-only extraction returns original for CJK-only query', () => {
  const query = '能层和能级'
  const scriptOnly = [...query]
    .filter(c => WITHOUT_WORD_BOUNDARIES.test(c))
    .join('')
    .trim()
  assert.equal(scriptOnly, '能层和能级')
})
