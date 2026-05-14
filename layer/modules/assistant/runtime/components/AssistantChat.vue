<script setup lang="ts">
import { useTockDocsI18n } from '../../../../app/composables/useTockDocsI18n'

const appConfig = useAppConfig()
const { toggle } = useAssistant()
const { t } = useTockDocsI18n()

const tooltipText = computed(() => t('assistant.tooltip'))
const triggerIcon = computed(() => appConfig.assistant?.icons?.trigger || 'i-custom-ai')
</script>

<template>
  <UTooltip :text="tooltipText">
    <UButton
      :icon="triggerIcon"
      color="neutral"
      variant="ghost"
      @click="toggle"
    />
  </UTooltip>
</template>
