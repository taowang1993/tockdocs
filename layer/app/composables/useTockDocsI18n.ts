import { useNuxtApp, useRuntimeConfig } from '#imports'
import type { LocaleObject } from '@nuxtjs/i18n'
import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import { getLocaleMessageValue, resolveLocaleMessages } from '../../utils/locale-messages'

type TockDocsNuxtApp = ReturnType<typeof useNuxtApp> & {
  $i18n?: {
    locale: Ref<string>
    t: (key: string) => string
    messages?: Ref<Record<string, Record<string, unknown>>>
  }
  $locale?: string
  $localeMessages?: Record<string, unknown>
  $localePath?: (path: string) => string
  $switchLocalePath?: (locale?: string) => string
}

export const useTockDocsI18n = () => {
  const appConfig = useAppConfig()
  const localeCatalog = appConfig.tockdocs.localeMessages || {}
  const config = useRuntimeConfig().public
  const nuxtApp = useNuxtApp() as TockDocsNuxtApp
  const docs = useTockDocs()
  const isEnabled = ref(!!config.i18n)

  if (!isEnabled.value) {
    const locale = nuxtApp.$locale || 'en'
    const localeMessages = nuxtApp.$localeMessages || {}

    return {
      isEnabled,
      locale: ref(locale),
      locales: computed(() => []) as ComputedRef<LocaleObject<string>[]>,
      localePath: (path: string) => path,
      switchLocalePath: () => {},
      t: (key: string): string => {
        return getLocaleMessageValue(localeMessages, key) || key
      },
    }
  }

  const filteredLocales = ((config.tockdocs as { filteredLocales?: LocaleObject<string>[] } | undefined)?.filteredLocales) || []
  const locale = computed(() => docs.activeLocale.value || nuxtApp.$i18n?.locale.value || config.i18n?.defaultLocale || 'en')
  const locales = computed(() => {
    if (docs.mode.value !== 'kb' || !docs.isDocsRoute.value || !docs.activeKnowledgeBase.value) {
      return filteredLocales
    }

    const availableLocales = new Set(docs.activeKnowledgeBase.value.locales)
    return filteredLocales.filter(localeItem => availableLocales.has(localeItem.code))
  })
  const t = (key: string): string => {
    const currentLocale = locale.value
    const defaultLocale = config.i18n?.defaultLocale || 'en'
    const i18nMessages = nuxtApp.$i18n?.messages?.value

    return getLocaleMessageValue(i18nMessages?.[currentLocale], key)
      || getLocaleMessageValue(i18nMessages?.[defaultLocale], key)
      || getLocaleMessageValue(resolveLocaleMessages(currentLocale, localeCatalog), key)
      || getLocaleMessageValue(resolveLocaleMessages(defaultLocale, localeCatalog), key)
      || key
  }
  const localePath = (path: string) => docs.mode.value === 'kb'
    ? path
    : nuxtApp.$localePath?.(path) || path
  const switchLocalePath = (targetLocale?: string) => {
    if (!targetLocale) {
      return docs.isDocsRoute.value ? docs.switchLocalePath(locale.value) : ''
    }

    if (docs.mode.value === 'kb') {
      return docs.isDocsRoute.value ? docs.switchLocalePath(targetLocale) : ''
    }

    return nuxtApp.$switchLocalePath?.(targetLocale) || ''
  }

  return {
    isEnabled,
    locale,
    locales,
    t,
    localePath,
    switchLocalePath,
  }
}
