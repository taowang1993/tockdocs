import { writeFileSync } from 'node:fs'

const BASE_URL = 'http://localhost:4987'
const ENDPOINT = `${BASE_URL}/__tockdocs__/assistant`
const QUERY = 'What is TockDocs?'
const ITERATIONS = 3

const BACKENDS = ['mcp', 'index', 'gitfs']

function buildBody(query) {
  return JSON.stringify({
    messages: [{
      role: 'user',
      content: query,
      parts: [{ type: 'text', text: query }]
    }]
  })
}

async function timeRequest(backend, iteration) {
  const body = buildBody(QUERY)
  const startTime = performance.now()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  let ttfb = null       // time to first byte (any SSE line)
  let ttft = null       // time to first reasoning-delta or text-delta token
  let firstTokenType = null
  let toolCallCount = 0
  let totalChunks = 0
  let done = false
  let error = null
  let finishTime = null

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': `${BASE_URL}/docs/manual/en`
      },
      body,
      signal: controller.signal
    })

    if (!res.ok) {
      return {
        backend,
        iteration,
        ttfb: null,
        ttft: null,
        error: `HTTP ${res.status}: ${res.statusText}`,
        finishTime: performance.now() - startTime
      }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done: streamDone } = await reader.read()
      if (streamDone) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE events
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // keep incomplete last line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        const now = performance.now()
        if (ttfb === null) {
          ttfb = now - startTime
        }

        totalChunks++

        const jsonStr = line.slice(6) // remove "data: "
        if (jsonStr === '[DONE]') {
          done = true
          finishTime = now - startTime
          continue
        }

        try {
          const data = JSON.parse(jsonStr)

          if (ttft === null && (data.type === 'reasoning-delta' || data.type === 'text-delta')) {
            ttft = now - startTime
            firstTokenType = data.type
          }

          if (data.type === 'tool-input-start') {
            toolCallCount++
          }

          if (data.type === 'error') {
            error = data.errorText || data.error || 'Unknown error'
          }

          if (data.type === 'finish') {
            finishTime = finishTime || now - startTime
          }
        } catch {
          // skip parse errors
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith('data: ') && buffer !== 'data: [DONE]') {
      try {
        const data = JSON.parse(buffer.slice(6))
        if (ttft === null && (data.type === 'reasoning-delta' || data.type === 'text-delta')) {
          ttft = performance.now() - startTime
          firstTokenType = data.type
        }
      } catch { /* ignore */ }
    }

    finishTime = finishTime || performance.now() - startTime
  } catch (err) {
    error = err.message
    finishTime = performance.now() - startTime
  } finally {
    clearTimeout(timeout)
  }

  return {
    backend,
    iteration,
    ttfb,
    ttft,
    firstTokenType,
    toolCallCount,
    totalChunks,
    finishTime,
    error
  }
}

function stats(values) {
  if (values.length === 0) return { min: null, max: null, avg: null, values }
  const sorted = [...values].sort((a, b) => a - b)
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sorted.reduce((s, v) => s + v, 0) / sorted.length,
    values: sorted
  }
}

async function main() {
  console.log('='.repeat(70))
  console.log('TockDocs Assistant FS Backend Speed Test')
  console.log('='.repeat(70))
  console.log(`Query: "${QUERY}"`)
  console.log(`Iterations per backend: ${ITERATIONS}`)
  console.log(`Base URL: ${BASE_URL}`)
  console.log()

  const results = {}

  for (const backend of BACKENDS) {
    console.log(`\n--- Testing backend: ${backend} ---`)
    const runs = []

    for (let i = 0; i < ITERATIONS; i++) {
      process.stdout.write(`  Run ${i + 1}/${ITERATIONS}... `)
      const result = await timeRequest(backend, i + 1)
      runs.push(result)

      if (result.error) {
        console.log(`ERROR: ${result.error}`)
      } else {
        console.log(`TTFB=${result.ttfb?.toFixed(0)}ms TTFT=${result.ttft?.toFixed(0)}ms (${result.firstTokenType}) tools=${result.toolCallCount} chunks=${result.totalChunks}`)
      }
    }

    results[backend] = runs
  }

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))

  const rows = []
  for (const backend of BACKENDS) {
    const runs = results[backend]
    const ttfbValues = runs.filter(r => r.ttfb != null).map(r => r.ttfb)
    const ttftValues = runs.filter(r => r.ttft != null).map(r => r.ttft)
    const errors = runs.filter(r => r.error).length

    rows.push({
      Backend: backend,
      'TTFB Avg': ttfbValues.length ? `${stats(ttfbValues).avg.toFixed(0)}ms` : 'N/A',
      'TTFB Min': ttfbValues.length ? `${stats(ttfbValues).min.toFixed(0)}ms` : 'N/A',
      'TTFB Max': ttfbValues.length ? `${stats(ttfbValues).max.toFixed(0)}ms` : 'N/A',
      'TTFT Avg': ttftValues.length ? `${stats(ttftValues).avg.toFixed(0)}ms` : 'N/A',
      'TTFT Min': ttftValues.length ? `${stats(ttftValues).min.toFixed(0)}ms` : 'N/A',
      'TTFT Max': ttftValues.length ? `${stats(ttftValues).max.toFixed(0)}ms` : 'N/A',
      'Token Type': [...new Set(runs.filter(r => r.firstTokenType).map(r => r.firstTokenType))].join(','),
      Errors: errors,
      'Total Time Avg': runs.length ? `${(runs.reduce((s, r) => s + (r.finishTime || 0), 0) / runs.length).toFixed(0)}ms` : 'N/A',
    })
  }

  // Print table
  const colWidths = {}
  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      colWidths[key] = Math.max(colWidths[key] || 0, String(val).length)
    }
  }

  const headers = Object.keys(rows[0] || {})
  const headerLine = headers.map(h => h.padEnd(colWidths[h])).join(' | ')
  const sepLine = headers.map(h => '-'.repeat(colWidths[h])).join('-|-')

  console.log()
  console.log(headerLine)
  console.log(sepLine)
  for (const row of rows) {
    console.log(headers.map(h => String(row[h]).padEnd(colWidths[h])).join(' | '))
  }

  // Per-run detail
  console.log('\n--- Per-Run Detail ---')
  for (const backend of BACKENDS) {
    console.log(`\n${backend}:`)
    for (const run of results[backend]) {
      if (run.error) {
        console.log(`  Run ${run.iteration}: ERROR - ${run.error}`)
      } else {
        console.log(`  Run ${run.iteration}: TTFB=${run.ttfb?.toFixed(0) || 'N/A'}ms  TTFT=${run.ttft?.toFixed(0) || 'N/A'}ms  type=${run.firstTokenType || 'N/A'}  tools=${run.toolCallCount}  total=${run.finishTime?.toFixed(0)}ms`)
      }
    }
  }

  console.log('\nDone.')
}

main().catch(console.error)
