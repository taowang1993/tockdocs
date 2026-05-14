export const AGENT_DOCS_INDEX_PATH = '/llms.txt'

export function buildAgentDocsDirective(markdownPath?: string) {
  const indexLink = `[${AGENT_DOCS_INDEX_PATH}](${AGENT_DOCS_INDEX_PATH})`
  const baseMessage = `AI coding agents: see ${indexLink} for the full documentation index.`

  return markdownPath
    ? `${baseMessage} Markdown version: [${markdownPath}](${markdownPath}).`
    : baseMessage
}

export function buildAgentDocsDirectiveMarkdown(markdownPath?: string) {
  return `> ${buildAgentDocsDirective(markdownPath)}`
}
