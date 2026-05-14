import assert from 'node:assert/strict'
import { test } from 'node:test'

// The plugin is authored as .mjs; import the default export.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rehypeMathJaxStripStyles: () => (tree: any) => void

test('rehype-mathjax-strip-styles: plugin import', async () => {
  const mod = await import('../utils/rehype-mathjax-strip-styles.mjs')
  rehypeMathJaxStripStyles = mod.default
  assert.ok(typeof rehypeMathJaxStripStyles === 'function')
})

// ── HAST tree helpers ──

interface HastElement {
  type: 'element'
  tagName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>
  children: HastNode[]
}

interface HastText {
  type: 'text'
  value: string
}

type HastNode = HastElement | HastText

function el(tagName: string, children: HastNode[]): HastElement {
  return { type: 'element', tagName, children }
}

function text(value: string): HastText {
  return { type: 'text', value }
}

function root(children: HastNode[]): HastElement {
  return el('root', children)
}

// ── Tests ──

test('rehype-mathjax-strip-styles: removes MathJax SVG style blocks', () => {
  const tree = root([
    el('p', [text('Hello')]),
    el('style', [text('mjx-container[jax="SVG"] { direction: ltr; }')]),
    el('p', [text('World')]),
  ])

  rehypeMathJaxStripStyles()(tree)

  assert.equal(tree.children.length, 2)
  assert.equal((tree.children[0] as HastElement).tagName, 'p')
  assert.equal((tree.children[1] as HastElement).tagName, 'p')
})

test('rehype-mathjax-strip-styles: removes MathJax CHTML style blocks', () => {
  const tree = root([
    el('style', [text('mjx-container[jax="CHTML"] { display: block; }')]),
  ])

  rehypeMathJaxStripStyles()(tree)

  assert.equal(tree.children.length, 0)
})

test('rehype-mathjax-strip-styles: preserves non-MathJax style blocks', () => {
  const tree = root([
    el('style', [text('.my-custom-class { color: red; }')]),
    el('style', [text('body { font-size: 16px; }')]),
  ])

  rehypeMathJaxStripStyles()(tree)

  assert.equal(tree.children.length, 2)
  assert.equal((tree.children[0] as HastElement).tagName, 'style')
  assert.equal((tree.children[1] as HastElement).tagName, 'style')
})

test('rehype-mathjax-strip-styles: handles nested style removal', () => {
  const tree = root([
    el('div', [
      el('p', [text('Nested')]),
      el('style', [text('mjx-container[jax="SVG"] { direction: ltr; }')]),
      el('style', [text('.keep { color: blue; }')]),
    ]),
  ])

  rehypeMathJaxStripStyles()(tree)

  const div = tree.children[0] as HastElement
  assert.equal(div.children.length, 2)
  assert.equal((div.children[0] as HastElement).tagName, 'p')
  assert.equal((div.children[1] as HastElement).tagName, 'style')
})

test('rehype-mathjax-strip-styles: handles empty tree without crashing', () => {
  const tree = root([])

  assert.doesNotThrow(() => rehypeMathJaxStripStyles()(tree))
  assert.equal(tree.children.length, 0)
})

test('rehype-mathjax-strip-styles: handles style without text children', () => {
  const tree = root([
    el('style', []),
  ])

  assert.doesNotThrow(() => rehypeMathJaxStripStyles()(tree))
  // Empty style block with no MathJax text — preserved
  assert.equal(tree.children.length, 1)
})

test('rehype-mathjax-strip-styles: handles style with mixed text and element children', () => {
  const tree = root([
    el('style', [
      text('.custom { color: blue; } '),
      el('span', [text('not-typical')]),
      text(' mjx-container[jax="SVG"] { direction: ltr; }'),
    ]),
  ])

  // The custom class part and the mjx part are in separate text nodes
  // joined together by the mapping — the full text will contain the mjx pattern
  rehypeMathJaxStripStyles()(tree)

  assert.equal(tree.children.length, 0, 'should strip style block when any text child references MathJax')
})

test('rehype-mathjax-strip-styles: preserves style with "mjx-container" mention outside bracket context', () => {
  // The regex requires `mjx-container[jax="..."]` — just mentioning
  // the string "mjx-container" should not trigger removal.
  const tree = root([
    el('style', [text('.foo { content: "mjx-container"; }')]),
  ])

  rehypeMathJaxStripStyles()(tree)

  assert.equal(tree.children.length, 1, 'should not strip when mjx-container lacks jax bracket context')
})
