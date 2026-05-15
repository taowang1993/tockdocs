#!/usr/bin/env bash
set -euo pipefail

# TockDocs Assistant FS Backend Speed Test
# Restarts the dev server with each backend and measures TTFT.

PORT=4987
BASE_URL="http://localhost:${PORT}"
ENDPOINT="${BASE_URL}/__tockdocs__/assistant"
QUERY="What is TockDocs?"
ITERATIONS=3

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  # Kill the nuxt dev server
  pkill -f "nuxt dev" 2>/dev/null || true
  # Kill anything on our port
  lsof -ti:${PORT} 2>/dev/null | xargs kill 2>/dev/null || true
  sleep 1
}
trap cleanup EXIT

wait_for_server() {
  local max_wait=120
  local waited=0
  echo -n "  Waiting for server..."
  while ! curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/" 2>/dev/null | grep -q "200\|302"; do
    sleep 2
    waited=$((waited + 2))
    if [ $waited -ge $max_wait ]; then
      echo -e " ${RED}TIMEOUT${NC}"
      return 1
    fi
    echo -n "."
  done
  echo -e " ${GREEN}ready (${waited}s)${NC}"
  # Give it a moment to fully initialize
  sleep 3
}

start_server() {
  local backend=$1
  echo -e "\n${BLUE}=== Starting dev server with ASSISTANT_FS_BACKEND=${backend} ===${NC}"

  # Kill any existing server
  pkill -f "nuxt dev" 2>/dev/null || true
  lsof -ti:${PORT} 2>/dev/null | xargs kill 2>/dev/null || true
  sleep 2

  # Start new server in background
  cd /Users/max/projects/knowledge/tockdocs/docs
  ASSISTANT_FS_BACKEND="${backend}" pnpm run dev > /tmp/tockdocs-server-${backend}.log 2>&1 &
  SERVER_PID=$!
  echo "  Server PID: ${SERVER_PID}"

  cd /Users/max/projects/knowledge/tockdocs
  wait_for_server
}

run_test() {
  local backend=$1
  echo -e "\n${GREEN}--- Testing backend: ${backend} ---${NC}"

  for i in $(seq 1 ${ITERATIONS}); do
    echo -n "  Run ${i}/${ITERATIONS}: "
    node -e "
      const startTime = performance.now();
      const body = JSON.stringify({
        messages: [{
          role: 'user',
          content: '${QUERY}',
          parts: [{ type: 'text', text: '${QUERY}' }]
        }]
      });

      fetch('${ENDPOINT}', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': '${BASE_URL}/docs/manual/en'
        },
        body
      }).then(async res => {
        if (!res.ok) {
          console.log('HTTP ' + res.status);
          process.exit(1);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let ttfb = null, ttft = null, firstType = null, tools = 0, chunks = 0;

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const now = performance.now();
              if (ttfb === null) ttfb = (now - startTime).toFixed(0);
              chunks++;
              const json = line.slice(6);
              if (json === '[DONE]') continue;
              try {
                const data = JSON.parse(json);
                if (ttft === null && (data.type === 'reasoning-delta' || data.type === 'text-delta')) {
                  ttft = (now - startTime).toFixed(0);
                  firstType = data.type;
                }
                if (data.type === 'tool-input-start') tools++;
              } catch(e) {}
            }
          }
        } catch(e) {
          console.log('STREAM_ERR');
          process.exit(1);
        }

        // Print as JSON so we can parse it later
        console.log(JSON.stringify({
          ttfb: Number(ttfb),
          ttft: Number(ttft),
          firstType: firstType || 'none',
          tools,
          chunks,
          total: Number((performance.now() - startTime).toFixed(0))
        }));
      }).catch(err => {
        console.log('FETCH_ERR: ' + err.message);
        process.exit(1);
      });
    " 2>&1
  done
}

# --- Main ---
echo "======================================================================"
echo "  TockDocs Assistant FS Backend Speed Test"
echo "======================================================================"
echo "  Query: \"${QUERY}\""
echo "  Iterations per backend: ${ITERATIONS}"
echo "  Provider/Model: from .env (deepseek/deepseek-v4-pro)"
echo "======================================================================"

# Store per-backend results
declare -A TTFT_SUMS TTFT_MINS TTFT_MAXS TTFT_COUNTS
BACKENDS=("mcp" "index" "gitfs")

for backend in "${BACKENDS[@]}"; do
  TTFT_SUMS[$backend]=0
  TTFT_MINS[$backend]=999999
  TTFT_MAXS[$backend]=0
  TTFT_COUNTS[$backend]=0

  start_server "$backend"

  run_output=$(run_test "$backend")
  echo "$run_output"

  # Parse results
  while IFS= read -r line; do
    # Extract JSON part after "Run X/Y: "
    json_part=$(echo "$line" | sed 's/^.*Run [0-9]\/[0-9]: //')
    if echo "$json_part" | grep -q '^{'; then
      ttft=$(echo "$json_part" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).ttft))" 2>/dev/null || echo "")
      if [ -n "$ttft" ] && [ "$ttft" != "null" ]; then
        TTFT_COUNTS[$backend]=$((TTFT_COUNTS[$backend] + 1))
        TTFT_SUMS[$backend]=$((TTFT_SUMS[$backend] + ttft))
        if [ "$ttft" -lt "${TTFT_MINS[$backend]}" ]; then TTFT_MINS[$backend]=$ttft; fi
        if [ "$ttft" -gt "${TTFT_MAXS[$backend]}" ]; then TTFT_MAXS[$backend]=$ttft; fi
      fi
    fi
  done <<< "$run_output"
done

echo ""
echo "======================================================================"
echo "  SUMMARY"
echo "======================================================================"
echo ""
printf "%-10s %12s %12s %12s %12s\n" "Backend" "TTFT Avg" "TTFT Min" "TTFT Max" "Runs"
printf "%-10s %12s %12s %12s %12s\n" "-------" "--------" "--------" "--------" "----"
for backend in "${BACKENDS[@]}"; do
  count=${TTFT_COUNTS[$backend]}
  if [ "$count" -gt 0 ]; then
    avg=$((TTFT_SUMS[$backend] / count))
    printf "%-10s %10sms %10sms %10sms %10s\n" "$backend" "$avg" "${TTFT_MINS[$backend]}" "${TTFT_MAXS[$backend]}" "$count"
  else
    printf "%-10s %12s %12s %12s %12s\n" "$backend" "N/A" "N/A" "N/A" "0"
  fi
done
echo ""
echo "Done."
