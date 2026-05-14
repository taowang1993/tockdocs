import {
  isSvgXsAttributeError,
  isTiptapDuplicateExtensionWarning,
  isVueSuspenseWarning,
} from '../../utils/vue-suspense-warning'

export default defineNuxtPlugin(() => {
  if (!import.meta.dev) {
    return
  }

  const globalState = globalThis as typeof globalThis & {
    __tockdocsConsolePatched?: boolean
  }

  if (globalState.__tockdocsConsolePatched) {
    return
  }

  const originalWarn = console.warn.bind(console)

  console.warn = (...args: unknown[]) => {
    if (
      isVueSuspenseWarning(args[0])
      || isTiptapDuplicateExtensionWarning(args[0])
    ) {
      return
    }

    originalWarn(...args)
  }

  const originalError = console.error.bind(console)

  console.error = (...args: unknown[]) => {
    if (isSvgXsAttributeError(args[0])) {
      return
    }

    originalError(...args)
  }

  globalState.__tockdocsConsolePatched = true
})
