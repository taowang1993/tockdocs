import type { ContextMenuItem } from '@nuxt/ui'

function isSvgUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.svg')
}

function getExtension(url: string): string {
  const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i)
  return match?.[1] ? `.${match[1].toLowerCase()}` : '.png'
}

function toSvgId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'logo'
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function normalizeSvg(svg: string, name: string): string {
  let result = svg.replace(/\b(fill|stroke)="(black|white|#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))"/g, '$1="currentColor"')

  if (name) {
    const safeName = escapeXml(name)
    result = result.replace(/<svg\b/, `<svg id="${toSvgId(name)}"`)
    result = result.replace(/(<svg[^>]*>)/, `$1<title>${safeName}</title>`)
  }

  return result
}

async function fetchSvgContent(url: string, name: string): Promise<string | null> {
  try {
    const absoluteUrl = new URL(url, window.location.origin).href
    const response = await fetch(absoluteUrl)
    if (!response.ok) return null
    const text = await response.text()
    return normalizeSvg(text, name)
  }
  catch {
    return null
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  }
  catch {
    return false
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function triggerLinkDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const useLogoAssets = () => {
  const appConfig = useAppConfig()
  const colorMode = useColorMode() as { value: string, forced?: boolean }
  const toast = useToast()
  const { t } = useTockDocsI18n()

  const hasLogo = computed(() => !!(appConfig.header?.logo?.light || appConfig.header?.logo?.dark))

  const currentLogoUrl = computed(() => {
    const logo = appConfig.header?.logo
    if (!logo) return ''
    if (colorMode.value === 'dark') return logo.dark || logo.light || ''
    return logo.light || logo.dark || ''
  })

  const headerLightUrl = computed(() => {
    const logo = appConfig.header?.logo
    if (!logo) return ''
    return logo.light || logo.dark || ''
  })

  const headerDarkUrl = computed(() => {
    const logo = appConfig.header?.logo
    if (!logo) return ''
    return logo.dark || logo.light || ''
  })

  const faviconUrl = computed(() => appConfig.header?.logo?.favicon || '/favicon.ico')

  const logoAlt = computed(() => appConfig.header?.logo?.alt || appConfig.header?.title || '')

  const brandName = computed(() => appConfig.header?.title || logoAlt.value || '')

  const prefix = computed(() => {
    const name = brandName.value
    return name ? name.toLowerCase().replace(/\s+/g, '-') : 'logo'
  })

  const logoName = computed(() => {
    const name = brandName.value
    return name ? `${name} Logo` : 'Logo'
  })

  const logoIsSvg = computed(() => isSvgUrl(currentLogoUrl.value))

  const brandAssetsUrl = computed(() => appConfig.header?.logo?.brandAssetsUrl || '')

  async function copyLogo() {
    if (!logoIsSvg.value) return
    const svg = await fetchSvgContent(currentLogoUrl.value, logoName.value)
    if (!svg) {
      toast.add({ title: t('logo.copyLogoFailed'), icon: 'i-lucide-circle-x', color: 'error' })
      return
    }
    const ok = await copyTextToClipboard(svg)
    toast.add(ok
      ? { title: t('logo.logoCopied'), icon: 'i-lucide-circle-check', color: 'success' }
      : { title: t('logo.copyLogoFailed'), icon: 'i-lucide-circle-x', color: 'error' },
    )
  }

  async function downloadLogo() {
    const url = currentLogoUrl.value
    if (logoIsSvg.value) {
      const svg = await fetchSvgContent(url, logoName.value)
      if (!svg) return
      triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), `${prefix.value}-logo.svg`)
    }
    else {
      triggerLinkDownload(url, `${prefix.value}-logo${getExtension(url)}`)
    }
    toast.add({ title: t('logo.logoDownloaded'), icon: 'i-lucide-download', color: 'success' })
  }

  const contextMenuItems = computed(() => {
    if (!hasLogo.value) return []

    const copyGroup: ContextMenuItem[] = []
    if (logoIsSvg.value) {
      copyGroup.push({ label: t('logo.copyLogo'), icon: 'i-lucide-copy', onSelect: copyLogo })
    }

    const downloadGroup: ContextMenuItem[] = [
      { label: t('logo.downloadLogo'), icon: 'i-lucide-download', onSelect: downloadLogo },
    ]

    const items: ContextMenuItem[][] = []
    if (copyGroup.length) items.push(copyGroup)
    items.push(downloadGroup)

    if (brandAssetsUrl.value) {
      items.push([{
        label: t('logo.brandAssets'),
        icon: 'i-lucide-palette',
        onSelect() {
          window.open(brandAssetsUrl.value, '_blank')
        },
      }])
    }

    return items
  })

  return {
    hasLogo,
    currentLogoUrl,
    headerLightUrl,
    headerDarkUrl,
    faviconUrl,
    logoAlt,
    contextMenuItems,
    copyLogo,
    downloadLogo,
    copyTextToClipboard,
    fetchSvgContent,
  }
}
