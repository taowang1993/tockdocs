<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { UIMessage } from 'ai'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { createReusableTemplate } from '@vueuse/core'
import { useTockDocs } from '../../../../app/composables/useTockDocs'
import { useTockDocsI18n } from '../../../../app/composables/useTockDocsI18n'
import { sanitizeAssistantText } from '../utils/sanitize'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const components: Record<string, any> = {
  pre: defineAsyncComponent(() => import('./AssistantPreStream.vue')),
}

const [DefineChatContent, ReuseChatContent] = createReusableTemplate<{ showExpandButton?: boolean }>()

const { isOpen, isExpanded, isMobile, isResizing, panelWidth, toggleExpanded, setDesktopWidth, setResizing, messages, pendingMessage, clearPending, faqQuestions } = useAssistant()
const config = useRuntimeConfig()
const toast = useToast()
const { t } = useTockDocsI18n()
const docs = useTockDocs()
const input = ref('')
const router = useRouter()

function handleLinkClick(event: MouseEvent) {
  const anchor = event.target instanceof Element
    ? event.target.closest('a') as HTMLAnchorElement | null
    : null

  if (
    !anchor
    || event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) {
    return
  }

  const rawHref = anchor.getAttribute('href')
  if (
    !rawHref
    || (anchor.target && anchor.target !== '_self')
    || anchor.hasAttribute('download')
    || anchor.getAttribute('rel')?.includes('external')
    || rawHref.startsWith('#')
    || rawHref.startsWith('mailto:')
    || rawHref.startsWith('tel:')
  ) {
    return
  }

  let linkUrl: URL

  try {
    linkUrl = new URL(rawHref, window.location.href)
  }
  catch {
    return
  }

  if (!['http:', 'https:'].includes(linkUrl.protocol)) {
    return
  }

  if (linkUrl.origin !== window.location.origin) {
    event.preventDefault()
    window.open(linkUrl.toString(), '_blank', 'noopener,noreferrer')
    return
  }

  event.preventDefault()
  void router.push(linkUrl.pathname + linkUrl.search + linkUrl.hash)
}

const displayPanelTitle = computed(() => t('assistant.panelTitle'))
const displayGreeting = computed(() => t('assistant.greeting'))
const displayPlaceholder = computed(() => t('assistant.placeholder'))

const chat = new Chat({
  messages: messages.value,
  transport: new DefaultChatTransport({
    api: (config.app?.baseURL.replace(/\/$/, '') || '') + config.public.assistant.apiPath,
    headers: () => ({
      'X-TockDocs-KB': docs.activeKnowledgeBase.value?.id || '',
      'X-TockDocs-Locale': docs.activeLocale.value || '',
    }),
  }),
  onError: (error: Error) => {
    const message = (() => {
      try {
        const parsed = JSON.parse(error.message)
        return parsed?.message || error.message
      }
      catch {
        return error.message
      }
    })()

    toast.add({
      description: message,
      icon: 'i-lucide-alert-circle',
      color: 'error',
      duration: 0,
    })
  },
  onFinish: () => {
    messages.value = chat.messages
  },
})

watch(pendingMessage, (message: string | undefined) => {
  if (message) {
    if (messages.value.length === 0 && chat.messages.length > 0) {
      chat.messages.length = 0
    }
    chat.sendMessage({
      text: message,
    })
    clearPending()
  }
}, { immediate: true })

watch(messages, (newMessages: UIMessage[]) => {
  if (newMessages.length === 0 && chat.messages.length > 0) {
    chat.messages.length = 0
  }
}, { deep: true })

const lastMessage = computed(() => chat.messages.at(-1))
const showThinking = computed(() =>
  chat.status === 'streaming'
  && lastMessage.value?.role === 'assistant'
  && !lastMessage.value?.parts?.some((p: { type: string }) => p.type === 'text'),
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMessageToolCalls(message: any) {
  if (!message?.parts) return []
  return message.parts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.type === 'data-tool-calls')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .flatMap((p: any) => p.data?.tools || [])
}

function handleSubmit(event?: Event) {
  event?.preventDefault()

  if (!input.value.trim()) {
    return
  }

  chat.sendMessage({
    text: input.value,
  })

  input.value = ''
}

function askQuestion(question: string) {
  chat.sendMessage({
    text: question,
  })
}

function resetChat() {
  chat.stop()
  messages.value = []
  chat.messages.length = 0
}

let resizeStartX = 0
let resizeStartWidth = 0

function stopResize() {
  if (!isResizing.value) {
    return
  }

  setResizing(false)

  if (!import.meta.client) {
    return
  }

  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function updateResize(clientX: number) {
  if (!isResizing.value) {
    return
  }

  const nextWidth = resizeStartWidth - (clientX - resizeStartX)
  setDesktopWidth(nextWidth)
}

function handlePointerMove(event: PointerEvent) {
  updateResize(event.clientX)
}

function startResize(event: PointerEvent) {
  if (event.button !== 0 || !import.meta.client) {
    return
  }

  event.preventDefault()
  setResizing(true)
  resizeStartX = event.clientX
  resizeStartWidth = panelWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
  }

  if (pendingMessage.value) {
    chat.sendMessage({
      text: pendingMessage.value,
    })
    clearPending()
  }
  else if (chat.lastMessage?.role === 'user') {
    chat.regenerate()
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }

  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', stopResize)
  window.removeEventListener('pointercancel', stopResize)
  stopResize()
})
</script>

<template>
  <DefineChatContent v-slot="{ showExpandButton = true }">
    <div class="flex h-full flex-col">
      <div class="flex h-16 shrink-0 items-center justify-between border-b border-default px-4">
        <div class="flex items-center gap-2 text-highlighted">
          <UIcon
            name="i-lucide-sparkles"
            class="size-4 shrink-0 text-primary"
          />
          <span class="text-base font-semibold leading-5">{{ displayPanelTitle }}</span>
        </div>
        <div class="flex items-center gap-1">
          <UTooltip
            v-if="showExpandButton"
            :text="isExpanded ? t('assistant.collapse') : t('assistant.expand')"
          >
            <UButton
              :icon="isExpanded ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
              color="neutral"
              variant="ghost"
              size="sm"
              class="text-muted hover:text-highlighted"
              @click="toggleExpanded"
            />
          </UTooltip>
          <UTooltip
            v-if="chat.messages.length > 0"
            :text="t('assistant.clearChat')"
          >
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="sm"
              class="text-muted hover:text-highlighted"
              @click="resetChat"
            />
          </UTooltip>
          <UTooltip :text="t('assistant.close')">
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              class="text-muted hover:text-highlighted"
              @click="isOpen = false"
            />
          </UTooltip>
        </div>
      </div>

      <div
        class="min-h-0 flex-1 overflow-y-auto"
        @click="handleLinkClick"
      >
        <UChatMessages
          v-if="chat.messages.length > 0"
          :messages="chat.messages"
          compact
          :status="chat.status"
          :user="{ ui: { content: 'text-sm' } }"
          :ui="{ indicator: '*:bg-accented', root: 'h-auto!' }"
          class="px-4 py-4"
        >
          <template #content="{ message }">
            <div class="flex flex-col gap-2">
              <AssistantLoading
                v-if="message.role === 'assistant' && (getMessageToolCalls(message).length > 0 || (showThinking && message.id === lastMessage?.id))"
                :tool-calls="getMessageToolCalls(message)"
                :is-loading="showThinking && message.id === lastMessage?.id"
              />
              <template
                v-for="(part, index) in message.parts"
                :key="`${message.id}-${part.type}-${index}${'state' in part ? `-${part.state}` : ''}`"
              >
                <MDCCached
                  v-if="part.type === 'text' && part.text"
                  :value="sanitizeAssistantText(part.text)"
                  :cache-key="`${message.id}-${index}`"
                  :components="components"
                  :parser-options="{ highlight: false }"
                  class="*:first:mt-0 *:last:mb-0"
                />
              </template>
            </div>
          </template>
        </UChatMessages>

        <div
          v-else
          class="flex h-full flex-col"
        >
          <div
            :class="faqQuestions?.length
              ? 'px-4 pt-6 text-center'
              : 'flex flex-1 items-center justify-center px-4 text-center'"
          >
            <p class="text-sm font-medium text-muted">
              {{ displayGreeting }}
            </p>
          </div>

          <div
            v-if="faqQuestions?.length"
            class="flex flex-col gap-5 p-4"
          >
            <p class="mb-4 text-sm font-medium text-muted">
              {{ t('assistant.faq') }}
            </p>

            <div class="flex flex-col gap-5">
              <div
                v-for="category in faqQuestions"
                :key="category.category"
                class="flex flex-col gap-1.5"
              >
                <h4 class="text-xs font-medium uppercase tracking-wide text-dimmed">
                  {{ category.category }}
                </h4>
                <div class="flex flex-col">
                  <button
                    v-for="question in category.items"
                    :key="question"
                    class="py-1.5 text-left text-sm text-muted transition-colors hover:text-highlighted"
                    @click="askQuestion(question)"
                  >
                    {{ question }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="w-full shrink-0 p-3">
        <UChatPrompt
          v-model="input"
          :rows="1"
          :placeholder="displayPlaceholder"
          maxlength="1000"
          :ui="{
            root: 'shadow-none!',
            body: '*:p-0! *:rounded-none! *:text-base!',
          }"
          @submit="handleSubmit"
        >
          <template #footer>
            <div class="flex items-center gap-1 text-xs text-muted">
              <span>{{ t('assistant.lineBreak') }}</span>
              <UKbd
                size="sm"
                value="shift"
              />
              <UKbd
                size="sm"
                value="enter"
              />
            </div>
            <UChatPromptSubmit
              class="ml-auto"
              size="sm"
              :status="chat.status"
              @stop="chat.stop()"
              @reload="chat.regenerate()"
            />
          </template>
        </UChatPrompt>
        <div class="mt-1 flex text-xs text-dimmed items-center justify-between">
          <span>{{ t('assistant.chatCleared') }}</span>
          <span>
            {{ input.length }}/1000
          </span>
        </div>
      </div>
    </div>
  </DefineChatContent>

  <aside
    v-if="!isMobile"
    :class="[
      'left-auto! fixed top-0 z-50 h-dvh overflow-visible border-l border-default bg-default/95 backdrop-blur-xl will-change-[right,width]',
      isResizing ? 'transition-none' : 'transition-[right,width] duration-200 ease-linear',
    ]"
    :style="{
      width: `${panelWidth}px`,
      right: isOpen ? '0' : `-${panelWidth}px`,
    }"
  >
    <button
      v-if="isOpen"
      type="button"
      class="absolute inset-y-0 left-0 z-20 hidden w-8 -translate-x-1/2 cursor-col-resize bg-transparent lg:block"
      aria-label="Resize assistant sidebar"
      aria-orientation="vertical"
      @pointerdown="startResize"
    >
      <span class="sr-only">Resize assistant sidebar</span>
    </button>

    <div
      :class="[
        'h-full overflow-hidden',
        isResizing ? 'transition-none' : 'transition-[width] duration-200 ease-linear',
      ]"
      :style="{ width: `${panelWidth}px` }"
    >
      <ReuseChatContent :show-expand-button="true" />
    </div>
  </aside>

  <USlideover
    v-else
    v-model:open="isOpen"
    side="right"
    :ui="{
      content: 'ring-0 bg-default',
    }"
  >
    <template #content>
      <ReuseChatContent :show-expand-button="false" />
    </template>
  </USlideover>
</template>
