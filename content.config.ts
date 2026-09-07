import { defineCollection, defineContentConfig, z } from '@nuxt/content'

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
        aliases: z.array(z.string()).optional()
      })
    })
  }
})
