// Browser-level speed test for Assistant FS backends
// Measures time from Enter key to first visible substantive AI response text.
//
// Locale-agnostic: works on any KB/locale by using structural DOM selectors
// instead of text-matching on localized labels.

const { chromium } = require('./lib/load-playwright.cjs')

const BASE_URL = 'http://localhost:4987'
const ITERATIONS = 3

// Configure test queries to match your current KBs.
// For best results, test each KB in its primary locale and add a non-Latin
// variant if you have one — MCP's search degrades on CJK/non-Latin text while
// INDEX and GitFS are language-agnostic.
const TESTS = [
  {
    name: 'Manual KB (English)',
    pageUrl: `${BASE_URL}/docs/manual/en/getting-started/installation`,
    query: 'How do I set up the built-in MCP server and what tools does it expose?',
  },
  {
    name: 'Chemistry KB (Chinese)',
    pageUrl: `${BASE_URL}/docs/chemistry/zh/elements-compounds/sulfur-compounds`,
    query: '硫酸的化学式和主要化学性质是什么？',
  },
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runTest(browser, test) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()

  try {
    await page.goto(test.pageUrl, { waitUntil: 'load', timeout: 30000 })
    await sleep(5000)

    // Click Ask AI button (testid is locale-independent)
    const askBtn = page.getByTestId('ask-ai-btn')
    await askBtn.waitFor({ state: 'visible', timeout: 10000 })
    await askBtn.click()
    await sleep(6000)

    // Textarea: first <textarea> inside an <aside>. Safe because
    // floating quick-input textareas are outside <aside>.
    const input = page.locator('aside textarea').first()
    await input.waitFor({ state: 'visible', timeout: 20000 })
    await input.click()
    await sleep(500)
    await input.fill(test.query)
    await sleep(500)

    // Send button: last <button> in the assistant <aside> <form>.
    // Locale-agnostic — matches "Send prompt", "发送", etc.
    const sendBtn = page.locator('aside form button').last()
    const enterTime = Date.now()
    await sendBtn.click()

    let sourceTime = null
    let textTime = null
    let firstText = ''

    try {
      // Wait for first article beyond user's echoed message
      await page.waitForFunction(
        (queryText) => {
          const aside = (() => {
            for (const a of document.querySelectorAll('aside')) {
              if (a.querySelector('textarea')) return a
            }
            return null
          })()
          if (!aside) return false
          for (const article of aside.querySelectorAll('article')) {
            const text = article.textContent.trim()
            if (text.length > 5 && text !== queryText && !text.startsWith(queryText.substring(0, 15))) {
              return true
            }
          }
          return false
        },
        test.query,
        { timeout: 90000, polling: 100 },
      )
      sourceTime = Date.now() - enterTime

      // Wait for a substantive article (>50 chars, locale-agnostic)
      await page.waitForFunction(
        (queryText) => {
          const aside = (() => {
            for (const a of document.querySelectorAll('aside')) {
              if (a.querySelector('textarea')) return a
            }
            return null
          })()
          if (!aside) return false
          for (const article of aside.querySelectorAll('article')) {
            const text = article.textContent.trim()
            if (text === queryText || text.startsWith(queryText.substring(0, 15))) continue
            if (text.length > 50) return true
          }
          return false
        },
        test.query,
        { timeout: 90000, polling: 100 },
      )
      textTime = Date.now() - enterTime

      // Grab first text sample
      firstText = await page.evaluate((queryText) => {
        const aside = (() => {
          for (const a of document.querySelectorAll('aside')) {
            if (a.querySelector('textarea')) return a
          }
          return null
        })()
        if (!aside) return ''
        for (const article of aside.querySelectorAll('article')) {
          const text = article.textContent.trim()
          if (text === queryText || text.startsWith(queryText.substring(0, 15))) continue
          if (text.length > 50) return text.substring(0, 100)
        }
        return ''
      }, test.query)
    }
    catch {
      return { sourceTime: null, textTime: null, firstText: '', error: 'timeout' }
    }

    return { sourceTime, textTime, firstText, success: true }
  }
  catch (e) {
    return { sourceTime: null, textTime: null, firstText: '', error: e.message }
  }
  finally {
    await context.close()
  }
}

async function main() {
  const backend = process.env.ASSISTANT_FS_BACKEND || process.argv[2] || 'index'

  console.log(`\n╔══════════════════════════════════════════════════╗`)
  console.log(`║  BROWSER TEST — Backend: ${backend.toUpperCase().padEnd(22)} ║`)
  console.log(`╚══════════════════════════════════════════════════╝\n`)

  const browser = await chromium.launch({ headless: true })

  for (const test of TESTS) {
    console.log(`┌─ ${test.name}`)
    console.log(`│  Query: "${test.query.substring(0, 68)}..."`)
    console.log(`│`)

    const runs = []
    for (let i = 0; i < ITERATIONS; i++) {
      process.stdout.write(`│  Run ${i + 1}/${ITERATIONS}... `)
      const result = await runTest(browser, test)
      runs.push(result)
      if (result.success) {
        console.log(`src=${result.sourceTime}ms  txt=${result.textTime}ms → "${result.firstText?.substring(0, 50)}"`)
      }
      else {
        console.log(`FAILED: ${result.error}`)
      }
      if (i < ITERATIONS - 1) await sleep(4000)
    }

    const textVals = runs.filter(r => r.textTime != null).map(r => r.textTime)
    const srcVals = runs.filter(r => r.sourceTime != null).map(r => r.sourceTime)
    if (textVals.length > 0) {
      console.log(`│  → Answer text: avg=${Math.round(textVals.reduce((a, b) => a + b, 0) / textVals.length)}ms  min=${Math.min(...textVals)}ms  max=${Math.max(...textVals)}ms`)
    }
    if (srcVals.length > 0) {
      console.log(`│  → Source indicator: avg=${Math.round(srcVals.reduce((a, b) => a + b, 0) / srcVals.length)}ms  min=${Math.min(...srcVals)}ms  max=${Math.max(...srcVals)}ms`)
    }
    console.log(`│`)
  }

  await browser.close()
}

main().catch((error) => {
  console.error('FATAL:', error)
  process.exit(1)
})
