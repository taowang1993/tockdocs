<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { useTockDocsI18n } from '../../../../app/composables/useTockDocsI18n'

const docs = useTockDocs()
const appConfig = useAppConfig()
const { open, isOpen } = useAssistant()
const { t } = useTockDocsI18n()
const input = ref('')
const isVisible = ref(true)
const inputRef = ref<HTMLTextAreaElement | null>(null)

const isDocsRoute = computed(() => docs.isDocsRoute.value)
const isFloatingInputEnabled = computed(() => appConfig.assistant?.floatingInput !== false)
const focusInputShortcut = computed(() => appConfig.assistant?.shortcuts?.focusInput || 'meta_i')
const placeholder = computed(() => t('assistant.placeholder'))

const shortcutDisplayKeys = computed(() => {
  const shortcut = focusInputShortcut.value
  const parts = shortcut.split('_')
  return parts.map((part: string) => {
    if (part === 'meta') {
      const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : ''
      const platform = typeof navigator !== 'undefined' ? (navigator.platform || '') : ''
      const isMac = /Mac|iPhone|iPad|iPod/.test(ua) || /Mac/.test(platform)
      return isMac ? '⌘' : 'Ctrl'
    }

    return part.toUpperCase()
  })
})

function handleSubmit() {
  if (!input.value.trim()) return

  const message = input.value
  isVisible.value = false

  setTimeout(() => {
    open(message, true)
    input.value = ''
    isVisible.value = true
  }, 200)
}

const shortcuts = computed(() => ({
  [focusInputShortcut.value]: {
    usingInput: true,
    handler: () => {
      if (!isDocsRoute.value || !isFloatingInputEnabled.value) return
      inputRef.value?.focus()
    },
  },
  escape: {
    usingInput: true,
    handler: () => {
      inputRef.value?.blur()
    },
  },
}))

defineShortcuts(shortcuts)
</script>

<template>
  <AnimatePresence>
    <motion.div
      v-if="isFloatingInputEnabled && isDocsRoute && isVisible && !isOpen"
      key="floating-input"
      :initial="{ y: 20, opacity: 0 }"
      :animate="{ y: 0, opacity: 1 }"
      :exit="{ y: 100, opacity: 0 }"
      :transition="{ duration: 0.2, ease: 'easeOut' }"
      class="pointer-events-none fixed inset-x-0 z-10 bottom-[max(1.5rem,env(safe-area-inset-bottom))] px-4 sm:px-80"
      style="will-change: transform"
    >
      <form
        class="pointer-events-none flex w-full justify-center"
        @submit.prevent="handleSubmit"
      >
        <div class="pointer-events-auto w-full max-w-[36rem]">
          <div class="rounded-xl border border-default bg-default/95 shadow-xl backdrop-blur-sm">
            <div class="flex min-h-[3rem] flex-col px-4 py-1.5">
              <textarea
                ref="inputRef"
                v-model="input"
                :placeholder="placeholder"
                rows="1"
                maxlength="1000"
                class="min-h-[1.75rem] w-full flex-1 resize-none bg-transparent text-sm leading-5 text-highlighted outline-none placeholder:text-muted [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                @keydown.enter.exact.prevent="handleSubmit"
              />

              <div class="mt-0.5 flex items-center justify-end gap-1.5">
                <div class="hidden sm:flex items-center justify-end gap-1 text-xs text-muted">
                  <UKbd
                    v-for="key in shortcutDisplayKeys"
                    :key="key"
                    :value="key"
                  />
                </div>

                <UChatPromptSubmit
                  size="sm"
                  class="shrink-0"
                  :disabled="!input.trim()"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  </AnimatePresence>
</template>
