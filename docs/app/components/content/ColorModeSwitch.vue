<script setup>
const colorMode = useColorMode()

const isLight = computed({
  get() {
    return colorMode.value === 'light'
  },
  set(_isLight) {
    colorMode.preference = _isLight ? 'light' : 'dark'
  },
})
</script>

<template>
  <div data-markdown-ignore>
    <ClientOnly>
      <div class="flex-1 flex items-center justify-center">
        <USwitch
          v-model="isLight"
          unchecked-icon="i-lucide-moon"
          checked-icon="i-lucide-sun"
          aria-label="Toggle color mode"
          size="xl"
          color="neutral"
          :ui="{
            base: 'w-70 h-35 rounded-lg rotate-90 data-[state=checked]:bg-[var(--ui-color-neutral-200)]',
            thumb: 'data-[state=checked]:translate-x-35 data-[state=checked]:rtl:-translate-x-35 rounded-lg size-34',
            icon: 'rotate-270 size-8',
          }"
        />
      </div>

      <template #fallback>
        <div class="flex-1 flex items-center justify-center">
          <div
            aria-hidden="true"
            class="relative flex h-35 w-70 rotate-90 items-center rounded-lg border border-transparent bg-neutral-200 px-[3px] dark:bg-neutral-800"
          >
            <div class="flex h-34 w-34 items-center justify-center rounded-lg border border-transparent bg-white text-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
              <svg
                class="size-8 -rotate-90"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            </div>
            <div class="absolute right-[3px] flex h-34 w-34 items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-300">
              <svg
                class="h-5 w-5 -rotate-90"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              >
                <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
              </svg>
            </div>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
