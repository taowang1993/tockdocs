const BASE_URL = 'http://localhost:4987'

async function runOne(backend, label, query, kb, locale) {
  const endpoint = `${BASE_URL}/__tockdocs__/assistant`
  const body = JSON.stringify({
    messages: [{
      role: 'user',
      content: query,
      parts: [{ type: 'text', text: query }]
    }]
  })

  const referer = kb ? `${BASE_URL}/docs/${kb}/${locale}` : `${BASE_URL}/docs/manual/en`
  
  const start = performance.now()
  let ttfb = null, ttft = null, firstType = null, tools = 0, chunks = 0, error = null

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': referer
      },
      body
    })

    if (!res.ok) {
      console.log(`  ${label}: HTTP ${res.status}`)
      return { ttfb: null, ttft: null, error: `HTTP ${res.status}` }
    }

    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })

      const lines = buf.split('\n')
      buf = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const now = performance.now()
        if (!ttfb) ttfb = now - start
        chunks++
        const j = line.slice(6)
        if (j === '[DONE]') continue
        try {
          const d = JSON.parse(j)
          if (!ttft && (d.type === 'reasoning-delta' || d.type === 'text-delta')) {
            ttft = now - start
            firstType = d.type
          }
          if (d.type === 'tool-input-start') tools++
        } catch {}
      }
    }
  } catch (e) {
    error = e.message
  }

  const total = performance.now() - start
  console.log(`  ${label}: TTFB=${ttfb?.toFixed(0) || 'N/A'}ms  TTFT=${ttft?.toFixed(0) || 'N/A'}ms  type=${firstType || '-'}  tools=${tools}  total=${total.toFixed(0)}ms${error ? '  ERR=' + error : ''}`)
  return { ttfb, ttft, firstType, tools, chunks, total, error }
}

async function main() {
  const backend = process.env.ASSISTANT_FS_BACKEND || 'index'
  const iterations = 3

  // Two test queries — one for manual KB, one for parser KB
  const tests = [
    {
      name: 'Parser KB (LandingAI ADE vs AWS Textract)',
      query: 'How does LandingAI ADE compare to AWS Textract for complex table extraction and form processing in enterprise document workflows?',
      kb: 'parser',
      locale: 'en'
    },
    {
      name: 'Manual KB (MCP server setup)',
      query: 'How do I set up the built-in MCP server in TockDocs and what tools does it expose for AI agents to search documentation?',
      kb: 'manual',
      locale: 'en'
    }
  ]

  console.log(`======================================================`)
  console.log(`  Backend: ${backend.toUpperCase()} — Real KB Queries`)
  console.log(`======================================================`)
  console.log()

  for (const test of tests) {
    console.log(`--- ${test.name} ---`)
    console.log(`  Query: "${test.query}"`)
    const runs = []
    for (let i = 0; i < iterations; i++) {
      const result = await runOne(backend, `Run ${i + 1}`, test.query, test.kb, test.locale)
      runs.push(result)
      if (i < iterations - 1) await new Promise(r => setTimeout(r, 2000))
    }
    const ttftVals = runs.filter(r => r.ttft != null).map(r => r.ttft)
    if (ttftVals.length > 0) {
      const avg = ttftVals.reduce((a, b) => a + b, 0) / ttftVals.length
      const min = Math.min(...ttftVals)
      const max = Math.max(...ttftVals)
      console.log(`  TTFT: avg=${avg.toFixed(0)}ms  min=${min.toFixed(0)}ms  max=${max.toFixed(0)}ms  tools=${runs.map(r=>r.tools).join(',')}`)
    }
    console.log()
  }
}

main().catch(console.error)
