# Phase Review Findings

## Scope

This pass compared [review.md](/Users/max/conductor/workspaces/tockdocs/singapore/.agents/reference/review.md) against the current TockDocs architecture and then audited the phase 1-8 surfaces with targeted source reads plus repo verification.

## Findings

1. **Review Plan Drift (Phases 3-8)**  
   `review.md` no longer covered several newer product surfaces: the INDEX and GitFS assistant backends, prebuilt search index assets, markdown negotiation and source aliases, skill manifests, Nuxt Studio compatibility paths, and verification/tooling coverage. The review plan was updated so future audits trace the current architecture instead of the older MCP-only surface.

2. **Broken Regression Entry Point (Phase 8)**  
   `package.json` defined `test:regression` with `tsx`, but the workspace did not declare `tsx` as a dev dependency. A clean install could not run the regression suite at all. The workspace now declares `tsx`, and the regression script was expanded to include the newer tests for markdown aliases, docs search helpers, Studio warning handling, MathJax cleanup, and review-fix coverage.

3. **Verification Scripts Were Not Portable Or Lint-Clean (Phase 8)**  
   Several committed scripts under `scripts/` failed the repo lint gate, which made `pnpm run scan` fail on a clean checkout. The browser-oriented scripts also hard-coded a user-specific Playwright path under `/Users/max/...`, which made them non-portable. The scripts were reformatted, their remaining lint errors were fixed, and a shared `scripts/lib/load-playwright.cjs` helper now resolves `playwright` or `playwright-core` without machine-specific paths.

4. **Chinese Manual Content Had Structural MDC Drift (Phase 5)**  
   `docs/content/manual/zh/1.getting-started/3.installation.md`, `5.studio.md`, and `2.concepts/8.nuxt.md` no longer matched the English reference structure. The drift came from an incorrectly indented `note`, an inline `site-image` form that diverged from the reference page, and unindented nested tab components. Those pages were realigned with the English MDC structure so translation parity and source lint both pass again.

5. **I18n Audit Tooling And Locale Data Had Drift (Phase 8)**  
   `scripts/check-i18n-keys.mjs` only recognized lowercase dot-path keys in config files, so valid dynamic keys such as `docs.links-ui` were misreported as dead. After fixing the scanner, the remaining dead-key output pointed to genuinely stale locale entries: unused assistant keys across the shipped locale files and orphaned Indonesian copy/MCP labels. The scanner now recognizes current key shapes, and the stale locale entries were removed.

## Verification

- `pnpm run test:regression`  
  Passed with 146/146 tests after expanding the default regression set.
- `pnpm run scan`  
  Passed end to end, including lint, i18n audit, MDC lint, raw HTML checks, asset checks, translation parity, and typecheck.
- `pnpm run check:mdc-source docs/content/manual/zh/1.getting-started/3.installation.md docs/content/manual/zh/1.getting-started/5.studio.md docs/content/manual/zh/2.concepts/8.nuxt.md`  
  Passed after the MDC structure fixes.
- `pnpm run check:translation-parity`  
  Passed after the Chinese manual pages were realigned with the English reference structure.

## Result

The current review plan now matches the current product surface, the phase 8 verification path is runnable on a clean checkout, the translation-parity regressions are fixed, and the repo quality gates are green.
