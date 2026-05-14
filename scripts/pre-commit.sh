#!/bin/bash
# Pre-commit hook: scan staged files for leaked API keys.
# Patterns cover common credential formats.
set -euo pipefail

RED='\033[0;31m'
NC='\033[0m'

# Patterns that look like API keys/tokens
PATTERNS=(
  'sk-[a-zA-Z0-9]{20,}'            # OpenAI / DeepSeek / Anthropic style
  'hf_[a-zA-Z0-9]{20,}'            # Hugging Face
  'ghp_[a-zA-Z0-9]{20,}'           # GitHub classic PAT
  'github_pat_[a-zA-Z0-9]{20,}'    # GitHub fine-grained PAT
  'gho_[a-zA-Z0-9]{20,}'           # GitHub OAuth
  'ghu_[a-zA-Z0-9]{20,}'           # GitHub user-to-server
  'ghs_[a-zA-Z0-9]{20,}'           # GitHub server-to-server
  'xox[pborsa]-[a-zA-Z0-9-]{10,}'  # Slack
  'AKIA[0-9A-Z]{16}'               # AWS Access Key ID
  'ya29\.[a-zA-Z0-9_-]{20,}'       # Google OAuth
  'AIza[0-9A-Za-z_-]{35}'          # Google API
  'SG\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}' # SendGrid
  'pk\.[a-zA-Z0-9]{24,}'           # Stripe publishable
  '[rs]k_live_[a-zA-Z0-9]{20,}'    # Stripe secret
  'key-[a-zA-Z0-9]{32,}'           # Generic
)

echo "==> Checking staged files for leaked API keys..."

FAILED=0
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  echo "    No staged files."
  exit 0
fi

while IFS= read -r file; do
  # Only skip .env files (gitignored, may be force-added)
  if echo "$file" | grep -qE '\.env(\.[a-zA-Z0-9_-]+)?$'; then
    continue
  fi

  # Check each pattern
  for secret_pattern in "${PATTERNS[@]}"; do
    if git show ":$file" 2>/dev/null | grep -qE "$secret_pattern"; then
      echo -e "  ${RED}✗ $file${NC} — matched pattern: $secret_pattern"
      FAILED=1
      break
    fi
  done
done <<< "$STAGED_FILES"

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo -e "${RED}==> API keys detected in staged files. Commit blocked.${NC}"
  echo "    Remove credentials from the files above and try again."
  echo "    Use .env for local secrets — it is gitignored."
  exit 1
fi

echo "    No API keys detected."
exit 0
