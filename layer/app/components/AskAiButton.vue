<script setup lang="ts">
const props = defineProps<{
  mobile?: boolean
}>()

const { isOpen, toggle } = useAssistant()
const { t } = useTockDocsI18n()

const label = computed(() => t('assistant.title'))
const testId = computed(() => props.mobile ? 'ask-ai-btn-mobile' : 'ask-ai-btn')
const buttonVariant = computed(() => props.mobile ? 'ghost' : 'outline')
const buttonClass = computed(() => {
  if (props.mobile) {
    return 'shrink-0'
  }

  return isOpen.value
    ? 'rounded-lg px-3.5 py-2 text-sm font-semibold text-highlighted shadow-xs'
    : 'rounded-lg px-3.5 py-2 text-sm font-semibold shadow-xs'
})
const leadingIconClass = computed(() => props.mobile ? 'size-4 text-primary' : 'size-4 text-primary')
</script>

<template>
  <UButton
    :data-testid="testId"
    color="neutral"
    :variant="buttonVariant"
    icon="i-lucide-sparkles"
    :label="props.mobile ? undefined : label"
    :aria-label="props.mobile ? label : undefined"
    :aria-pressed="isOpen"
    :class="buttonClass"
    :ui="{ leadingIcon: leadingIconClass }"
    @click="toggle"
  />
</template>
