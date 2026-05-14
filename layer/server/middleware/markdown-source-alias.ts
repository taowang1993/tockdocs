import { serveMarkdownSourceAlias, serveNegotiatedMarkdown, serveRawMarkdownAlias } from '../utils/markdown-source-alias'

export default defineEventHandler(async (event) => {
  const negotiatedMarkdown = await serveNegotiatedMarkdown(event)

  if (negotiatedMarkdown !== undefined) {
    return negotiatedMarkdown
  }

  const rawMarkdownAlias = await serveRawMarkdownAlias(event)

  if (rawMarkdownAlias !== undefined) {
    return rawMarkdownAlias
  }

  return await serveMarkdownSourceAlias(event)
})
