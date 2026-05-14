/**
 * Nitro plugin that strips MathJax's inline <style> blocks from HTML
 * responses to prevent SSR hydration mismatches.
 *
 * MathJax injects a <style> tag with CSS like:
 *   mjx-container[jax="SVG"] { direction: ltr; }
 *   mjx-container[jax="CHTML"] { line-height: 0; }
 *
 * Vue SSR HTML-escapes the quote characters inside <style> text nodes
 * (producing &quot;), but the client-side hydration produces literal ",
 * causing a text mismatch warning. Stripping these style blocks at the
 * response level avoids the mismatch entirely. The equivalent CSS is
 * shipped globally from layer/app/assets/css/main.css.
 */

const MATHJAX_STYLE_RE = /<style[^>]*>\s*mjx-container\[jax="(?:SVG|CHTML)"\][\s\S]*?<\/style>/gi

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response) => {
    const contentType = response.headers?.['content-type']
    if (!contentType || !contentType.includes('text/html')) {
      return
    }

    if (typeof response.body === 'string') {
      response.body = response.body.replace(MATHJAX_STYLE_RE, '')
    }
  })
})
