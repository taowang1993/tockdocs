import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..')

function loadMainCss(): string {
  const cssPath = resolve(repoRoot, 'layer/app/assets/css/main.css')
  assert.ok(existsSync(cssPath), `main.css not found at ${cssPath}`)
  return readFileSync(cssPath, 'utf-8')
}

test('No markdown site landing file is present', () => {
  const siteIndexPath = resolve(repoRoot, 'docs/content/site/index.md')
  const siteMdcPath = resolve(repoRoot, 'docs/content/site/index.mdc')
  assert.equal(
    existsSync(siteIndexPath),
    false,
    'docs/content/site/index.md should not exist — KnowledgeBaseDirectory.vue is the landing page',
  )
  assert.equal(
    existsSync(siteMdcPath),
    false,
    'docs/content/site/index.mdc should not exist — KnowledgeBaseDirectory.vue is the landing page',
  )
})

test('ProseImg bypass is removed (NuxtImage restored)', () => {
  const proseImgPath = resolve(repoRoot, 'docs/app/components/content/ProseImg.vue')
  assert.equal(
    existsSync(proseImgPath),
    false,
    'ProseImg.vue should not exist — Nuxt UI built-in ProseImg (NuxtImg) must be in control',
  )
})

test('SVGs are inverted in dark mode', () => {
  const css = loadMainCss()

  // Rule must target SVGs in dark mode
  assert.ok(
    css.includes('.dark img[src$=".svg"]'),
    'missing .dark img[src$=".svg"] selector',
  )
  assert.ok(
    css.includes('filter: invert(1)'),
    'missing filter: invert(1)',
  )
  assert.ok(
    css.includes('hue-rotate(180deg)'),
    'missing hue-rotate(180deg)',
  )
})

test('logo SVGs are excluded from dark-mode inversion', () => {
  const css = loadMainCss()

  // The logo path must be excluded — logos already have light/dark variants
  assert.ok(
    css.includes(':not([src*="/logo/"])'),
    'missing :not([src*="/logo/"]) — logo SVGs must be excluded from inversion',
  )

  // Verify the complete rule is well-formed
  assert.ok(
    /\.dark\s+img\[src\$="\.svg"\]:not\(\[src\*="\/logo\/"\]\)/.test(css),
    'dark-mode SVG inversion rule does not match expected pattern',
  )
})

test('MathJax SVG base stylesheet is present globally', () => {
  const css = loadMainCss()

  assert.ok(
    css.includes('mjx-container[jax="SVG"] {'),
    'missing global MathJax SVG base stylesheet',
  )
  assert.ok(
    css.includes('direction: ltr;'),
    'missing MathJax SVG direction rule',
  )
})

test('long display formulas get horizontal scroll', () => {
  const css = loadMainCss()

  assert.ok(
    css.includes('mjx-container[display="true"]'),
    'missing mjx-container[display="true"] selector',
  )
  assert.ok(
    css.includes('overflow-x: auto'),
    'missing overflow-x: auto for formula scrolling',
  )
})

test('ProseImg CSS does not contain zoom/click-to-enlarge cruft', () => {
  const css = loadMainCss()

  // The old override used Reka UI + Motion; none of that should be in CSS
  assert.ok(
    !css.includes('cursor-zoom-in'),
    'stale cursor-zoom-in from removed ProseImg override',
  )
  assert.ok(
    !css.includes('will-change-transform'),
    'stale will-change-transform from removed ProseImg override',
  )
})
