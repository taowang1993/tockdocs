<script setup lang="ts">
const appConfig = useAppConfig()
const logoClass = computed(() => appConfig.header?.logo?.class || 'h-8')
const { hasLogo, headerLightUrl, headerDarkUrl, contextMenuItems } = useLogoAssets()
</script>

<template>
  <UContextMenu
    v-if="hasLogo"
    :items="contextMenuItems"
  >
    <UColorModeImage
      :light="headerLightUrl"
      :dark="headerDarkUrl"
      :alt="appConfig.header?.logo?.alt || appConfig.header?.title || ''"
      :class="[logoClass, 'w-auto shrink-0']"
    />
  </UContextMenu>
</template>
