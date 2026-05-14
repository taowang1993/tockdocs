<script setup lang="ts">
const route = useRoute()
const { sidebarNavigation } = useSubNavigation()
const navigationKey = computed(() => `${route.path}:${sidebarNavigation.value?.map(item => item.path).join('|') || 'navigation-empty'}`)

const contentNavVariants = useUIConfig('contentNavigation')
</script>

<template>
  <UContentNavigation
    :key="navigationKey"
    :highlight="contentNavVariants.highlight ?? true"
    :highlight-color="contentNavVariants.highlightColor"
    :variant="contentNavVariants.variant ?? 'link'"
    :color="contentNavVariants.color"
    :navigation="sidebarNavigation"
  />
</template>
