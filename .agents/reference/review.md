# TockDocs phased review plan

This review plan is **feature-based**, not directory-based. Each phase follows a user-visible capability across the layer, docs app, server utilities, and starter/consumer surfaces that implement it.

## Review workflow for Pi

For each phase:

1. Start from the **feature contract**: what the user expects the feature to do.
2. Trace the full implementation across:
   - runtime config / Nuxt modules
   - app pages, layouts, components, and composables
   - server utilities and API/MCP handlers
   - consumer app usage in `docs/`, `playground/`, or starters when relevant
3. Look for:
   - broken feature contracts
   - mismatched assumptions between server/client or build/runtime
   - missing build-time assets or prerendered outputs
   - hidden route/content collisions
   - stale compatibility code
   - SSR/hydration hazards
   - incorrect path, locale, or URL construction
   - bad fallbacks that silently mask broken state
   - verification gaps that let newer features ship untested
4. Record findings before fixing:
   - feature
   - files involved
   - impact
   - fix strategy
   - verification
5. After fixes, run the smallest useful verification for that phase.

## Phases

### Phase 1 — Content topology, knowledge-base discovery, locale gating, and route registration

- **Primary surfaces to trace:** `layer/utils/knowledge-bases.ts`, `layer/modules/config.ts`, `layer/content.config.ts`, `layer/modules/routing.ts`, `layer/app/plugins/i18n.ts`, `layer/app/composables/useTockDocs.ts`, `layer/app/composables/useTockDocsI18n.ts`, docs/KB route pages
- **Key review questions:** Do discovered KBs/locales exactly match real content? Do collection names, route params, redirects, and runtime config agree? Can legacy and KB modes coexist without route collisions?

### Phase 2 — Docs page rendering, navigation shell, selectors, page actions, and metadata

- **Primary surfaces to trace:** `layer/app/app.vue`, `layer/app/layouts/docs.vue`, `layer/app/composables/useDocsPage.ts`, `layer/app/composables/useDocsNavigation.ts`, `layer/app/components/app/*`, `layer/app/components/HeaderSelectors.vue`, `layer/app/components/KnowledgeBaseDirectory.vue`, `layer/app/components/docs/*`, docs page components
- **Key review questions:** Does a docs page render the right content, actions, edit/report links, navigation, locale selector, KB selector, SEO, and OG metadata for every mode?

### Phase 3 — Assistant UI, Scoped Retrieval, and Backend Selection

- **Primary surfaces to trace:** `layer/modules/assistant/**`, `layer/modules/index-generator.ts`, `layer/server/mcp/tools/*`, `layer/server/utils/content.ts`, `layer/server/utils/docs-search.ts`, `layer/server/utils/search-index*.ts`, `layer/modules/assistant/runtime/server/utils/gitfs-bash.ts`, `layer/modules/assistant/runtime/server/utils/system-prompt.ts`
- **Key review questions:** Does the assistant stay scoped to the current KB/locale across MCP, INDEX, and GitFS? Do prebuilt search assets and `INDEX.md` fall back safely? Are streamed responses, prompt/tool cleanup, and resizing/mobile shell behavior stable?

### Phase 4 — Machine-Facing Discovery, Markdown Serving, and Skill Manifests

- **Primary surfaces to trace:** `layer/server/routes/sitemap*.ts`, `layer/modules/config.ts`, `layer/modules/markdown-rewrite.ts`, `layer/server/plugins/llms-markdown-alias.ts`, `layer/server/handlers/source-markdown.ts`, `layer/server/middleware/markdown-source-alias.ts`, `layer/modules/skills/**`, `layer/utils/agent-docs.ts`, OG components/utilities, docs build-time config
- **Key review questions:** Do `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, `/source/**`, `/raw/**`, `.md` aliases, and `/.well-known/skills/*` all resolve to valid scoped content? Are prerendered assets, negotiated markdown responses, and crawl surfaces aligned with public routes?

### Phase 5 — Authoring Pipeline, Nuxt Studio Compatibility, and Content Transforms

- **Primary surfaces to trace:** `layer/modules/markdown-rewrite.ts`, `layer/content.config.ts`, `scripts/check-mdc-source.mjs`, `scripts/check-raw-html.mjs`, `scripts/check-content-integrity.mjs`, `scripts/check-translation-parity.mjs`, `docs/app/utils/nuxt-studio-editor-mode.ts`, `docs/app/plugins/nuxt-studio-editor-mode.client.ts`, Mermaid/MathJax utilities, docs content examples
- **Key review questions:** Can authors safely write Markdown/MDC without malformed pages, broken embeds, or incorrect rewritten links? Do raw HTML, MathJax, Mermaid, translation parity, and Chemistry Studio editor fallbacks avoid blank-editor or broken-render states?

### Phase 6 — Theming, Public Assets, Responsive Behavior, and Shared UI Primitives

- **Primary surfaces to trace:** `layer/app/components/app/*`, `layer/app/composables/useTockDocsColorMode.ts`, `layer/app/composables/useLogoAssets.ts`, `layer/utils/public-assets*.ts`, color mode middleware, logo/favicon handling, Tailwind/Nuxt UI integration, docs consumer branding plugins
- **Key review questions:** Do logos, favicons, theme assets, breakpoints, and responsive layouts behave consistently across SSR, client navigation, assistant dock/slideover states, and Studio overlays?

### Phase 7 — CLI Scaffolding, Starter Parity, and Consumer Integration

- **Primary surfaces to trace:** `cli/**`, `.starters/**`, starter content/config, generated project assumptions, `docs/nuxt.config.ts`, `playground/**`
- **Key review questions:** Do generated projects and local consumers still match the layer's real behavior for routing, i18n, content shape, assistant backends, skills manifests, markdown aliases, Nuxt Studio, and public assets?

### Phase 8 — Workspace Scripts, Test Coverage, Verification, and Publish Safety

- **Primary surfaces to trace:** root `package.json`, `scripts/**`, CI workflows, package metadata in `layer/` and `cli/`, regression tests across `layer/**` and `docs/**`
- **Key review questions:** Do clean installs run the documented checks? Does `test:regression` cover newer feature tests? Do benchmark/debug scripts avoid machine-specific assumptions? Do local checks, CI, and publish flows validate the real product surfaces without stale assumptions?

## Review order guidance

Run the phases in order. The first three phases cover the core product loop:

1. **Can TockDocs discover and route the docs correctly?**
2. **Can a user read and navigate those docs correctly?**
3. **Can the assistant ground itself in those docs correctly?**

If a later phase depends on a bug in an earlier phase, fix the earlier phase first and then re-check the later feature.
