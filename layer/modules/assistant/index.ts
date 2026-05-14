import { addComponent, addImports, addServerHandler, createResolver, defineNuxtModule, logger } from '@nuxt/kit'
import { defu } from 'defu'

export interface AssistantModuleOptions {
  /**
   * API endpoint path for the assistant
   * @default '/__tockdocs__/assistant'
   */
  apiPath?: string
  /**
   * MCP server URL or path.
   * - Use a path like '/mcp' to use the built-in TockDocs MCP server
   * - Use a full URL like 'https://docs.example.com/mcp' for external MCP servers
   * @default '/mcp'
   */
  mcpServer?: string
  /**
   * Filesystem backend for documentation retrieval.
   * - Use 'mcp' for the existing MCP tool flow
   * - Use 'index' to inject a build-time documentation index and expose only get-page
   * - Use 'gitfs' to expose the docs through a bash tool backed by GitFS
   * @default 'mcp'
   */
  assistantFsBackend?: string
  /**
   * Assistant model provider.
   * Supports 'vercel', 'openrouter', 'deepseek', 'nvidia', 'huggingface',
   * 'groq', 'github', 'gemini', and 'cloudflare'.
   * Defaults to AI_PROVIDER when set, otherwise auto-detects from available credentials.
   */
  provider?: string
  /**
   * Optional model override for the configured provider.
   * If omitted, provider-specific defaults are used.
   */
  model?: string
}

const log = logger.withTag('TockDocs')

const defaults: Required<Pick<AssistantModuleOptions, 'apiPath' | 'mcpServer' | 'assistantFsBackend'>> & Pick<AssistantModuleOptions, 'provider' | 'model'> = {
  apiPath: '/__tockdocs__/assistant',
  mcpServer: '/mcp',
  assistantFsBackend: 'mcp',
  provider: undefined,
  model: undefined,
}

type AssistantRuntimeConfig = {
  assistantFsBackend?: string
  provider?: string
  model?: string
  aiGatewayApiKey?: string
  openrouterApiKey?: string
  openrouterModel?: string
  deepseekApiKey?: string
  deepseekModel?: string
  nvidiaApiKey?: string
  nvidiaModel?: string
  huggingfaceApiKey?: string
  huggingfaceModel?: string
  groqApiKey?: string
  groqModel?: string
  githubToken?: string
  githubModel?: string
  geminiApiKey?: string
  geminiModel?: string
  cloudflareApiToken?: string
  cloudflareAccountId?: string
  cloudflareModel?: string
}

function hasCloudflareCredentials(config: AssistantRuntimeConfig) {
  return Boolean(config.cloudflareApiToken && config.cloudflareAccountId)
}

function getFirstConfiguredProvider(config: AssistantRuntimeConfig) {
  if (config.provider) return config.provider
  if (config.aiGatewayApiKey || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) return 'vercel'
  if (config.openrouterApiKey) return 'openrouter'
  if (config.deepseekApiKey) return 'deepseek'
  if (config.nvidiaApiKey) return 'nvidia'
  if (config.huggingfaceApiKey) return 'huggingface'
  if (config.groqApiKey) return 'groq'
  if (config.githubToken) return 'github'
  if (config.geminiApiKey) return 'gemini'
  if (hasCloudflareCredentials(config)) return 'cloudflare'
  return undefined
}

function hasAssistantCredentials(config: AssistantRuntimeConfig) {
  return Boolean(getFirstConfiguredProvider(config))
}

export default defineNuxtModule<AssistantModuleOptions>({
  meta: {
    name: 'assistant',
  },
  setup(_options, nuxt) {
    const legacyOptions = nuxt.options.assistant
    const usableLegacyOptions = legacyOptions && Object.keys(legacyOptions).length > 0
      ? Object.fromEntries(Object.entries(legacyOptions).filter(([, v]) => v))
      : undefined

    if (usableLegacyOptions && Object.keys(usableLegacyOptions).length > 0) {
      log.warn('`assistant` top-level config is deprecated. Move it under `tockdocs.assistant` in nuxt.config.ts')
    }

    const options = defu(nuxt.options.tockdocs?.assistant, usableLegacyOptions, defaults) as AssistantModuleOptions & {
      apiPath: string
      mcpServer: string
      assistantFsBackend: string
    }

    const assistantRuntimeConfig = (nuxt.options.runtimeConfig.assistant || {}) as AssistantRuntimeConfig
    const isDev = nuxt.options.dev
    const assistantCredentialsAvailable = hasAssistantCredentials(assistantRuntimeConfig)
    const assistantUiForced = process.env.NUXT_PUBLIC_ASSISTANT_ENABLED === 'true'
    const providerHint = options.provider || assistantRuntimeConfig.provider || 'auto'
    const assistantEnabled = isDev || assistantUiForced || assistantCredentialsAvailable

    const { resolve } = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.public.assistant = {
      enabled: assistantEnabled,
      apiPath: options.apiPath,
    }

    addImports([
      {
        name: 'useAssistant',
        from: resolve('./runtime/composables/useAssistant'),
      },
    ])

    const components = [
      'AssistantChat',
      'AssistantPanel',
      'AssistantFloatingInput',
      'AssistantLoading',
      'AssistantMatrix',
    ]

    components.forEach(name =>
      addComponent({
        name,
        filePath: assistantEnabled
          ? resolve(`./runtime/components/${name}.vue`)
          : resolve('./runtime/components/AssistantChatDisabled.vue'),
      }),
    )

    if (!assistantEnabled) {
      log.warn('AI assistant disabled: no supported provider credentials found and NUXT_PUBLIC_ASSISTANT_ENABLED is not true')
      return
    }

    log.info(`AI assistant enabled (provider hint: '${providerHint}')${isDev ? ' (dev mode)' : ''}`)

    nuxt.options.runtimeConfig.assistant = {
      ...(nuxt.options.runtimeConfig.assistant || {}),
      apiPath: options.apiPath,
      mcpServer: options.mcpServer,
      assistantFsBackend: process.env.ASSISTANT_FS_BACKEND || assistantRuntimeConfig.assistantFsBackend || options.assistantFsBackend || 'mcp',
      provider: options.provider || assistantRuntimeConfig.provider || '',
      model: options.model || assistantRuntimeConfig.model || '',
      aiGatewayApiKey: assistantRuntimeConfig.aiGatewayApiKey || '',
      openrouterApiKey: assistantRuntimeConfig.openrouterApiKey || '',
      openrouterModel: assistantRuntimeConfig.openrouterModel || 'minimax/minimax-m2.5:free',
      deepseekApiKey: assistantRuntimeConfig.deepseekApiKey || '',
      deepseekModel: assistantRuntimeConfig.deepseekModel || 'deepseek-chat',
      nvidiaApiKey: assistantRuntimeConfig.nvidiaApiKey || '',
      nvidiaModel: assistantRuntimeConfig.nvidiaModel || 'minimaxai/minimax-m2.7',
      huggingfaceApiKey: assistantRuntimeConfig.huggingfaceApiKey || '',
      huggingfaceModel: assistantRuntimeConfig.huggingfaceModel || 'deepseek-ai/DeepSeek-V4-Pro:together',
      groqApiKey: assistantRuntimeConfig.groqApiKey || '',
      groqModel: assistantRuntimeConfig.groqModel || 'openai/gpt-oss-120b',
      githubToken: assistantRuntimeConfig.githubToken || '',
      githubModel: assistantRuntimeConfig.githubModel || 'openai/gpt-5',
      geminiApiKey: assistantRuntimeConfig.geminiApiKey || '',
      geminiModel: assistantRuntimeConfig.geminiModel || 'gemini-3.1-flash-live-preview',
      cloudflareApiToken: assistantRuntimeConfig.cloudflareApiToken || '',
      cloudflareAccountId: assistantRuntimeConfig.cloudflareAccountId || '',
      cloudflareModel: assistantRuntimeConfig.cloudflareModel || '@cf/google/gemma-4-26b-a4b-it',
    }

    const routePath = options.apiPath.replace(/^\//, '')
    addServerHandler({
      route: `/${routePath}`,
      handler: resolve('./runtime/server/api/search'),
    })
  },
})

declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    assistant: {
      enabled: boolean
      apiPath: string
    }
  }
  interface RuntimeConfig {
    assistant: {
      apiPath: string
      mcpServer: string
      assistantFsBackend: string
      provider: string
      model: string
      aiGatewayApiKey: string
      openrouterApiKey: string
      openrouterModel: string
      deepseekApiKey: string
      deepseekModel: string
      nvidiaApiKey: string
      nvidiaModel: string
      huggingfaceApiKey: string
      huggingfaceModel: string
      groqApiKey: string
      groqModel: string
      githubToken: string
      githubModel: string
      geminiApiKey: string
      geminiModel: string
      cloudflareApiToken: string
      cloudflareAccountId: string
      cloudflareModel: string
    }
  }
}
