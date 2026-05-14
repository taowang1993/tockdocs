export default defineNuxtPlugin(() => {
  const STYLE_ATTRIBUTE = 'data-tockdocs-studio-scrollbar'

  const getStudioShadowRoot = () => document.querySelector<HTMLElement>('nuxt-studio')?.shadowRoot

  const getColor = (name: string, fallback: string) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return value || fallback
  }

  const applyStudioScrollbarTheme = () => {
    const shadowRoot = getStudioShadowRoot()
    if (!shadowRoot) {
      return
    }

    const background = getColor('--ui-bg', getComputedStyle(document.body).backgroundColor || '#111827')
    const studio = shadowRoot.host as HTMLElement

    studio.style.background = background
    studio.style.colorScheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'

    let style = shadowRoot.querySelector<HTMLStyleElement>(`style[${STYLE_ATTRIBUTE}]`)
    if (!style) {
      style = document.createElement('style')
      style.setAttribute(STYLE_ATTRIBUTE, '')
      shadowRoot.append(style)
    }

    style.textContent = `
      :host {
        background: ${background} !important;
        color-scheme: ${studio.style.colorScheme};
      }

      :host,
      :host * {
        scrollbar-color: var(--ui-border-accented) transparent;
      }

      ::-webkit-scrollbar-track,
      ::-webkit-scrollbar-corner,
      *::-webkit-scrollbar-track,
      *::-webkit-scrollbar-corner {
        background: transparent !important;
      }

      ::-webkit-scrollbar-thumb,
      *::-webkit-scrollbar-thumb {
        background: var(--ui-border-accented) !important;
        border: 2px solid var(--ui-bg) !important;
        border-radius: 9999px;
      }
    `
  }

  const scheduleApply = () => {
    applyStudioScrollbarTheme()
    requestAnimationFrame(applyStudioScrollbarTheme)
    window.setTimeout(applyStudioScrollbarTheme, 60)
    window.setTimeout(applyStudioScrollbarTheme, 240)
  }

  const bodyObserver = new MutationObserver(scheduleApply)
  bodyObserver.observe(document.body, { childList: true })

  const colorModeObserver = new MutationObserver(scheduleApply)
  colorModeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  scheduleApply()
})
