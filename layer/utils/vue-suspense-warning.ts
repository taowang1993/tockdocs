/**
 * Returns true when the console argument is the known Vue <Suspense>
 * experimental-feature warning that we suppress during development.
 */
export function isVueSuspenseWarning(arg: unknown): boolean {
  return (
    typeof arg === 'string'
    && arg.includes('<Suspense> is an experimental feature and its API will likely change.')
  )
}

/**
 * Nuxt Studio's TipTap editor registers the image extension twice
 * (once from the studio core, once from the consumer config overlay),
 * producing a harmless console warning during development.
 */
export function isTiptapDuplicateExtensionWarning(arg: unknown): boolean {
  return (
    typeof arg === 'string'
    && arg.includes('[tiptap warn]: Duplicate extension names found')
  )
}

/**
 * Some Nuxt Studio toolbar icons pass a bare size token ("xs")
 * as SVG width/height attributes during dev-mode hot reloads,
 * triggering a harmless DOM warning.
 */
export function isSvgXsAttributeError(arg: unknown): boolean {
  return (
    typeof arg === 'string'
    && arg.startsWith('Error: <svg> attribute')
    && arg.includes('Expected length, "xs"')
  )
}
