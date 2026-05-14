/**
 * Static file paths that should never be routed through Vue Router.
 * These are served by Nitro directly (llms.txt, llms-full.txt, sitemaps, etc.)
 * and must do a full page navigation instead of an SPA transition.
 */
const STATIC_FILE_PATHS = [
  '/llms-full.txt',
  '/llms.txt',
  '/sitemap.xml',
  '/sitemap-index.xml',
  '/sitemap_index.xml',
]

export default defineNuxtPlugin(() => {
  const router = useRouter()

  router.beforeEach((to) => {
    if (STATIC_FILE_PATHS.includes(to.path) || to.path.startsWith('/.well-known/')) {
      window.location.assign(to.fullPath)
      return false
    }
  })
})
