import type { AssistantModuleOptions } from './modules/assistant'
import type { SkillsModuleOptions } from './modules/skills'

export interface TockDocsNuxtConfig {
  assistant?: AssistantModuleOptions
  skills?: SkillsModuleOptions
}

declare module '@nuxt/schema' {
  interface NuxtConfig {
    tockdocs?: TockDocsNuxtConfig
    /** @deprecated Use `tockdocs.assistant` instead */
    assistant?: AssistantModuleOptions
  }
  interface NuxtOptions {
    tockdocs?: TockDocsNuxtConfig
    /** @deprecated Use `tockdocs.assistant` instead */
    assistant?: AssistantModuleOptions
  }
}

declare module 'nuxt/schema' {
  interface NuxtConfig {
    tockdocs?: TockDocsNuxtConfig
    /** @deprecated Use `tockdocs.assistant` instead */
    assistant?: AssistantModuleOptions
  }
  interface NuxtOptions {
    tockdocs?: TockDocsNuxtConfig
    /** @deprecated Use `tockdocs.assistant` instead */
    assistant?: AssistantModuleOptions
  }
}
