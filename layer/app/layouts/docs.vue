<script setup lang="ts">
const { shouldPushContent: assistantDocked } = useAssistant()
</script>

<template>
  <UMain>
    <UContainer :class="assistantDocked ? 'px-2 sm:px-3 lg:px-5' : ''">
      <UPage>
        <template #left>
          <UPageAside class="lg:!ps-0 lg:!pe-0 lg:!ms-0">
            <div data-markdown-ignore>
              <DocsAsideLeftTop />
              <DocsAsideLeftBody />
            </div>
          </UPageAside>
        </template>
        <slot />
      </UPage>
    </UContainer>
  </UMain>
</template>
