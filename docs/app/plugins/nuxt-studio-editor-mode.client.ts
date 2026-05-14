import {
  CHEMISTRY_DOCS_PREFIX,
  type EditorMode,
  computeStudioEditorAction,
  OVERRIDE_ACTIVE_KEY,
  PREVIOUS_MODE_KEY,
  STUDIO_PREFERENCES_KEY,
} from '../utils/nuxt-studio-editor-mode'

const LEGACY_MIGRATION_KEY = 'tockdocs:studio-editor-mode-migrated-v2'

function dispatchStudioPreferencesChange(previous: string | null, next: string) {
  window.dispatchEvent(new StorageEvent('storage', {
    key: STUDIO_PREFERENCES_KEY,
    oldValue: previous,
    newValue: next,
    storageArea: localStorage,
    url: window.location.href,
  }))
}

function readStudioEditorMode(): EditorMode {
  const raw = localStorage.getItem(STUDIO_PREFERENCES_KEY)
  if (!raw) return 'tiptap'

  try {
    const prefs = JSON.parse(raw) as { editorMode?: unknown }
    return prefs.editorMode === 'code' ? 'code' : 'tiptap'
  }
  catch {
    return 'tiptap'
  }
}

function writeStudioEditorMode(mode: EditorMode) {
  const previous = localStorage.getItem(STUDIO_PREFERENCES_KEY)
  let prefs: Record<string, unknown>

  if (previous) {
    try {
      prefs = JSON.parse(previous)
    }
    catch {
      prefs = {}
    }
  }
  else {
    prefs = {}
  }

  prefs.editorMode = mode
  const next = JSON.stringify(prefs)
  if (previous === next) return

  localStorage.setItem(STUDIO_PREFERENCES_KEY, next)
  dispatchStudioPreferencesChange(previous, next)
}

function readPreviousMode(): EditorMode | null {
  const value = localStorage.getItem(PREVIOUS_MODE_KEY)
  return value === 'code' || value === 'tiptap' ? value : null
}

function writePreviousMode(mode: EditorMode) {
  localStorage.setItem(PREVIOUS_MODE_KEY, mode)
}

function clearPreviousMode() {
  localStorage.removeItem(PREVIOUS_MODE_KEY)
}

function isOverrideActive(): boolean {
  return sessionStorage.getItem(OVERRIDE_ACTIVE_KEY) === '1'
}

function setOverrideActive() {
  sessionStorage.setItem(OVERRIDE_ACTIVE_KEY, '1')
}

function clearOverride() {
  sessionStorage.removeItem(OVERRIDE_ACTIVE_KEY)
}

function hasRunLegacyMigration(): boolean {
  return localStorage.getItem(LEGACY_MIGRATION_KEY) === '1'
}

function markLegacyMigrationComplete() {
  localStorage.setItem(LEGACY_MIGRATION_KEY, '1')
}

function applyForPath(path: string) {
  const currentMode = readStudioEditorMode()
  const overrideActive = isOverrideActive()
  const previousMode = readPreviousMode()
  const onChemistry = path.startsWith(CHEMISTRY_DOCS_PREFIX)

  // One-time recovery for users already stuck in legacy stale code mode from
  // earlier implementations that wrote `editorMode: 'code'` without persisting
  // enough metadata to distinguish a forced override from a user preference.
  if (!hasRunLegacyMigration() && !onChemistry && !overrideActive && !previousMode) {
    markLegacyMigrationComplete()

    if (currentMode === 'code') {
      writeStudioEditorMode('tiptap')
      return
    }
  }

  const action = computeStudioEditorAction(path, {
    currentMode,
    overrideActive,
    previousMode,
  })
  if (!action) return

  if (action.setPreviousMode) writePreviousMode(action.setPreviousMode)
  if (action.setOverride) setOverrideActive()
  if (action.editorMode) writeStudioEditorMode(action.editorMode)
  if (action.clearOverride) clearOverride()
  if (action.clearPreviousMode) clearPreviousMode()
}

export default defineNuxtPlugin(() => {
  const router = useRouter()
  applyForPath(router.currentRoute.value.path)
  router.afterEach(to => applyForPath(to.path))
})
