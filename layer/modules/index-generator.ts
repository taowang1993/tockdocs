import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { addServerHandler, createResolver, defineNuxtModule, logger } from '@nuxt/kit'
import type { NitroConfig } from 'nitropack'
import {
  buildAllIndexes,
  getIndexStorageKey,
  TOCKDOCS_INDEX_ASSET_BASE_NAME,
} from '../server/utils/index-generator'
import { buildAllSearchIndexAssets } from '../server/utils/search-index-generator'
import { TOCKDOCS_SEARCH_INDEX_ASSET_BASE_NAME } from '../server/utils/search-index'
import type { TockDocsPublicRuntimeConfig } from '../utils/docs'

const log = logger.withTag('TockDocs')
const INDEX_OUTPUT_DIR = join('.data', 'index')
const SEARCH_INDEX_OUTPUT_DIR = join('.data', 'search')

export default defineNuxtModule({
  meta: {
    name: 'index-generator',
  },
  async setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    const outputDir = join(nuxt.options.rootDir, INDEX_OUTPUT_DIR)
    const searchOutputDir = join(nuxt.options.rootDir, SEARCH_INDEX_OUTPUT_DIR)
    const onNitroConfig = nuxt.hook as (name: 'nitro:config', cb: (nitroConfig: NitroConfig) => void) => void

    onNitroConfig('nitro:config', (nitroConfig) => {
      nitroConfig.serverAssets ||= []

      if (!nitroConfig.serverAssets.some(asset => asset?.baseName === TOCKDOCS_INDEX_ASSET_BASE_NAME)) {
        nitroConfig.serverAssets.push({
          baseName: TOCKDOCS_INDEX_ASSET_BASE_NAME,
          dir: outputDir,
          pattern: '**/*.md',
        })
      }

      if (!nitroConfig.serverAssets.some(asset => asset?.baseName === TOCKDOCS_SEARCH_INDEX_ASSET_BASE_NAME)) {
        nitroConfig.serverAssets.push({
          baseName: TOCKDOCS_SEARCH_INDEX_ASSET_BASE_NAME,
          dir: searchOutputDir,
          pattern: '**/*.json',
        })
      }
    })

    // Register the index route explicitly so it works in dev mode.
    // File-based routes in a layer's server/routes/ are picked up by
    // production builds but are not reliably scanned by Nitro in dev.
    addServerHandler({
      route: '/__tockdocs__/index/**',
      handler: resolve('./runtime/server/routes/index-md'),
    })

    if (nuxt.options.dev) {
      return
    }

    const publicConfig = nuxt.options.runtimeConfig.public as TockDocsPublicRuntimeConfig
    const siteName = typeof nuxt.options.site === 'object' && typeof nuxt.options.site?.name === 'string'
      ? nuxt.options.site.name
      : 'Documentation'

    try {
      await rm(outputDir, { recursive: true, force: true })
      await mkdir(outputDir, { recursive: true })

      const indexes = await buildAllIndexes(nuxt.options.rootDir, publicConfig, { siteName })

      await Promise.all(indexes.map(async ({ spec, content }) => {
        const filePath = join(outputDir, getIndexStorageKey(spec.scopeId, spec.locale))
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, content, 'utf8')
      }))

      if (indexes.length > 0) {
        const pageCount = indexes.reduce((total, index) => total + index.pages.length, 0)
        log.info(`Generated ${indexes.length} INDEX.md file${indexes.length === 1 ? '' : 's'} (${pageCount} page${pageCount === 1 ? '' : 's'} indexed)`)
      }
    }
    catch (error) {
      log.warn(`Failed to generate INDEX.md files: ${error instanceof Error ? error.message : String(error)}`)
    }

    try {
      await rm(searchOutputDir, { recursive: true, force: true })
      await mkdir(searchOutputDir, { recursive: true })

      const searchAssets = await buildAllSearchIndexAssets(nuxt.options.rootDir, publicConfig, { siteName })

      await Promise.all(searchAssets.map(async ({ storageKey, asset }) => {
        const filePath = join(searchOutputDir, storageKey)
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, JSON.stringify(asset), 'utf8')
      }))

      if (searchAssets.length > 0) {
        const uniqueDocumentCount = new Set(searchAssets.flatMap(searchAsset => searchAsset.asset.documents.map(document => document.id))).size
        log.info(`Generated ${searchAssets.length} Search Index file${searchAssets.length === 1 ? '' : 's'} (${uniqueDocumentCount} page${uniqueDocumentCount === 1 ? '' : 's'} indexed)`)
      }
    }
    catch (error) {
      log.warn(`Failed to generate search index files: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
})
