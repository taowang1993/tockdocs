/**
 * Escape bare HTML tags in AI responses so the MDC parser does not
 * treat them as Vue components (e.g. `<kb>` or `<locale>`).
 * Only angle brackets immediately followed by a word character are
 * escaped; this preserves inline code spans, autolinks, and XML
 * processing instructions which are handled separately.
 */
export function sanitizeAssistantText(text: string): string {
  return text.replace(/<(?!(?:https?|mailto|ftp):)(\w)/g, '&lt;$1')
}
