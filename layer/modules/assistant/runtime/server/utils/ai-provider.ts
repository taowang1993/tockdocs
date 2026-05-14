import { createGateway } from '@ai-sdk/gateway'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { H3Event } from 'h3'

export type AssistantProvider = 'vercel' | 'openrouter' | 'deepseek' | 'nvidia' | 'huggingface' | 'groq' | 'github' | 'gemini' | 'cloudflare'

type OpenAICompatibleProvider = ReturnType<typeof createOpenAICompatible>

type AssistantProviderConfig = {
  provider: AssistantProvider
  model: string
  siteUrl: string
} & (
  | {
    provider: 'vercel'
    apiKey?: string
  }
  | {
    provider: Exclude<AssistantProvider, 'vercel' | 'gemini'>
    apiKey: string
    baseURL: string
    headers?: Record<string, string>
  }
  | {
    provider: 'gemini'
    apiKey: string
  }
)

function normalizeProvider(provider: string | undefined): AssistantProvider {
  switch (provider?.toLowerCase()) {
    case 'vercel':
      return 'vercel'
    case 'deepseek':
      return 'deepseek'
    case 'nvidia':
      return 'nvidia'
    case 'huggingface':
      return 'huggingface'
    case 'groq':
      return 'groq'
    case 'github':
      return 'github'
    case 'gemini':
      return 'gemini'
    case 'cloudflare':
      return 'cloudflare'
    case 'openrouter':
      return 'openrouter'
    default:
      return 'vercel'
  }
}

function getAssistantSiteUrl(event: H3Event) {
  const siteConfig = getSiteConfig(event)
  return siteConfig.url || getRequestURL(event).origin
}

function getOpenRouterHeaders(siteUrl: string) {
  return siteUrl.startsWith('https://')
    ? {
        'HTTP-Referer': siteUrl,
        'X-Title': 'TockDocs',
      }
    : undefined
}

function getAiGatewayApiKey(config: ReturnType<typeof useRuntimeConfig>) {
  return config.assistant.aiGatewayApiKey
    || process.env.AI_GATEWAY_API_KEY
    || ''
}

function hasCloudflareCredentials(config: ReturnType<typeof useRuntimeConfig>) {
  return Boolean(
    (config.assistant.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN)
    && (config.assistant.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID),
  )
}

function getConfiguredProvider(config: ReturnType<typeof useRuntimeConfig>) {
  const explicitProvider = config.assistant.provider || process.env.AI_PROVIDER
  if (explicitProvider) {
    return normalizeProvider(explicitProvider)
  }

  if (getAiGatewayApiKey(config) || process.env.VERCEL_OIDC_TOKEN) return 'vercel'
  if (config.assistant.openrouterApiKey || process.env.OPENROUTER_API_KEY) return 'openrouter'
  if (config.assistant.deepseekApiKey || process.env.DEEPSEEK_API_KEY) return 'deepseek'
  if (config.assistant.nvidiaApiKey || process.env.NVIDIA_API_KEY) return 'nvidia'
  if (config.assistant.huggingfaceApiKey || process.env.HUGGINGFACE_API_KEY) return 'huggingface'
  if (config.assistant.groqApiKey || process.env.GROQ_API_KEY) return 'groq'
  if (config.assistant.githubToken || process.env.GITHUB_TOKEN) return 'github'
  if (config.assistant.geminiApiKey || process.env.GEMINI_API_KEY) return 'gemini'
  if (hasCloudflareCredentials(config)) return 'cloudflare'

  return 'vercel'
}

function getModelOverride(config: ReturnType<typeof useRuntimeConfig>) {
  return config.assistant.model || ''
}

export function getAssistantProviderConfig(event: H3Event): AssistantProviderConfig {
  const config = useRuntimeConfig(event)
  const provider = getConfiguredProvider(config)
  const modelOverride = getModelOverride(config)
  const siteUrl = getAssistantSiteUrl(event)

  if (provider === 'deepseek') {
    const apiKey = config.assistant.deepseekApiKey || process.env.DEEPSEEK_API_KEY || ''
    const model = modelOverride || config.assistant.deepseekModel || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

    if (!apiKey) {
      throw createError({
        statusCode: 503,
        statusMessage: 'AI assistant is not configured. Set DEEPSEEK_API_KEY on the server.',
      })
    }

    return {
      provider,
      apiKey,
      model,
      baseURL: 'https://api.deepseek.com',
      siteUrl,
    }
  }

  if (provider === 'nvidia') {
    const apiKey = config.assistant.nvidiaApiKey || process.env.NVIDIA_API_KEY || ''
    const model = modelOverride || config.assistant.nvidiaModel || process.env.NVIDIA_MODEL || 'minimaxai/minimax-m2.7'

    if (!apiKey) {
      throw createError({
        statusCode: 503,
        statusMessage: 'AI assistant is not configured. Set NVIDIA_API_KEY on the server.',
      })
    }

    return {
      provider,
      apiKey,
      model,
      baseURL: 'https://integrate.api.nvidia.com/v1',
      siteUrl,
    }
  }

  if (provider === 'huggingface') {
    const apiKey = config.assistant.huggingfaceApiKey || process.env.HUGGINGFACE_API_KEY || ''
    const model = modelOverride || config.assistant.huggingfaceModel || process.env.HUGGINGFACE_MODEL || 'deepseek-ai/DeepSeek-V4-Pro:together'

    if (!apiKey) {
      throw createError({
        statusCode: 503,
        statusMessage: 'AI assistant is not configured. Set HUGGINGFACE_API_KEY on the server.',
      })
    }

    return {
      provider,
      apiKey,
      model,
      baseURL: 'https://router.huggingface.co/v1',
      siteUrl,
    }
  }

  if (provider === 'groq') {
    const apiKey = config.assistant.groqApiKey || process.env.GROQ_API_KEY || ''
    const model = modelOverride || config.assistant.groqModel || process.env.GROQ_MODEL || 'openai/gpt-oss-120b'

    if (!apiKey) {
      throw createError({
        statusCode: 503,
        statusMessage: 'AI assistant is not configured. Set GROQ_API_KEY on the server.',
      })
    }

    return {
      provider,
      apiKey,
      model,
      baseURL: 'https://api.groq.com/openai/v1',
      siteUrl,
    }
  }

  if (provider === 'github') {
    const apiKey = config.assistant.githubToken || process.env.GITHUB_TOKEN || ''
    const model = modelOverride || config.assistant.githubModel || process.env.GITHUB_MODEL || 'openai/gpt-5'

    if (!apiKey) {
      throw createError({
        statusCode: 503,
        statusMessage: 'AI assistant is not configured. Set GITHUB_TOKEN on the server.',
      })
    }

    return {
      provider,
      apiKey,
      model,
      baseURL: 'https://models.github.ai/inference',
      siteUrl,
    }
  }

  if (provider === 'gemini') {
    const apiKey = config.assistant.geminiApiKey || process.env.GEMINI_API_KEY || ''
    const model = modelOverride || config.assistant.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.1-flash-live-preview'

    if (!apiKey) {
      throw createError({
        statusCode: 503,
        statusMessage: 'AI assistant is not configured. Set GEMINI_API_KEY on the server.',
      })
    }

    return {
      provider,
      apiKey,
      model,
      siteUrl,
    }
  }

  if (provider === 'cloudflare') {
    const apiKey = config.assistant.cloudflareApiToken
      || process.env.CLOUDFLARE_API_TOKEN
      || ''
    const accountId = config.assistant.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || ''
    const model = modelOverride || config.assistant.cloudflareModel || process.env.CLOUDFLARE_MODEL || '@cf/google/gemma-4-26b-a4b-it'

    if (!apiKey || !accountId) {
      throw createError({
        statusCode: 503,
        statusMessage: 'AI assistant is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN on the server.',
      })
    }

    return {
      provider,
      apiKey,
      model,
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
      siteUrl,
    }
  }

  if (provider === 'openrouter') {
    const apiKey = config.assistant.openrouterApiKey || process.env.OPENROUTER_API_KEY || ''
    const model = modelOverride || config.assistant.openrouterModel || process.env.OPENROUTER_MODEL || 'minimax/minimax-m2.5:free'

    if (!apiKey) {
      throw createError({
        statusCode: 503,
        statusMessage: 'AI assistant is not configured. Set OPENROUTER_API_KEY on the server.',
      })
    }

    return {
      provider,
      apiKey,
      model,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: getOpenRouterHeaders(siteUrl),
      siteUrl,
    }
  }

  const apiKey = getAiGatewayApiKey(config)
  const model = modelOverride || 'google/gemini-3-flash'

  if (!apiKey && !process.env.VERCEL_OIDC_TOKEN) {
    throw createError({
      statusCode: 503,
      statusMessage: 'AI assistant is not configured. Set AI_GATEWAY_API_KEY, use Vercel OIDC, or configure AI_PROVIDER with provider-specific server credentials.',
    })
  }

  return {
    provider: 'vercel',
    apiKey: apiKey || undefined,
    model,
    siteUrl,
  }
}

export function createAssistantProvider(event: H3Event): OpenAICompatibleProvider {
  const config = getAssistantProviderConfig(event)

  if (config.provider === 'vercel' || config.provider === 'gemini') {
    throw createError({
      statusCode: 500,
      statusMessage: `Provider factory is not available for ${config.provider}.`,
    })
  }

  return createOpenAICompatible({
    name: config.provider,
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    headers: config.headers,
  })
}

export function createAssistantChatModel(event: H3Event) {
  const config = getAssistantProviderConfig(event)

  if (config.provider === 'vercel') {
    return createGateway({
      apiKey: config.apiKey,
    }).languageModel(config.model)
  }

  if (config.provider === 'gemini') {
    return createGoogleGenerativeAI({
      apiKey: config.apiKey,
      name: 'gemini',
    })(config.model)
  }

  const openAICompatibleProvider = createAssistantProvider(event)
  return openAICompatibleProvider.chatModel(config.model)
}
