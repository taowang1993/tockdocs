#!/usr/bin/env node

/**
 * Scans TockDocs source for i18n key usage and reports missing keys
 * across locale files in layer/i18n/locales/.
 *
 * Checks:
 * 1. All t('key') calls in .vue/.ts source have translations
 * 2. All i18n-key-looking strings in app.config.ts have translations
 * 3. Locale-aware configs (faqQuestions) have entries for all configured locales
 *
 * Usage: node scripts/check-i18n-keys.mjs
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const LOCALE_DIR = join(ROOT, 'layer', 'i18n', 'locales')
const SOURCE_DIRS = [
  join(ROOT, 'layer', 'app'),
  join(ROOT, 'layer', 'modules', 'assistant', 'runtime'),
  join(ROOT, 'docs', 'app'),
]
const CONFIG_FILES = [
  join(ROOT, 'docs', 'app', 'app.config.ts'),
  join(ROOT, 'docs', 'nuxt.config.ts'),
]

const VALID_EXTENSIONS = new Set(['.vue', '.ts'])
const I18N_KEY_RE = /^[a-z]+\.[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*)*$/
const I18N_KEY_LITERAL_RE = /['"]([a-z]+\.[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*)*)['"]/g

// ---- walk directories ----

function* walkFiles(dir) {
  if (!existsSync(dir)) return
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.nuxt') continue
      yield* walkFiles(fullPath)
    }
    else if (entry.isFile() && VALID_EXTENSIONS.has(extname(entry.name))) {
      yield fullPath
    }
  }
}

// ---- extract t() keys from source ----

function extractKeysFromSource() {
  const keys = new Set()

  for (const dir of SOURCE_DIRS) {
    for (const file of walkFiles(dir)) {
      const content = readFileSync(file, 'utf8')
      for (const m of content.matchAll(/\bt\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        keys.add(m[1])
      }
    }
  }

  // Also scan config files for strings that look like i18n keys
  // (used dynamically like t(link.label) in DocsAsideRightBottom.vue)
  for (const configFile of CONFIG_FILES) {
    if (!existsSync(configFile)) continue
    const content = readFileSync(configFile, 'utf8')
    // Match string literals that look like dot-separated i18n keys
    for (const m of content.matchAll(I18N_KEY_LITERAL_RE)) {
      if (I18N_KEY_RE.test(m[1])) {
        keys.add(m[1])
      }
    }
  }

  return [...keys].sort()
}

// ---- read configured locales from nuxt.config.ts ----

function readConfiguredLocales() {
  const nuxtConfigPath = join(ROOT, 'docs', 'nuxt.config.ts')
  if (!existsSync(nuxtConfigPath)) return []

  const content = readFileSync(nuxtConfigPath, 'utf8')
  const locales = new Set()

  // Match { code: 'xx', name: '...' } patterns
  for (const m of content.matchAll(/code:\s*['"]([a-z]{2}(?:-[A-Z]{2})?)['"]/g)) {
    locales.add(m[1])
  }

  return [...locales]
}

// ---- detect locale-aware configs missing locales ----

function checkLocaleAwareConfigs() {
  const issues = []
  const configuredLocales = readConfiguredLocales()

  if (configuredLocales.length === 0) return issues

  for (const configFile of CONFIG_FILES) {
    if (!existsSync(configFile)) continue
    const content = readFileSync(configFile, 'utf8')

    // Check faqQuestions: find locale keys in the faqQuestions block
    const faqIdx = content.indexOf('faqQuestions:')
    if (faqIdx !== -1) {
      // Extract the faqQuestions block by tracking brace depth
      let depth = 0
      let start = -1
      let end = -1
      let i = content.indexOf('{', faqIdx)
      if (i === -1) continue
      start = i
      for (; i < content.length; i++) {
        if (content[i] === '{') {
          depth++
        }
        else if (content[i] === '}') {
          depth--
          if (depth === 0) {
            end = i + 1
            break
          }
        }
      }

      if (start !== -1 && end !== -1) {
        const faqBlock = content.slice(start, end)
        const faqLocales = new Set()
        // Match locale keys at the top level: en: [...], 'en': [...], "en": [...]
        for (const m of faqBlock.matchAll(/(?:['"]([a-z]{2}(?:-[A-Z]{2})?)['"]|\b([a-z]{2}(?:-[A-Z]{2})?))\s*:\s*\[/g)) {
          faqLocales.add(m[1] || m[2])
        }

        for (const locale of configuredLocales) {
          if (!faqLocales.has(locale)) {
            issues.push(`faqQuestions missing locale "${locale}" in ${configFile.replace(ROOT, '.')}`)
          }
        }

        // Check for stale locales
        for (const locale of faqLocales) {
          if (!configuredLocales.includes(locale)) {
            issues.push(`faqQuestions has locale "${locale}" not in nuxt.config.ts i18n.locales (stale?)`)
          }
        }
      }
    }
  }

  return issues
}

// ---- read locale files ----

function readLocaleFiles() {
  if (!existsSync(LOCALE_DIR)) return new Map()

  const result = new Map()
  for (const fileName of readdirSync(LOCALE_DIR)) {
    if (!fileName.endsWith('.json')) continue
    const localeCode = fileName.replace(/\.json$/i, '')
    try {
      result.set(localeCode, JSON.parse(readFileSync(join(LOCALE_DIR, fileName), 'utf8')))
    }
    catch (e) {
      console.error(`Error reading ${fileName}:`, e.message)
    }
  }

  return result
}

// ---- check key exists in locale object ----

function hasKey(obj, key) {
  const parts = key.split('.')
  let current = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return false
    if (!(part in current)) return false
    current = current[part]
  }
  return true
}

// ---- find dead keys ----

function findDeadKeys(referencedKeys, localeData) {
  const dead = []

  function walk(obj, prefix) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        walk(value, fullKey)
      }
      else {
        if (!referencedKeys.includes(fullKey)) {
          dead.push(fullKey)
        }
      }
    }
  }

  walk(localeData, '')
  return dead
}

// ---- main ----

function main() {
  let hasErrors = false

  // Check locale-aware configs first
  const localeConfigIssues = checkLocaleAwareConfigs()
  if (localeConfigIssues.length > 0) {
    hasErrors = true
    console.log(`\n🔧 Locale-aware config issues:`)
    for (const issue of localeConfigIssues) {
      console.log(`   ❌ ${issue}`)
    }
  }

  const sourceKeys = extractKeysFromSource()
  const localeFiles = readLocaleFiles()

  if (localeFiles.size === 0) {
    console.log('No locale files found in', LOCALE_DIR)
    process.exit(1)
  }

  if (sourceKeys.length === 0) {
    console.log('No i18n keys found in source.')
    process.exit(1)
  }

  // Report missing keys per locale
  for (const [localeCode, data] of localeFiles) {
    const missing = sourceKeys.filter(k => !hasKey(data, k))

    if (missing.length > 0) {
      hasErrors = true
      console.log(`\n❌ ${localeCode}.json: ${missing.length} missing key(s):`)
      for (const k of missing) {
        console.log(`   - ${k}`)
      }
    }
  }

  // Report dead keys (summarized)
  const deadByLocale = new Map()
  for (const [localeCode, data] of localeFiles) {
    const dead = findDeadKeys(sourceKeys, data)
    if (dead.length > 0) {
      deadByLocale.set(localeCode, dead)
    }
  }

  if (deadByLocale.size > 0) {
    const keyLocales = new Map()
    for (const [localeCode, keys] of deadByLocale) {
      for (const key of keys) {
        if (!keyLocales.has(key)) keyLocales.set(key, [])
        keyLocales.get(key).push(localeCode)
      }
    }
    console.log(`\n💀 ${deadByLocale.size} locale(s) have unused keys:`)
    for (const [key, locales] of keyLocales) {
      console.log(`   - ${key} (in ${locales.length} locale(s))`)
    }
  }

  // Summary
  console.log(`\n📊 Scanned ${sourceKeys.length} unique i18n key(s) from source + config`)
  console.log(`📊 Checked ${localeFiles.size} locale file(s)`)
  const configuredLocales = readConfiguredLocales()
  if (configuredLocales.length > 0) {
    console.log(`📊 Configured locales: ${configuredLocales.join(', ')}`)
  }

  if (!hasErrors && deadByLocale.size === 0) {
    console.log('✅ All keys present, no dead keys found')
  }
  else if (!hasErrors) {
    console.log('✅ All required keys present')
  }

  if (hasErrors) {
    process.exit(1)
  }
}

main()
