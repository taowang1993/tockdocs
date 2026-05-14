import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isVueSuspenseWarning, isTiptapDuplicateExtensionWarning, isSvgXsAttributeError } from '../utils/vue-suspense-warning'

test('isVueSuspenseWarning: matches exact Vue 3 <Suspense> experimental warning', () => {
  assert.equal(
    isVueSuspenseWarning(
      '<Suspense> is an experimental feature and its API will likely change.',
    ),
    true,
  )
})

test('isVueSuspenseWarning: matches warning as substring of a longer message', () => {
  assert.equal(
    isVueSuspenseWarning(
      '[Vue warn]: <Suspense> is an experimental feature and its API will likely change.',
    ),
    true,
  )
})

test('isVueSuspenseWarning: rejects other warning strings', () => {
  assert.equal(
    isVueSuspenseWarning(
      '[Vue warn]: Failed to resolve component: FooBar',
    ),
    false,
  )
})

test('isVueSuspenseWarning: rejects non-string arguments', () => {
  assert.equal(isVueSuspenseWarning(undefined), false)
  assert.equal(isVueSuspenseWarning(null), false)
  assert.equal(isVueSuspenseWarning(42), false)
  assert.equal(isVueSuspenseWarning({}), false)
  assert.equal(isVueSuspenseWarning([]), false)
})

test('isVueSuspenseWarning: rejects empty string', () => {
  assert.equal(isVueSuspenseWarning(''), false)
})

test('isTiptapDuplicateExtensionWarning: matches the known Nuxt Studio duplicate-extension warning', () => {
  assert.equal(
    isTiptapDuplicateExtensionWarning(
      '[tiptap warn]: Duplicate extension names found: [\'image\']. This can lead to issues.',
    ),
    true,
  )
})

test('isTiptapDuplicateExtensionWarning: rejects unrelated warn strings', () => {
  assert.equal(
    isTiptapDuplicateExtensionWarning('[tiptap]: something else'),
    false,
  )
})

test('isSvgXsAttributeError: matches the known Nuxt Studio SVG-xs attribute DOM warning', () => {
  assert.equal(
    isSvgXsAttributeError('Error: <svg> attribute width: Expected length, "xs".'),
    true,
  )
  assert.equal(
    isSvgXsAttributeError('Error: <svg> attribute height: Expected length, "xs".'),
    true,
  )
})

test('isSvgXsAttributeError: rejects unrelated svg errors', () => {
  assert.equal(
    isSvgXsAttributeError('Error: <svg> attribute viewBox: Expected length, "0 0 24 24".'),
    false,
  )
})
