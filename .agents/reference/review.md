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
   - hidden route/content collisions
   - stale compatibility code
   - SSR/hydration hazards
   - incorrect path, locale, or URL construction
   - bad fallbacks that silently mask broken state
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

### Phase 3 — Assistant UI, MCP grounding, and hybrid retrieval

- **Primary surfaces to trace:** `layer/modules/assistant/**`, `layer/server/mcp/tools/*`, `layer/server/utils/content.ts`, `layer/server/utils/docs-search.ts`
- **Key review questions:** Does the assistant stay scoped to the current KB/locale, call tools correctly, retrieve the real source content, and avoid UI/runtime bugs during streaming or resizing?

### Phase 4 — Search, sitemap, llms, robots, and OG output as discovery features

- **Primary surfaces to trace:** `layer/server/routes/sitemap.xml.ts`, `layer/modules/config.ts`, `layer/modules/markdown-rewrite.ts`, OG components/utilities, docs build-time config
- **Key review questions:** Do machine-facing outputs point at valid pages and raw sources? Are prerendered assets and crawl surfaces aligned with public routes?

### Phase 5 — Markdown/MDC authoring pipeline and content transforms

- **Primary surfaces to trace:** `layer/modules/markdown-rewrite.ts`, `layer/content.config.ts`, MDC validation scripts, Mermaid integration, docs content examples
- **Key review questions:** Can authors safely write Markdown/MDC without producing malformed pages, broken embeds, or incorrect rewritten links?

### Phase 6 — Theming, responsive behavior, and shared UI primitives

- **Primary surfaces to trace:** `layer/app/components/app/*`, color mode composables, logo/favicon handling, Tailwind/Nuxt UI integration
- **Key review questions:** Do theme assets, breakpoints, and responsive layouts behave consistently across SSR and client navigation?

### Phase 7 — CLI scaffolding and starter parity with the layer

- **Primary surfaces to trace:** `cli/**`, `.starters/**`, starter content/config, generated project assumptions
- **Key review questions:** Do generated projects still match the layer's real behavior, especially for routing, i18n, content shape, and docs affordances?

### Phase 8 — Workspace scripts, verification, and publish/release safety

- **Primary surfaces to trace:** root `package.json`, `scripts/**`, CI workflows, package metadata in `layer/` and `cli/`
- **Key review questions:** Do local checks, CI checks, and publish flows validate the real product surfaces without hidden gaps or stale assumptions?

## Review order guidance

Run the phases in order. The first three phases cover the core product loop:

1. **Can TockDocs discover and route the docs correctly?**
2. **Can a user read and navigate those docs correctly?**
3. **Can the assistant ground itself in those docs correctly?**

If a later phase depends on a bug in an earlier phase, fix the earlier phase first and then re-check the later feature.
