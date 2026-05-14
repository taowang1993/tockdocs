import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..')

function loadAssistantPanel(): string {
  const path = resolve(repoRoot, 'layer/modules/assistant/runtime/components/AssistantPanel.vue')
  assert.ok(existsSync(path), `AssistantPanel.vue not found at ${path}`)
  return readFileSync(path, 'utf-8')
}

function loadAppVue(): string {
  const path = resolve(repoRoot, 'layer/app/app.vue')
  assert.ok(existsSync(path), `app.vue not found at ${path}`)
  return readFileSync(path, 'utf-8')
}

function loadUseAssistant(): string {
  const path = resolve(repoRoot, 'layer/modules/assistant/runtime/composables/useAssistant.ts')
  assert.ok(existsSync(path), `useAssistant.ts not found at ${path}`)
  return readFileSync(path, 'utf-8')
}

// ── AssistantPanel greeting ──

test('AssistantPanel uses displayGreeting for the welcome message', () => {
  const content = loadAssistantPanel()

  assert.ok(
    content.includes('displayGreeting'),
    'AssistantPanel must use displayGreeting computed property for the welcome greeting',
  )
})

test('AssistantPanel greeting is a single centered line', () => {
  const content = loadAssistantPanel()

  // The greeting must be a plain centered text block — no icon or circular bubble
  assert.ok(
    content.includes('text-center'),
    'AssistantPanel greeting must be center-aligned',
  )

  // Greeting text should be a simple <p> with text-muted class, not an icon-based hero block
  assert.ok(
    content.includes('class="text-sm font-medium text-muted"'),
    'AssistantPanel greeting must be a single text-muted line',
  )
})

test('AssistantPanel greeting has no icon or divider', () => {
  const content = loadAssistantPanel()

  // The old bubble icon and divider must be absent from the empty-state area
  // The greeting area is inside the v-else block (no messages)
  const emptyStateIndex = content.indexOf('v-else')
  const afterEmptyState = content.slice(emptyStateIndex)

  assert.ok(
    !afterEmptyState.includes('i-lucide-message-circle-question'),
    'AssistantPanel empty state must not contain a message-circle-question icon',
  )
  assert.ok(
    !afterEmptyState.includes('border-b border-default'),
    'AssistantPanel empty state must not contain a divider (border-b)',
  )
})

// ── AssistantPanel FAQ conditional ──

test('AssistantPanel FAQ section is gated behind faqQuestions?.length', () => {
  const content = loadAssistantPanel()

  assert.ok(
    content.includes('v-if="faqQuestions?.length"'),
    'AssistantPanel FAQ section must use v-if="faqQuestions?.length" so it only renders when configured',
  )
})

test('AssistantPanel uses t(\'assistant.faq\') for the FAQ heading', () => {
  const content = loadAssistantPanel()

  assert.ok(
    content.includes('t(\'assistant.faq\')'),
    'AssistantPanel FAQ heading must use the i18n key assistant.faq',
  )
})

// ── useAssistant route-awareness ──

test('useAssistant closes on non-docs routes', () => {
  const content = loadUseAssistant()

  assert.ok(
    content.includes('docs.isDocsRoute.value'),
    'useAssistant must check docs.isDocsRoute to auto-close the panel',
  )
  assert.ok(
    content.includes('isOpen.value = false'),
    'useAssistant must set isOpen to false when leaving docs routes',
  )
})

test('useAssistant shouldPushContent respects isDocsRoute', () => {
  const content = loadUseAssistant()

  assert.ok(
    content.includes('shouldPushContent = computed(() => isHydrated.value && !isMobile.value && isOpen.value && docs.isDocsRoute.value)'),
    'useAssistant shouldPushContent must gate on docs.isDocsRoute so the layout does not shift on landing pages',
  )
})

test('useAssistant open() guards against non-docs routes', () => {
  const content = loadUseAssistant()

  assert.ok(
    content.includes('if (!docs.isDocsRoute.value || !isEnabled.value)'),
    'useAssistant open() must return early when not on a docs route',
  )
})

// ── app.vue assistant visibility ──

test('app.vue gates assistant UI on showAssistantUi', () => {
  const content = loadAppVue()

  assert.ok(
    content.includes('showAssistantUi'),
    'app.vue must define a showAssistantUi computed property',
  )
  assert.ok(
    content.includes('v-if="showAssistantUi"'),
    'app.vue must use v-if="showAssistantUi" to control assistant component rendering',
  )
})

test('app.vue showAssistantUi respects isDocsRoute', () => {
  const content = loadAppVue()

  assert.ok(
    content.includes('isAssistantEnabled.value && docs.isDocsRoute.value'),
    'app.vue showAssistantUi must gate on both assistant enabled and the current route being a docs route',
  )
})
