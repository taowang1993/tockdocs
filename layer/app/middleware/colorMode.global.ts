import { useTockDocsColorMode } from '../composables/useTockDocsColorMode'

export default defineNuxtRouteMiddleware((to) => {
  const { forced } = useTockDocsColorMode()
  if (forced) {
    to.meta.colorMode = forced
  }
})
