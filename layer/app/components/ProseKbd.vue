<script setup lang="ts">
const props = defineProps<{
  value: string
  class?: string | string[] | Record<string, boolean>
  ui?: object
}>()

defineSlots()
</script>

<template>
  <UKbd
    :value="props.value"
    class="align-text-top"
    :class="props.class"
    :ui="props.ui"
  />
</template>
