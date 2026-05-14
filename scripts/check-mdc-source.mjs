import assert from 'node:assert/strict'
import { relative } from 'node:path'
import {
  getWorkspaceMarkdownContentDirs,
  lintMarkdownFiles,
  repoRoot,
  resolveMarkdownTargets,
} from './lib/mdc-source-lint.mjs'

const workspaceContentDirs = getWorkspaceMarkdownContentDirs()
assert.ok(workspaceContentDirs.length > 0, 'Missing workspace content directories to lint.')

const requestedPaths = process.argv.slice(2)
const markdownFiles = resolveMarkdownTargets(requestedPaths)

if (!markdownFiles.length) {
  console.log('No workspace markdown files to lint.')
  process.exit(0)
}

const results = await lintMarkdownFiles(markdownFiles)
const issues = results.flatMap(result => result.issues)

if (issues.length > 0) {
  console.error(`MDC source lint failed for ${new Set(issues.map(issue => issue.filePath)).size} file(s).`)

  for (const issue of issues.sort((left, right) => {
    const fileCompare = left.filePath.localeCompare(right.filePath)
    if (fileCompare !== 0) {
      return fileCompare
    }
    return left.line - right.line || left.column - right.column || left.ruleId.localeCompare(right.ruleId)
  })) {
    const relativePath = relative(repoRoot, issue.filePath)
    console.error(`- ${relativePath}:${issue.line}:${issue.column} [${issue.ruleId}] ${issue.message}`)
  }

  process.exit(1)
}

console.log(`MDC source lint passed for ${markdownFiles.length} markdown file(s).`)
