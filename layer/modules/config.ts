import { addPrerenderRoutes, createResolver, defineNuxtModule, logger } from '@nuxt/kit'
import { defu } from 'defu'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { formatOgDescription } from '../app/utils/ogImage'
import { inferSiteURL, getPackageJsonMetadata, normalizeSiteURL } from '../utils/meta'
import { getGitBranch, getGitEnv, getLocalGitInfo } from '../utils/git'
import { landingPageExists } from '../utils/pages'
import { getTockDocsContentConfiguration, type TockDocsContentConfiguration } from '../utils/knowledge-bases'

const log = logger.withTag('TockDocs')
const { resolve } = createResolver(import.meta.url)

type I18nLocale = string | { code: string, name?: string }
type TockDocsI18nOptions = { locales?: I18nLocale[], strategy?: string }
type RegisterModuleOptions = {
  langDir: string
  locales: Array<{ code: string, name: string, file: string }>
}

export default defineNuxtModule({
  meta: {
    name: 'config',
  },
  async setup(_options, nuxt) {
    const dir = nuxt.options.rootDir
    const meta = await getPackageJsonMetadata(dir)
    const gitInfo = await getLocalGitInfo(dir) || getGitEnv()
    const siteName = (typeof nuxt.options.site === 'object' && nuxt.options.site?.name) || meta.name || gitInfo?.name || ''
    const contentConfiguration = getTockDocsContentConfiguration(dir)
    const availableKnowledgeBaseLocales = new Set(contentConfiguration.knowledgeBases.flatMap(kb => kb.locales))
    const layerLocaleMessages = readLayerLocaleMessages()

    const configuredSiteUrl = typeof nuxt.options.site === 'object' && typeof nuxt.options.site?.url === 'string'
      ? normalizeSiteURL(nuxt.options.site.url)
      : undefined
    const inferredSiteUrl = inferSiteURL()
    const resolvedSiteUrl = configuredSiteUrl || inferredSiteUrl

    nuxt.options.site = defu(nuxt.options.site, {
      url: resolvedSiteUrl,
      name: siteName,
      debug: false,
    }) as typeof nuxt.options.site

    if (typeof nuxt.options.site === 'object' && typeof nuxt.options.site?.url === 'string') {
      nuxt.options.site.url = normalizeSiteURL(nuxt.options.site.url)
    }

    const siteUrl = typeof nuxt.options.site === 'object' && typeof nuxt.options.site?.url === 'string'
      ? nuxt.options.site.url
      : resolvedSiteUrl

    nuxt.options.llms = defu(nuxt.options.llms, {
      domain: siteUrl,
      title: siteName,
      description: meta.description || '',
      full: {
        title: siteName,
        description: meta.description || '',
      },
    })

    nuxt.options.appConfig.header = defu(nuxt.options.appConfig.header, {
      title: siteName,
    })

    nuxt.options.appConfig.seo = defu(nuxt.options.appConfig.seo, {
      titleTemplate: `%s - ${siteName}`,
      title: siteName,
      description: meta.description || '',
    })

    nuxt.options.appConfig.github = defu(nuxt.options.appConfig.github, {
      owner: gitInfo?.owner,
      name: gitInfo?.name,
      url: gitInfo?.url,
      branch: getGitBranch(),
    })

    nuxt.options.appConfig.tockdocs = defu(nuxt.options.appConfig.tockdocs, {
      localeMessages: layerLocaleMessages,
    })

    const landingOgImageRoute = getLandingOgImagePrerenderRoute({
      rootDir: dir,
      contentConfiguration,
      siteName,
      seo: {
        title: nuxt.options.appConfig.seo?.title,
        description: nuxt.options.appConfig.seo?.description,
      },
    })

    if (landingOgImageRoute) {
      addPrerenderRoutes([landingOgImageRoute])
    }

    const forcedColorMode = (nuxt.options.appConfig.tockdocs as Record<string, unknown>)?.colorMode as string | undefined
    if (forcedColorMode === 'light' || forcedColorMode === 'dark') {
      nuxt.options.colorMode = defu({ preference: forcedColorMode, fallback: forcedColorMode }, nuxt.options.colorMode || {}) as typeof nuxt.options.colorMode
    }

    const typedNuxtOptions = nuxt.options as typeof nuxt.options & { i18n?: false | TockDocsI18nOptions }
    const i18nOptions = typedNuxtOptions.i18n

    const baseRuntimeTockDocsConfig = {
      docsMode: contentConfiguration.mode,
      knowledgeBases: contentConfiguration.knowledgeBases.map(({ sourceDir: _sourceDir, ...knowledgeBase }) => knowledgeBase),
      knowledgeBaseSourceDirs: Object.fromEntries(contentConfiguration.knowledgeBases.map(knowledgeBase => [knowledgeBase.id, knowledgeBase.sourceDir])),
      defaultKnowledgeBase: contentConfiguration.knowledgeBases[0]?.id,
      hasSiteContent: contentConfiguration.hasSiteContent,
    }

    const privateRuntimeConfig = nuxt.options.runtimeConfig as typeof nuxt.options.runtimeConfig & {
      tockdocs?: {
        knowledgeBases?: Array<{ id: string, sourceDir: string }>
      }
    }

    privateRuntimeConfig.tockdocs = defu(privateRuntimeConfig.tockdocs, {
      knowledgeBases: contentConfiguration.knowledgeBases.map(knowledgeBase => ({
        id: knowledgeBase.id,
        sourceDir: knowledgeBase.sourceDir,
      })),
    })

    if (i18nOptions && typeof i18nOptions === 'object' && i18nOptions.locales) {
      const filteredLocales = i18nOptions.locales.filter((locale: I18nLocale) => {
        const localeCode = typeof locale === 'string' ? locale : locale.code
        const localeFilePath = resolve('../i18n/locales', `${localeCode}.json`)
        const hasLocaleFile = existsSync(localeFilePath)
        const hasContentForLocale = contentConfiguration.mode === 'kb'
          ? availableKnowledgeBaseLocales.has(localeCode)
          : existsSync(join(nuxt.options.rootDir, 'content', localeCode))

        if (!hasLocaleFile) {
          log.warn(`Locale file not found: ${localeCode}.json - skipping locale "${localeCode}"`)
        }

        if (!hasContentForLocale) {
          log.warn(contentConfiguration.mode === 'kb'
            ? `No knowledge base content found for locale "${localeCode}" - skipping locale "${localeCode}"`
            : `Content folder not found: content/${localeCode}/ - skipping locale "${localeCode}"`)
        }

        return hasLocaleFile && hasContentForLocale
      })

      typedNuxtOptions.i18n = {
        ...i18nOptions,
        strategy: contentConfiguration.mode === 'kb' ? 'no_prefix' : 'prefix',
      }

      nuxt.options.runtimeConfig.public.tockdocs = defu(nuxt.options.runtimeConfig.public.tockdocs, {
        filteredLocales,
        ...baseRuntimeTockDocsConfig,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nuxt.hook('i18n:registerModule' as any, (register: (options: RegisterModuleOptions) => void) => {
        const langDir = resolve('../i18n/locales')

        const locales = filteredLocales.map((locale: I18nLocale) => {
          return typeof locale === 'string'
            ? {
                code: locale,
                name: locale,
                file: `${locale}.json`,
              }
            : {
                code: locale.code,
                name: locale.name || locale.code,
                file: `${locale.code}.json`,
              }
        })

        register({
          langDir,
          locales,
        })
      })
    }
    else {
      nuxt.options.runtimeConfig.public.tockdocs = defu(nuxt.options.runtimeConfig.public.tockdocs, baseRuntimeTockDocsConfig)
    }
  },
})

function readLayerLocaleMessages(): Record<string, Record<string, unknown>> {
  const localeDir = resolve('../i18n/locales')

  if (!existsSync(localeDir)) {
    return {}
  }

  return Object.fromEntries(
    readdirSync(localeDir)
      .filter(fileName => fileName.endsWith('.json'))
      .map((fileName) => {
        const localeCode = fileName.replace(/\.json$/i, '')
        const filePath = join(localeDir, fileName)
        return [localeCode, JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>]
      }),
  )
}

type LandingOgImagePrerenderOptions = {
  rootDir: string
  contentConfiguration: Pick<TockDocsContentConfiguration, 'mode' | 'hasSiteContent'>
  siteName: string
  seo?: { title?: string, description?: string }
}

export function getLandingOgImagePrerenderRoute({
  rootDir,
  contentConfiguration,
  siteName,
  seo,
}: LandingOgImagePrerenderOptions): string | null {
  if (landingPageExists(rootDir) || contentConfiguration.mode !== 'kb') {
    return null
  }

  const landingSeo = readLandingSeo(rootDir)
  const landingTitle = landingSeo?.title || seo?.title || siteName
  const landingDescription = landingSeo?.description || seo?.description || ''

  return buildOgImagePath('Landing', {
    title: landingTitle,
    description: formatOgDescription(landingTitle, landingDescription),
  })
}

function readLandingSeo(rootDir: string): { title?: string, description?: string } | null {
  const landingContentPath = ['md', 'mdc']
    .map(extension => join(rootDir, 'content', 'site', `index.${extension}`))
    .find(path => existsSync(path))

  if (!landingContentPath) {
    return null
  }

  const rawContent = readFileSync(landingContentPath, 'utf8').replace(/\r/g, '')
  const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch?.[1]) {
    return null
  }

  try {
    const frontmatter = parseYaml(frontmatterMatch[1]) as Record<string, unknown> | null
    const seo = frontmatter?.seo as Record<string, unknown> | undefined

    const title = typeof seo?.title === 'string'
      ? seo.title
      : typeof frontmatter?.title === 'string'
        ? frontmatter.title
        : undefined

    const description = typeof seo?.description === 'string'
      ? seo.description
      : typeof frontmatter?.description === 'string'
        ? frontmatter.description
        : undefined

    if (!title && !description) {
      return null
    }

    return { title, description }
  }
  catch {
    return null
  }
}

function buildOgImagePath(component: string, options: { title?: string, description?: string, headline?: string }): string {
  const params = [`c_${encodeOgImageValue(component)}`]

  if (options.title) {
    params.push(`title_${encodeOgImageValue(options.title)}`)
  }

  if (options.description) {
    params.push(`description_${encodeOgImageValue(options.description)}`)
  }

  if (options.headline) {
    params.push(`headline_${encodeOgImageValue(options.headline)}`)
  }

  return `/_og/s/${params.join(',')}.png`
}

function hasNonAscii(value: string): boolean {
  for (const char of value) {
    if ((char.codePointAt(0) || 0) > 0x7F) {
      return true
    }
  }

  return false
}

function encodeOgImageValue(value: string): string {
  if (hasNonAscii(value)) {
    return `~${Buffer.from(value, 'utf8').toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '~')}`
  }

  const escaped = value.startsWith('~') ? `~${value}` : value
  const encoded = encodeURIComponent(escaped.replace(/_/g, '__')).replace(/%20/g, '+')

  if (encoded.includes('%')) {
    return `~${Buffer.from(value, 'utf8').toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '~')}`
  }

  return encoded
}
