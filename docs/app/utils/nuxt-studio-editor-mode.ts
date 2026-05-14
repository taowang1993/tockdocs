/**
 * Pure logic for enforcing Nuxt Studio code-editor mode on the Chemistry KB.
 *
 * The Chemistry KB contains mathematical notation (`$...$`) and a few complex
 * HTML tables that Nuxt Studio's TipTap visual editor cannot represent,
 * leaving the editor blank.  This module detects chemistry routes and determines
 * when to switch to the Monaco code editor.
 *
 * Design: we use a session-scoped boolean flag (`__tockdocs_chemistry_override`)
 * for same-tab navigation and a persistent localStorage key to remember the
 * user's pre-chemistry editor mode. That lets us recover from stale `'code'`
 * mode after a reload or new tab while still restoring users who genuinely
 * prefer the code editor.
 *
 * Tested by the sibling `*.test.ts` file via Node's native test runner.
 */

export type EditorMode = 'code' | 'tiptap'

export const CHEMISTRY_DOCS_PREFIX = '/docs/chemistry/'
export const STUDIO_PREFERENCES_KEY = 'studio-preferences'
export const OVERRIDE_ACTIVE_KEY = '__tockdocs_chemistry_override'
export const PREVIOUS_MODE_KEY = 'tockdocs:studio-editor-mode-previous'

export interface StudioEditorContext {
  /** Current editor mode read from localStorage's `studio-preferences`. */
  currentMode: EditorMode
  /** Whether the override sessionStorage flag is currently set. */
  overrideActive: boolean
  /** Remembered pre-chemistry editor mode, if one is stored. */
  previousMode: EditorMode | null
}

/** Result returned when no storage change is needed. */
export interface StorageAction {
  /** If true, set the override-active sessionStorage flag. */
  setOverride?: boolean
  /** If set, persist this pre-chemistry mode into localStorage. */
  setPreviousMode?: EditorMode
  /** If true, clear the override-active sessionStorage flag. */
  clearOverride?: boolean
  /** If true, clear the persisted pre-chemistry mode from localStorage. */
  clearPreviousMode?: boolean
  /** If set, write this mode to localStorage's editorMode. */
  editorMode?: EditorMode
}

/**
 * Decide what storage writes (if any) are needed for the given route.
 *
 * @param path     Current route path (e.g. `/docs/chemistry/zh/…`)
 * @param context  Current Studio editor state derived from browser storage.
 */
export function computeStudioEditorAction(
  path: string,
  context: StudioEditorContext,
): StorageAction | null {
  const onChemistry = path.startsWith(CHEMISTRY_DOCS_PREFIX)
  const { currentMode, overrideActive, previousMode } = context

  if (onChemistry) {
    // Already in override? Nothing to do.
    if (overrideActive) return null

    return {
      setOverride: true,
      setPreviousMode: previousMode ?? currentMode,
      editorMode: currentMode === 'code' ? undefined : 'code',
    }
  }

  // Fresh non-chemistry page with no override metadata: respect whatever mode
  // the user currently prefers.
  if (!overrideActive && !previousMode) {
    return null
  }

  const targetMode = previousMode ?? 'tiptap'

  return {
    clearOverride: overrideActive || undefined,
    clearPreviousMode: previousMode ? true : undefined,
    editorMode: currentMode === targetMode ? undefined : targetMode,
  }
}
