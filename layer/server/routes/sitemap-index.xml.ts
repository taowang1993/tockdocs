export default defineEventHandler((event) => {
  return sendRedirect(event, '/sitemap.xml', 301)
})
