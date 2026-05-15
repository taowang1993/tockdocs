const BASE_URL = 'http://localhost:4987'
const ENDPOINT = `${BASE_URL}/__tockdocs__/assistant`
const QUERY = 'What is TockDocs?'

async function runOne(label) {
  const body = JSON.stringify({
    messages: [{
      role: 'user',
      content: QUERY,
      parts: [{ type: 'text', text: QUERY }],
    }],
  })

  const start = performance.now()
  let ttfb = null, ttft = null, firstType = null, tools = 0, chunks = 0, error = null

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': `${BASE_URL}/docs/manual/en`,
      },
      body,
    })

    if (!res.ok) {
      console.log(`${label}: HTTP ${res.status}`)
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
        }
        catch {
          // Ignore malformed SSE chunks and keep measuring the stream.
        }
      }
    }
  }
  catch (e) {
    error = e.message
  }

  console.log(`${label}: TTFB=${ttfb?.toFixed(0) || 'N/A'}ms  TTFT=${ttft?.toFixed(0) || 'N/A'}ms  first=${firstType || 'none'}  tools=${tools}  chunks=${chunks}${error ? '  ERR=' + error : ''}`)
  return { ttfb, ttft, firstType, tools, chunks, error }
}

async function main() {
  const backend = process.argv[2] || process.env.ASSISTANT_FS_BACKEND || 'mcp'
  console.log(`Testing backend: ${backend} (3 runs)`)
  console.log(`Query: "${QUERY}"`)
  console.log()

  const runs = []
  for (let i = 0; i < 3; i++) {
    const result = await runOne(`Run ${i + 1}`)
    runs.push(result)
    // Small delay between runs to avoid rate limiting
    if (i < 2) await new Promise(r => setTimeout(r, 2000))
  }

  const ttftVals = runs.filter(r => r.ttft != null).map(r => r.ttft)
  if (ttftVals.length > 0) {
    const avg = ttftVals.reduce((a, b) => a + b, 0) / ttftVals.length
    const min = Math.min(...ttftVals)
    const max = Math.max(...ttftVals)
    console.log(`\nTTFT: avg=${avg.toFixed(0)}ms  min=${min.toFixed(0)}ms  max=${max.toFixed(0)}ms`)
  }
}

main().catch(console.error)
