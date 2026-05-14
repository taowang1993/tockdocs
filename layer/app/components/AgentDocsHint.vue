<script setup lang="ts">
import { AGENT_DOCS_INDEX_PATH } from '../../utils/agent-docs'
import { buildMarkdownAliasPath, stripContentSourceExtension } from '../../utils/content-source'

const route = useRoute()
const docs = useTockDocs()

const pagePath = computed(() => stripContentSourceExtension(route.path))
const markdownPath = computed(() => docs.isDocsRoute.value ? buildMarkdownAliasPath(pagePath.value) : undefined)
</script>

<template>
  <blockquote
    class="sr-only"
    data-tockdocs-agent-docs-hint
  >
    AI coding agents: see
    <a :href="AGENT_DOCS_INDEX_PATH">{{ AGENT_DOCS_INDEX_PATH }}</a>
    for the full documentation index.
    <template v-if="markdownPath">
      Markdown version:
      <a :href="markdownPath">{{ markdownPath }}</a>.
    </template>
  </blockquote>
</template>
