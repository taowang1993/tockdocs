const HEADER_LAYOUT_CLASSES = {
  default: {
    center: 'hidden lg:flex min-w-0 flex-1',
    searchButton: 'shrink-0 lg:hidden',
    desktopAskAiButton: 'hidden shrink-0 sm:inline-flex',
    mobileAskAiButton: 'shrink-0 lg:hidden',
    drawerOnly: 'lg:hidden',
    headerSelectors: 'hidden lg:flex items-center gap-1.5',
  },
  docked: {
    center: 'hidden lg:flex min-w-0 flex-1',
    searchButton: 'shrink-0 lg:hidden',
    desktopAskAiButton: 'hidden shrink-0 lg:inline-flex',
    mobileAskAiButton: 'shrink-0 lg:hidden',
    drawerOnly: 'lg:hidden',
    headerSelectors: 'hidden lg:flex items-center gap-1.5',
  },
  dockedExpanded: {
    center: 'hidden lg:flex min-w-0 flex-1',
    searchButton: 'shrink-0 lg:hidden',
    desktopAskAiButton: 'hidden shrink-0 lg:inline-flex',
    mobileAskAiButton: 'shrink-0 lg:hidden',
    drawerOnly: 'lg:hidden',
    headerSelectors: 'hidden lg:flex items-center gap-1.5',
  },
} as const

export function useHeaderLayout() {
  const route = useRoute()
  const { shouldPushContent, isExpanded } = useAssistant()

  const isAssistantDocked = computed(() => route.meta.layout === 'docs' && shouldPushContent.value)

  const classes = computed(() => {
    if (!isAssistantDocked.value) {
      return HEADER_LAYOUT_CLASSES.default
    }

    return isExpanded.value
      ? HEADER_LAYOUT_CLASSES.dockedExpanded
      : HEADER_LAYOUT_CLASSES.docked
  })

  return {
    classes,
    isAssistantDocked,
  }
}
