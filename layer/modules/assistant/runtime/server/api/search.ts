import { rm } from 'node:fs/promises'
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText } from 'ai'
import type { ToolCallPart, ToolSet, UIMessageStreamWriter } from 'ai'
import { createMCPClient } from '@ai-sdk/mcp'
import type { H3Event } from 'h3'
import { getDefaultLocale, resolveDocsRoute, resolveKnowledgeBaseLocale } from '../../../../../utils/docs'
import { INDEX_TOKEN_BUDGET, estimateIndexTokenCount, resolveIndexScope } from '../../../../../server/utils/index-generator'
import { createAssistantChatModel, getAssistantProviderConfig } from '../utils/ai-provider'
import { createBashTool, createGitFsBash, createGitFsUrlTransform, createRepoPathToUrlMapper } from '../utils/gitfs-bash'
import { getGitFsSystemPrompt, getIndexSystemPrompt, getMcpSystemPrompt } from '../utils/system-prompt'

const MAX_STEPS = 10
const MCP_CLIENT_TIMEOUT_MS = 30_000

function logAssistant(step: string, data: Record<string, unknown>) {
  console.info(`[tockdocs-assistant] ${JSON.stringify({ step, ...data })}`)
}

function createLocalFetch(event: H3Event): typeof fetch {
  const origin = getRequestURL(event).origin

  return (input, init) => {
    const requestUrl = input instanceof URL
      ? input
      : typeof input === 'string'
        ? new URL(input, origin)
        : new URL(input.url)
    const localPath = requestUrl.origin === origin
      ? `${requestUrl.pathname}${requestUrl.search}`
      : requestUrl.toString()

    return event.fetch(localPath, init)
  }
}

function buildInternalRoutePath(event: H3Event, path: string) {
  const baseURL = useRuntimeConfig(event).app?.baseURL?.replace(/\/$/, '') || ''
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${baseURL}${normalizedPath}`
}

function fetchInternalRoute(event: H3Event, path: string, init?: RequestInit) {
  const routePath = buildInternalRoutePath(event, path)

  if (import.meta.dev) {
    // Layer-owned handlers added via addServerHandler are not always reachable
    // through Nitro's local event.fetch path during dev. Use a real HTTP fetch
    // so /__tockdocs__/index/* resolves the same way the browser sees it.
    return fetch(new URL(routePath, getRequestURL(event).origin), init)
  }

  return createLocalFetch(event)(routePath, init)
}

const MAX_EXTRA_STEPS = 2

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stopWhenResponseComplete({ steps }: { steps: any[] }): boolean {
  const lastStep = steps.at(-1)
  if (!lastStep) return false

  const hasText = Boolean(lastStep.text && lastStep.text.trim().length > 0)
  const hasNoToolCalls = !lastStep.toolCalls || lastStep.toolCalls.length === 0

  if (hasText && hasNoToolCalls) return true

  // When the hard limit is reached, allow 2 extra steps to process any
  // pending tool calls and produce a final answer. Stop immediately if
  // those extra steps are exhausted.
  if (steps.length >= MAX_STEPS) {
    return steps.length >= MAX_STEPS + MAX_EXTRA_STEPS
  }

  return false
}

function getAssistantScope(event: H3Event) {
  const config = useRuntimeConfig(event).public as Parameters<typeof resolveDocsRoute>[1]
  const headerKb = getRequestHeader(event, 'X-TockDocs-KB')
  const headerLocale = getRequestHeader(event, 'X-TockDocs-Locale')

  // Prefer explicit headers sent by the UI (robust across bookmarks, new tabs, etc.)
  if (headerKb || headerLocale) {
    const knowledgeBases = (config.tockdocs as Record<string, unknown>)?.knowledgeBases as Array<{ id: string }> | undefined
    const kb = headerKb && knowledgeBases?.some(k => k.id === headerKb)
      ? headerKb
      : undefined
    const locale = headerLocale || getDefaultLocale(config)

    return {
      kb,
      locale: kb
        ? resolveKnowledgeBaseLocale(config, kb, locale)
        : locale,
      scopeLabel: kb ? `${kb}${locale ? `/${locale}` : ''}` : undefined,
    }
  }

  // Fallback to Referer header for backward compatibility
  const referer = getRequestHeader(event, 'referer')

  if (!referer) {
    return {
      kb: undefined,
      locale: getDefaultLocale(config),
      scopeLabel: undefined,
    }
  }

  try {
    const refererPath = new URL(referer).pathname
    const resolved = resolveDocsRoute(refererPath, config)

    return {
      kb: resolved.kb,
      locale: resolved.locale || getDefaultLocale(config),
      scopeLabel: resolved.kb ? `${resolved.kb}${resolved.locale ? `/${resolved.locale}` : ''}` : undefined,
    }
  }
  catch {
    return {
      kb: undefined,
      locale: getDefaultLocale(config),
      scopeLabel: undefined,
    }
  }
}

type KnowledgeBaseConfig = {
  id: string
  title: string
  description: string
  assistantName?: string
}

function getActiveKnowledgeBase(config: ReturnType<typeof useRuntimeConfig>, assistantScope: ReturnType<typeof getAssistantScope>) {
  const knowledgeBases = (config.public.tockdocs as Record<string, unknown>)?.knowledgeBases as KnowledgeBaseConfig[] | undefined

  return assistantScope.kb
    ? knowledgeBases?.find(kb => kb.id === assistantScope.kb)
    : undefined
}

function getAssistantFsBackend(config: ReturnType<typeof useRuntimeConfig>) {
  const backend = String(config.assistant.assistantFsBackend || '').toLowerCase()

  if (backend === 'gitfs') {
    return 'gitfs'
  }

  if (backend === 'index') {
    return 'index'
  }

  return 'mcp'
}

function getGitFsRoot(assistantScope: ReturnType<typeof getAssistantScope>) {
  if (!assistantScope.kb) {
    return 'docs/content'
  }

  return assistantScope.locale
    ? `docs/content/${assistantScope.kb}/${assistantScope.locale}`
    : `docs/content/${assistantScope.kb}`
}

function pickTool(tools: ToolSet, name: string) {
  const candidates = [
    name,
    name.replace(/-/g, '_'),
    name.replace(/_/g, '-'),
  ]

  for (const candidate of candidates) {
    const tool = tools[candidate]
    if (tool) {
      return tool
    }
  }

  return undefined
}

async function createMcpTools(event: H3Event, assistantScope: ReturnType<typeof getAssistantScope>) {
  const config = useRuntimeConfig(event)
  const mcpServer = config.assistant.mcpServer
  const isExternalUrl = mcpServer.startsWith('http://') || mcpServer.startsWith('https://')
  const baseURL = config.app?.baseURL?.replace(/\/$/, '') || ''
  const mcpUrl = new URL(mcpServer, getRequestURL(event).origin)

  if (assistantScope.kb) {
    mcpUrl.searchParams.set('kb', assistantScope.kb)
  }

  if (assistantScope.locale) {
    mcpUrl.searchParams.set('locale', assistantScope.locale)
  }

  const mcpAbortController = new AbortController()
  const mcpAbortTimer = setTimeout(() => {
    mcpAbortController.abort(new Error(`MCP client timed out after ${MCP_CLIENT_TIMEOUT_MS}ms`))
  }, MCP_CLIENT_TIMEOUT_MS)

  function createTimedFetch(baseFetch?: typeof fetch): typeof fetch {
    return (input, init) => {
      const fetchFn = baseFetch || fetch
      return fetchFn(input, { ...init, signal: mcpAbortController.signal })
    }
  }

  let transport: Parameters<typeof createMCPClient>[0]['transport']
  let transportMode = 'internal-local-fetch'

  if (isExternalUrl) {
    transportMode = 'external-http'
    transport = {
      type: 'http',
      url: mcpUrl.toString(),
      fetch: createTimedFetch(),
    }
  }
  else if (import.meta.dev) {
    transportMode = 'internal-dev-http'
    transport = {
      type: 'http',
      url: `${getRequestURL(event).origin}${baseURL}${mcpUrl.pathname}${mcpUrl.search}`,
      fetch: createTimedFetch(),
    }
  }
  else {
    transport = {
      type: 'http',
      url: `${getRequestURL(event).origin}${baseURL}${mcpUrl.pathname}${mcpUrl.search}`,
      fetch: createTimedFetch(createLocalFetch(event)),
    }
  }

  let httpClient: Awaited<ReturnType<typeof createMCPClient>> | undefined

  try {
    httpClient = await createMCPClient({ transport })
    const tools = await httpClient.tools() as ToolSet

    // MCP connection established — clear the transport timeout so it only
    // guards the initial connect + tools/list handshake, not model generation.
    clearTimeout(mcpAbortTimer)

    return {
      mcpServer,
      transportMode,
      transportUrl: transport.url,
      tools,
      close: async () => {
        clearTimeout(mcpAbortTimer)
        await httpClient?.close()
      },
    }
  }
  catch (error) {
    clearTimeout(mcpAbortTimer)
    await httpClient?.close()
    throw error
  }
}

export default defineEventHandler(async (event) => {
  const startedAt = performance.now()
  const { messages } = await readBody(event)
  const config = useRuntimeConfig(event)
  const siteConfig = getSiteConfig(event)
  const siteName = siteConfig.name || 'Documentation'
  const providerConfig = getAssistantProviderConfig(event)
  const assistantScope = getAssistantScope(event)
  const activeKb = getActiveKnowledgeBase(config, assistantScope)
  const requestedFsBackend = getAssistantFsBackend(config)
  let fsBackend = requestedFsBackend
  const requestPath = getRequestURL(event).pathname

  const requestLog = {
    requestPath,
    provider: providerConfig.provider,
    model: providerConfig.model,
    kb: assistantScope.kb,
    locale: assistantScope.locale,
    requestedFsBackend,
    messageCount: Array.isArray(messages) ? messages.length : 0,
  } satisfies Record<string, unknown>

  let tools: ToolSet = {}
  let systemPrompt = ''
  let closeResources = async () => {}
  // When using gitfs, this mapper converts /repo/ paths and GitHub URLs to TockDocs URLs.
  let repoUrlMapper: ((pathOrUrl: string) => string | undefined) | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let streamTransform: ((_opts: any) => TransformStream<any, any>) | undefined

  if (fsBackend === 'gitfs') {
    const githubToken = config.assistant.githubToken || process.env.GITHUB_TOKEN || ''

    if (!githubToken) {
      throw createError({
        statusCode: 500,
        statusMessage: 'ASSISTANT_FS_BACKEND=gitfs requires GITHUB_TOKEN to be set.',
      })
    }

    const gitfsOwner = process.env.GITFS_GITHUB_OWNER || 'taowang1993'
    const gitfsRepo = process.env.GITFS_GITHUB_REPO || 'tockdocs'
    const gitfsRef = process.env.GITFS_REF || 'main'
    const gitFsRoot = getGitFsRoot(assistantScope)

    logAssistant('request_start', {
      ...requestLog,
      fsBackend,
      repoOwner: gitfsOwner,
      repoName: gitfsRepo,
      repoRef: gitfsRef,
      gitFsRoot,
    })

    const gitFsContext = await createGitFsBash({
      githubToken,
      owner: gitfsOwner,
      repo: gitfsRepo,
      ref: gitfsRef,
      root: gitFsRoot,
    })

    const siteUrl = getRequestURL(event).origin
    const routePrefix = assistantScope.kb
      ? `/docs/${assistantScope.kb}${assistantScope.locale ? `/${assistantScope.locale}` : ''}`
      : ''

    repoUrlMapper = createRepoPathToUrlMapper({
      siteUrl,
      routePrefix,
      gitFsRoot,
      owner: gitfsOwner,
      repo: gitfsRepo,
      ref: gitfsRef,
    })

    streamTransform = createGitFsUrlTransform(repoUrlMapper)

    tools = {
      bash: createBashTool(gitFsContext.bash, repoUrlMapper),
    }
    systemPrompt = getGitFsSystemPrompt(siteName, assistantScope.scopeLabel, activeKb, siteUrl)

    logAssistant('gitfs_tools_loaded', {
      requestPath,
      toolCount: Object.keys(tools).length,
      toolNames: Object.keys(tools),
      gitFsRoot,
      commitSha: gitFsContext.repoFs.info().commitSha,
    })

    closeResources = async () => {
      await rm(gitFsContext.workspaceDir, { recursive: true, force: true })
    }
  }
  else {
    let indexContent = ''

    if (fsBackend === 'index') {
      const indexScope = resolveIndexScope(config.public as Parameters<typeof resolveDocsRoute>[1], assistantScope)

      if (!indexScope) {
        logAssistant('index_fallback', {
          requestPath,
          reason: 'missing scoped knowledge base',
        })
        fsBackend = 'mcp'
      }
      else {
        const indexPath = `/__tockdocs__/index/${encodeURIComponent(indexScope.scopeId)}/${encodeURIComponent(indexScope.locale)}.md`
        const indexUrl = buildInternalRoutePath(event, indexPath)

        try {
          const indexResponse = await fetchInternalRoute(event, indexPath)

          if (!indexResponse.ok) {
            logAssistant('index_fallback', {
              requestPath,
              reason: 'index not found',
              indexUrl,
              statusCode: indexResponse.status,
            })
            fsBackend = 'mcp'
          }
          else {
            indexContent = await indexResponse.text()
            const estimatedTokens = estimateIndexTokenCount(indexContent)

            if (estimatedTokens > INDEX_TOKEN_BUDGET) {
              logAssistant('index_fallback', {
                requestPath,
                reason: 'index too large',
                indexUrl,
                estimatedTokens,
                tokenBudget: INDEX_TOKEN_BUDGET,
              })
              fsBackend = 'mcp'
              indexContent = ''
            }
            else {
              logAssistant('index_loaded', {
                requestPath,
                indexUrl,
                estimatedTokens,
                charCount: indexContent.length,
              })
            }
          }
        }
        catch (error) {
          logAssistant('index_fallback', {
            requestPath,
            reason: 'index fetch failed',
            indexUrl,
            error: error instanceof Error ? error.message : String(error),
          })
          fsBackend = 'mcp'
        }
      }
    }

    const mcpContext = await createMcpTools(event, assistantScope)

    if (fsBackend === 'index') {
      const getPageTool = pickTool(mcpContext.tools, 'get-page')

      if (!getPageTool) {
        logAssistant('index_fallback', {
          requestPath,
          reason: 'get-page tool missing',
        })
        fsBackend = 'mcp'
      }
      else {
        tools = {
          'get-page': getPageTool,
        }
        systemPrompt = getIndexSystemPrompt(siteName, assistantScope.scopeLabel, activeKb, indexContent)

        logAssistant('index_tools_loaded', {
          requestPath,
          toolCount: Object.keys(tools).length,
          toolNames: Object.keys(tools),
        })
      }
    }

    if (fsBackend === 'mcp') {
      tools = mcpContext.tools
      systemPrompt = getMcpSystemPrompt(siteName, assistantScope.scopeLabel, activeKb)

      logAssistant('mcp_tools_loaded', {
        requestPath,
        toolCount: Object.keys(tools).length,
        toolNames: Object.keys(tools),
      })
    }

    logAssistant('request_start', {
      ...requestLog,
      fsBackend,
      mcpServer: mcpContext.mcpServer,
      transportMode: mcpContext.transportMode,
      transportUrl: mcpContext.transportUrl,
    })

    closeResources = mcpContext.close
  }

  let toolCallCount = 0

  const stream = createUIMessageStream({
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      try {
        const modelMessages = await convertToModelMessages(messages)
        const result = streamText({
          model: createAssistantChatModel(event),
          maxOutputTokens: 6000,
          maxRetries: 2,
          stopWhen: stopWhenResponseComplete,
          system: systemPrompt,
          messages: modelMessages,
          tools,
          // When using the gitfs backend, apply a stream transform that
          // deterministically replaces any remaining filesystem paths or
          // GitHub URLs with proper TockDocs URLs. This acts as a safety net
          // in case the model cites raw /repo/ paths despite the prompt.
          ...(streamTransform ? { experimental_transform: streamTransform } : {}),
          onStepFinish: ({ toolCalls }: { toolCalls: ToolCallPart[] }) => {
            if (toolCalls.length === 0) return

            toolCallCount += toolCalls.length

            logAssistant('tool_calls', {
              requestPath,
              provider: providerConfig.provider,
              model: providerConfig.model,
              fsBackend,
              toolCalls: toolCalls.map((tc: ToolCallPart) => tc.toolName),
            })

            writer.write({
              id: toolCalls[0]?.toolCallId,
              type: 'data-tool-calls',
              data: {
                tools: toolCalls.map((tc: ToolCallPart) => {
                  const args = 'args' in tc ? tc.args : 'input' in tc ? tc.input : {}
                  return {
                    toolName: tc.toolName,
                    toolCallId: tc.toolCallId,
                    args,
                  }
                }),
              },
            })
          },
        })
        writer.merge(result.toUIMessageStream())
      }
      catch (error) {
        logAssistant('request_error', {
          requestPath,
          provider: providerConfig.provider,
          model: providerConfig.model,
          fsBackend,
          durationMs: Number((performance.now() - startedAt).toFixed(1)),
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    onFinish: async () => {
      try {
        await closeResources()
      }
      catch (error) {
        logAssistant('resource_cleanup_error', {
          requestPath,
          fsBackend,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      logAssistant('request_finish', {
        requestPath,
        provider: providerConfig.provider,
        model: providerConfig.model,
        fsBackend,
        durationMs: Number((performance.now() - startedAt).toFixed(1)),
        toolCallCount,
      })
    },
  })

  return createUIMessageStreamResponse({ stream })
})
