import { defineCollection, defineContentConfig, z } from '@nuxt/content'

// Schema matches the frontmatter shape conductor's docs/4_blogs drafts already use (see
// content/blog/*.md) — not yet wired to blog/index.vue or blog/[slug].vue (those still read
// useBlogPosts.ts's hand-written array); this just makes queryCollection('blog') usable ahead
// of that migration. meta_description/target_keywords/status/aliases are conductor's own
// workflow fields, kept optional here since they aren't all guaranteed on every draft.
export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: 'page',
      source: 'blog/**/*.md',
      schema: z.object({
        title: z.string(),
        slug: z.string(),
        meta_description: z.string().optional(),
        target_keywords: z.array(z.string()).optional(),
        status: z.enum(['draft', 'published']).optional(),
        tags: z.array(z.string()).optional(),
        aliases: z.array(z.string()).optional()
      })
    })
  }
})
