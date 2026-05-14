<script setup lang="ts">
const props = withDefaults(defineProps<{
  locale?: 'en' | 'zh'
  path?: string
  mode?: 'header' | 'aside'
  title?: string
}>(), {
  locale: 'en',
  path: 'getting-started/introduction',
  mode: 'header',
  title: 'TockDocs UI preview',
})

const scaledWidth = 960
const scaledHeight = 540
const frameWidth = 1600
const frameHeight = 900
const frameScale = Math.min(scaledWidth / frameWidth, scaledHeight / frameHeight)

const src = computed(() => `/docs/manual/${props.locale}/${props.path}?__previewSubnav=${props.mode}`)
const viewportStyle = {
  width: `${scaledWidth}px`,
  height: `${scaledHeight}px`,
}
const stageStyle = {
  width: `${frameWidth}px`,
  height: `${frameHeight}px`,
  transform: `translateX(-50%) scale(${frameScale})`,
  transformOrigin: 'top center',
}
</script>

<template>
  <div
    class="not-prose overflow-hidden rounded-xl border border-muted bg-accented shadow-md"
    data-markdown-ignore
  >
    <div class="flex items-center justify-between border-b border-accented bg-accented px-3 py-1.5 text-xs text-muted">
      <div class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-full bg-red-500" />
        <span class="h-2.5 w-2.5 rounded-full bg-yellow-500" />
        <span class="h-2.5 w-2.5 rounded-full bg-green-500" />
      </div>
      <span>{{ title }}</span>
      <span
        class="opacity-0"
        aria-hidden="true"
      >•••</span>
    </div>

    <div class="overflow-hidden bg-default p-0">
      <div
        class="relative mx-auto max-w-full overflow-hidden"
        :style="viewportStyle"
      >
        <div
          class="absolute left-1/2 top-0"
          :style="stageStyle"
        >
          <iframe
            :src="src"
            :title="title"
            loading="lazy"
            class="block h-full w-full border-0 pointer-events-none bg-default"
          />
        </div>
      </div>
    </div>
  </div>
</template>
