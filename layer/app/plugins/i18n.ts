import type { RouteLocationNormalized } from 'vue-router'
import { consola } from 'consola'
import { getDefaultLocale, getDocsMode, getFilteredLocaleCodes, resolveDocsRoute } from '../../utils/docs'
import { hasLocaleMessages, resolveLocaleMessages } from '../../utils/locale-messages'

const log = consola.withTag('TockDocs')

export default defineNuxtPlugin(() => {
  const nuxtApp = useNuxtApp()
  const appConfig = useAppConfig()
  const localeCatalog = appConfig.tockdocs.localeMessages || {}
  const publicConfig = nuxtApp.$config.public as Parameters<typeof getDocsMode>[0]
  const i18nConfig = publicConfig.i18n

  if (!i18nConfig) {
    const configuredLocale = appConfig.tockdocs.locale || 'en'
    const locale = hasLocaleMessages(configuredLocale, localeCatalog) ? configuredLocale : 'en'

    if (locale !== configuredLocale) {
      log.warn(`Missing locale file for "${configuredLocale}". Falling back to "en".`)
    }

    const resolvedMessages = resolveLocaleMessages(locale, localeCatalog)

    nuxtApp.provide('locale', locale)
    nuxtApp.provide('localeMessages', resolvedMessages)

    return
  }

  const docsMode = getDocsMode(publicConfig)
  const defaultLocale = getDefaultLocale(publicConfig)
  const filteredLocales = getFilteredLocaleCodes(publicConfig)

  function syncLocale(path: string) {
    const resolved = resolveDocsRoute(path, publicConfig)
    const nextLocale = resolved.locale || defaultLocale

    if (nuxtApp.$i18n?.locale.value !== nextLocale) {
      nuxtApp.$i18n.locale.value = nextLocale
    }
  }

  syncLocale(useRoute().path)

  addRouteMiddleware((to: RouteLocationNormalized) => {
    if (docsMode === 'legacy' && to.path === '/') {
      const cookieLocale = useCookie('i18n_redirected').value || i18nConfig.defaultLocale || defaultLocale
      return navigateTo(`/${cookieLocale}`)
    }

    if (docsMode === 'legacy' && filteredLocales.length > 0 && to.path !== '/') {
      const firstSegment = to.path.split('/').filter(Boolean)[0]
      if (firstSegment && !filteredLocales.includes(firstSegment)) {
        return navigateTo(`/${i18nConfig.defaultLocale || defaultLocale}${to.path}`)
      }
    }

    syncLocale(to.path)
  })
})
