import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { getLandingOgImagePrerenderRoute } from './config'
import { inferSiteURL, normalizeSiteURL, trimTrailingSlash } from '../utils/meta'

test('prerenders the landing OG image from site content on KB builds', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'tockdocs-og-'))

  try {
    mkdirSync(join(rootDir, 'content', 'site'), { recursive: true })
    writeFileSync(
      join(rootDir, 'content', 'site', 'index.md'),
      `---
title: TockDocs
seo:
  description: An AI-powered Knowledge Management System
---
`,
    )

    const route = getLandingOgImagePrerenderRoute({
      rootDir,
      contentConfiguration: { mode: 'kb', hasSiteContent: true },
      siteName: 'Fallback Site',
      seo: {
        title: 'Fallback Title',
        description: 'Fallback Description',
      },
    })

    assert.equal(route, '/_og/s/c_Landing,title_TockDocs,description_An+AI-powered+Knowledge+Management+System.png')
  }
  finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
})

test('prerenders the landing OG image from fallback SEO when KB builds have no site content', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'tockdocs-og-'))

  try {
    const route = getLandingOgImagePrerenderRoute({
      rootDir,
      contentConfiguration: { mode: 'kb', hasSiteContent: false },
      siteName: 'Fallback Site',
      seo: {
        title: 'Fallback Title',
        description: 'Fallback Description',
      },
    })

    assert.equal(route, '/_og/s/c_Landing,title_Fallback+Title,description_Fallback+Description.png')
  }
  finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
})

test('prerenders the landing OG image from MDC site content on KB builds', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'tockdocs-og-'))

  try {
    mkdirSync(join(rootDir, 'content', 'site'), { recursive: true })
    writeFileSync(
      join(rootDir, 'content', 'site', 'index.mdc'),
      `---
title: TockDocs MDC
seo:
  description: KB landing authored as MDC
---
`,
    )

    const route = getLandingOgImagePrerenderRoute({
      rootDir,
      contentConfiguration: { mode: 'kb', hasSiteContent: true },
      siteName: 'Fallback Site',
      seo: {
        title: 'Fallback Title',
        description: 'Fallback Description',
      },
    })

    assert.equal(route, '/_og/s/c_Landing,title_TockDocs+MDC,description_KB+landing+authored+as+MDC.png')
  }
  finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
})

test('drops trailing slashes from configured site URLs', () => {
  assert.equal(trimTrailingSlash('https://tockdocs.vercel.app/'), 'https://tockdocs.vercel.app')
  assert.equal(trimTrailingSlash('https://tockdocs.vercel.app/docs/'), 'https://tockdocs.vercel.app/docs')
  assert.equal(normalizeSiteURL('tockdocs.vercel.app/'), 'https://tockdocs.vercel.app')
})

test('inferSiteURL preserves explicit protocols and defaults bare domains to https', () => {
  const previousSiteUrl = process.env.NUXT_SITE_URL

  try {
    process.env.NUXT_SITE_URL = 'http://127.0.0.1:4987/'
    assert.equal(inferSiteURL(), 'http://127.0.0.1:4987')

    process.env.NUXT_SITE_URL = 'tockdocs.dev/'
    assert.equal(inferSiteURL(), 'https://tockdocs.dev')
  }
  finally {
    if (previousSiteUrl === undefined) {
      delete process.env.NUXT_SITE_URL
    }
    else {
      process.env.NUXT_SITE_URL = previousSiteUrl
    }
  }
})

test('inferSiteURL falls back to Vercel deployment metadata when NUXT_SITE_URL is unset', () => {
  const previousSiteUrl = process.env.NUXT_SITE_URL
  const previousVercelUrl = process.env.VERCEL_URL

  try {
    delete process.env.NUXT_SITE_URL
    process.env.VERCEL_URL = 'tockdocs.vercel.app'

    assert.equal(inferSiteURL(), 'https://tockdocs.vercel.app')
  }
  finally {
    if (previousSiteUrl === undefined) {
      delete process.env.NUXT_SITE_URL
    }
    else {
      process.env.NUXT_SITE_URL = previousSiteUrl
    }

    if (previousVercelUrl === undefined) {
      delete process.env.VERCEL_URL
    }
    else {
      process.env.VERCEL_URL = previousVercelUrl
    }
  }
})
