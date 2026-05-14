import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('derives assistant docking state from the docs-aware header layout composable', () => {
  const source = readFileSync(new URL('./AppHeader.vue', import.meta.url), 'utf8')

  assert.match(source, /const \{ classes: headerLayout, isAssistantDocked: assistantDocked \} = useHeaderLayout\(\)/)
  assert.doesNotMatch(source, /shouldPushContent: assistantDocked/)
})

test('delegates header menu toggle visibility to the shared drawer-only layout class', () => {
  const source = readFileSync(new URL('./AppHeader.vue', import.meta.url), 'utf8')
  const toggleStart = source.indexOf('<template #toggle')
  const headerEnd = source.indexOf('</UHeader>', toggleStart)

  assert.ok(toggleStart !== -1, 'expected the header toggle slot to exist')
  assert.ok(headerEnd !== -1, 'expected the UHeader wrapper to exist')

  const toggleBlock = source.slice(toggleStart, headerEnd)

  assert.match(toggleBlock, /headerLayout\.drawerOnly/)
  assert.match(toggleBlock, /<IconMenuToggle/)
  assert.doesNotMatch(toggleBlock, /assistantDocked/)
})

test('keeps header search shortcut markup stable across SSR and hydration', () => {
  const source = readFileSync(new URL('./AppHeaderCenter.vue', import.meta.url), 'utf8')

  assert.match(source, /:kbds="kbds"/)
  assert.doesNotMatch(source, /useMediaQuery/)
  assert.doesNotMatch(source, /effectiveKbds/)
})
