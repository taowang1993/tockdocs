import type { UIMessage } from 'ai'
import { useAppConfig, useRuntimeConfig, useState } from '#imports'
import { useMediaQuery } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import type { FaqCategory, FaqQuestions, LocalizedFaqQuestions } from '../types'

function normalizeFaqQuestions(questions: FaqQuestions): FaqCategory[] {
  if (!questions || (Array.isArray(questions) && questions.length === 0)) {
    return []
  }

  if (typeof questions[0] === 'string') {
    return [{
      category: 'Questions',
      items: questions as string[],
    }]
  }

  return questions as FaqCategory[]
}

const PANEL_WIDTH_COMPACT = 352
const PANEL_WIDTH_EXPANDED = 520
const PANEL_WIDTH_MIN = 320
const PANEL_WIDTH_MAX = 520

function clampDesktopAssistantWidth(width: number) {
  return Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, Math.round(width)))
}

export function useAssistant() {
  const config = useRuntimeConfig()
  const appConfig = useAppConfig()
  const docs = useTockDocs()
  const assistantRuntimeConfig = config.public.assistant as { enabled?: boolean } | undefined
  const assistantConfig = appConfig.assistant as { faqQuestions?: FaqQuestions | LocalizedFaqQuestions } | undefined
  const isEnabled = computed(() => assistantRuntimeConfig?.enabled ?? false)

  const isOpen = useState('assistant-open', () => false)
  const isResizing = useState('assistant-resizing', () => false)
  const desktopWidth = useState('assistant-desktop-width', () => PANEL_WIDTH_COMPACT)
  const messages = useState<UIMessage[]>('assistant-messages', () => [])
  const pendingMessage = useState<string | undefined>('assistant-pending', () => undefined)
  const scopeKey = useState('assistant-scope', () => '')

  const isHydrated = ref(false)
  onMounted(() => {
    isHydrated.value = true
  })

  const isMobile = useMediaQuery('(max-width: 767px)')
  const panelWidth = computed(() => desktopWidth.value)
  const isExpanded = computed(() => desktopWidth.value > PANEL_WIDTH_COMPACT)
  const shouldPushContent = computed(() => isHydrated.value && !isMobile.value && isOpen.value && docs.isDocsRoute.value)
  const currentScopeKey = computed(() => `${docs.activeKnowledgeBase.value?.id || 'site'}:${docs.activeLocale.value || config.public.i18n?.defaultLocale || 'en'}`)

  watch(() => docs.isDocsRoute.value, (value) => {
    if (!value) {
      isOpen.value = false
      isResizing.value = false
    }
  }, { immediate: true })

  watch(currentScopeKey, (value) => {
    if (scopeKey.value && scopeKey.value !== value) {
      messages.value = []
      pendingMessage.value = undefined
    }

    scopeKey.value = value
  }, { immediate: true })

  const faqQuestions = computed<FaqCategory[]>(() => {
    const faqConfig = assistantConfig?.faqQuestions
    if (!faqConfig) return []

    if (!Array.isArray(faqConfig)) {
      const localizedConfig = faqConfig as LocalizedFaqQuestions
      const currentLocale = docs.activeLocale.value || config.public.i18n?.defaultLocale || 'en'
      const defaultLocale = config.public.i18n?.defaultLocale || 'en'
      const questions = localizedConfig[currentLocale]
        || localizedConfig[defaultLocale]
        || Object.values(localizedConfig)[0]

      return normalizeFaqQuestions(questions || [])
    }

    return normalizeFaqQuestions(faqConfig)
  })

  function open(initialMessage?: string, clearPrevious = false) {
    if (!docs.isDocsRoute.value || !isEnabled.value) {
      return
    }

    if (clearPrevious) {
      messages.value = []
    }

    if (initialMessage) {
      pendingMessage.value = initialMessage
    }
    isOpen.value = true
  }

  function clearPending() {
    pendingMessage.value = undefined
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function clearMessages() {
    messages.value = []
  }

  function setDesktopWidth(width: number) {
    desktopWidth.value = clampDesktopAssistantWidth(width)
  }

  function setResizing(value: boolean) {
    isResizing.value = value
  }

  function toggleExpanded() {
    setDesktopWidth(isExpanded.value ? PANEL_WIDTH_COMPACT : PANEL_WIDTH_EXPANDED)
  }

  return {
    isEnabled,
    isOpen,
    isHydrated,
    isExpanded,
    isMobile,
    isResizing,
    panelWidth,
    shouldPushContent,
    messages,
    pendingMessage,
    faqQuestions,
    open,
    clearPending,
    close,
    toggle,
    toggleExpanded,
    setDesktopWidth,
    setResizing,
    clearMessages,
  }
}
