import type { BlogPostSummary } from '#shared/types/blog'

// 部落格文章的網站地圖（2026-11-20：文章搬到業務中台，取代 @nuxt/content 的 sitemap 整合）。業務中台只回已發布的，所以每一篇都列，
// lastmod 是最後修改時間。讀不到就這一輪先不列，跟 hubs.get.ts 一樣：寧可少列幾篇，不讓整份網站地圖失敗
export default defineEventHandler(async () => {
  const list = await settle(businessFetch<{ entries: BlogPostSummary[] }>('/blog-posts'))
  return (list?.entries ?? []).map(post => ({ loc: `/blog/${post.slug}`, lastmod: post.updatedAt }))
})
