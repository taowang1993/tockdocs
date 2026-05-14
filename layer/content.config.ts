import type { DefinedCollection } from '@nuxt/content'
import { defineContentConfig, defineCollection, z } from '@nuxt/content'
import { useNuxt } from '@nuxt/kit'
import { join } from 'node:path'
import { getDocsCollectionName, getLandingCollectionName } from './utils/docs'
import { getTockDocsContentConfiguration } from './utils/knowledge-bases'
import { landingPageExists, docsFolderExists } from './utils/pages'

const { options } = useNuxt()
const cwd = join(options.rootDir, 'content')
const locales = options.i18n?.locales
const contentConfiguration = getTockDocsContentConfiguration(options.rootDir)

const hasLandingPage = landingPageExists(options.rootDir)
const hasDocsFolder = docsFolderExists(options.rootDir)

const createDocsSchema = () => z.object({
  config: z.record(z.unknown()).optional(),
  links: z.array(z.object({
    label: z.string(),
    icon: z.string(),
    to: z.string(),
    target: z.string().optional(),
  })).optional(),
}).passthrough()

let collections: Record<string, DefinedCollection>

if (contentConfiguration.mode === 'kb') {
  collections = {}

  if (contentConfiguration.hasSiteContent) {
    collections.site = defineCollection({
      type: 'page',
      source: {
        cwd,
        include: 'site/**/*',
        prefix: '/',
      },
      schema: createDocsSchema(),
    })
  }

  for (const knowledgeBase of contentConfiguration.knowledgeBases) {
    for (const locale of knowledgeBase.locales) {
      collections[getDocsCollectionName({
        mode: 'kb',
        kb: knowledgeBase.id,
        locale,
      })] = defineCollection({
        type: 'page',
        source: {
          cwd,
          include: `${knowledgeBase.sourceDir}/${locale}/**/*`,
          prefix: `/docs/${knowledgeBase.id}/${locale}`,
        },
        schema: createDocsSchema(),
      })
    }
  }
}
else if (locales && Array.isArray(locales)) {
  collections = {}

  for (const locale of locales) {
    const localeCode = typeof locale === 'string' ? locale : locale.code
    const hasLocaleDocs = docsFolderExists(options.rootDir, localeCode)

    if (!hasLandingPage) {
      collections[getLandingCollectionName(localeCode)] = defineCollection({
        type: 'page',
        source: {
          cwd,
          include: `${localeCode}/index.md`,
        },
      })
    }

    collections[getDocsCollectionName({ mode: 'legacy', locale: localeCode })] = defineCollection({
      type: 'page',
      source: {
        cwd,
        include: hasLocaleDocs ? `${localeCode}/docs/**` : `${localeCode}/**/*`,
        prefix: hasLocaleDocs ? `/${localeCode}/docs` : `/${localeCode}`,
        exclude: [`${localeCode}/index.md`],
      },
      schema: createDocsSchema(),
    })
  }
}
else {
  collections = {
    docs: defineCollection({
      type: 'page',
      source: {
        cwd,
        include: hasDocsFolder ? 'docs/**' : '**',
        prefix: hasDocsFolder ? '/docs' : '/',
        exclude: ['index.md'],
      },
      schema: createDocsSchema(),
    }),
  }

  if (!hasLandingPage) {
    collections.landing = defineCollection({
      type: 'page',
      source: {
        cwd,
        include: 'index.md',
      },
    })
  }
}

export default defineContentConfig({ collections })
