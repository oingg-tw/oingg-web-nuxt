import { defineCollection, defineContentConfig, z } from '@nuxt/content'
import { defineSitemapSchema } from '@nuxtjs/sitemap/content'

// Schema matches the frontmatter shape obsidian-04's docs/4_blogs drafts already use (see
// content/blog/*.md). Wired to blog/index.vue and blog/[slug].vue 2026-09-07 — those pages
// only query status === 'published', so a draft dropped into content/blog/ is invisible on the
// live site until its frontmatter is flipped (matching the old useBlogPosts.ts behavior, where
// a draft simply wasn't in the hardcoded array). meta_description/target_keywords/tags/aliases
// are the pipeline's own workflow fields, kept optional since they aren't all guaranteed on
// every draft. `date` is NOT part of that pipeline's own output (checked both existing drafts —
// neither had one) — it's filled in by hand when a post's status flips to published, so it's
// optional here too and only required in practice for anything actually queried/ordered live.
export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: 'page',
      source: 'blog/**/*.md',
      schema: z.object({
        title: z.string(),
        slug: z.string(),
        date: z.string().optional(),
        meta_description: z.string().optional(),
        target_keywords: z.array(z.string()).optional(),
        status: z.enum(['draft', 'published']).optional(),
        tags: z.array(z.string()).optional(),
        aliases: z.array(z.string()).optional(),
        // sitemap（@nuxtjs/sitemap 的 Content 整合，2026-10-23）：取代 nuxt.config 自己掃 frontmatter——那支只讀 content/blog 第一層，
        // preferred-stocks/ 底下兩篇已發布的文章一直沒進 sitemap。頁面是 /blog/{slug}（照 frontmatter 的 slug，不是檔案路徑），只列已發布的
        sitemap: defineSitemapSchema({
          z,
          name: 'blog',
          filter: entry => entry.status === 'published',
          onUrl: (url, entry) => {
            const { slug, date } = entry as { slug: string; date?: string }
            url.loc = `/blog/${slug}`
            if (date) url.lastmod = date
          }
        })
      })
    })
  }
})
