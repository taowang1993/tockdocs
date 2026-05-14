export type LocaleMessageCatalog = Record<string, Record<string, unknown>>

export function hasLocaleMessages(locale: string, localeMessages: LocaleMessageCatalog): boolean {
  const normalizedLocale = locale.toLowerCase()
  return Object.keys(localeMessages).some(code => code.toLowerCase() === normalizedLocale || code.toLowerCase() === normalizedLocale.split('-')[0])
}

export function resolveLocaleMessages(locale: string, localeMessages: LocaleMessageCatalog): Record<string, unknown> {
  const normalizedLocale = locale.toLowerCase()
  const exactMatch = Object.entries(localeMessages).find(([code]) => code.toLowerCase() === normalizedLocale)?.[1]
  if (exactMatch) {
    return exactMatch
  }

  const baseLocale = normalizedLocale.split('-')[0]
  const baseMatch = Object.entries(localeMessages).find(([code]) => code.toLowerCase() === baseLocale)?.[1]
  if (baseMatch) {
    return baseMatch
  }

  return localeMessages.en || {}
}

export function getLocaleMessageValue(messages: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!messages) {
    return undefined
  }

  const value = key.split('.').reduce<unknown>((acc, segment) => {
    if (!acc || typeof acc !== 'object') {
      return undefined
    }

    return (acc as Record<string, unknown>)[segment]
  }, messages)

  return typeof value === 'string' ? value : undefined
}
