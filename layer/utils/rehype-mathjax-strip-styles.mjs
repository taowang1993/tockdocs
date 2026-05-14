/**
 * Remove MathJax's inline <style> blocks from rendered markdown.
 *
 * We ship the required MathJax SVG stylesheet globally from
 * `layer/app/assets/css/main.css` so content pages do not embed per-page style
 * tags. That avoids Vue SSR hydration mismatches caused by differing escaping
 * of quote characters inside <style> text nodes.
 */
export default function rehypeMathJaxStripStyles() {
  return function transform(tree) {
    stripMathJaxStyles(tree)
  }
}

function stripMathJaxStyles(node) {
  if (!node || !Array.isArray(node.children)) {
    return
  }

  node.children = node.children.filter((child) => {
    if (child?.type !== 'element' || child.tagName !== 'style') {
      return true
    }

    const cssText = Array.isArray(child.children)
      ? child.children
          .map(grandchild => grandchild?.type === 'text' ? grandchild.value : '')
          .join('')
      : ''

    return !/mjx-container\[jax="(?:SVG|CHTML)"\]/.test(cssText)
  })

  for (const child of node.children) {
    stripMathJaxStyles(child)
  }
}
