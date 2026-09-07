<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const route = useRoute()
const slug = String(route.params.slug)

// Migrated 2026-09-07 from useBlogPosts.ts's hand-written array to @nuxt/content's real
// content/blog/*.md collection — queried by the `slug` frontmatter field (not Nuxt Content's
// own auto-generated `path`) since that's the field the rest of the app (this route param,
// nuxt.config.ts's sitemap, the /preferred-stocks page's own hardcoded link) already keys off
// of. status !== 'published' (including a plain missing field, still mid-draft) 404s exactly
// like a slug that was never in the old hardcoded array did.
const { data: post } = await useAsyncData(`blog-${slug}`, () =>
  queryCollection('blog').where('slug', '=', slug).where('status', '=', 'published').first()
)

// No custom 404 page exists elsewhere in this app to match — createError with fatal:true is
// Nuxt's own standard unmatched-content behavior, same as any other missing dynamic route.
if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: '找不到這篇文章', fatal: true })
}

useSeoMeta({
  title: `${post.value.title} — 安盈選股`,
  description: post.value.meta_description
})

const requestUrl = useRequestURL()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.value.title,
        description: post.value.meta_description,
        datePublished: post.value.date,
        url: `${requestUrl.origin}/blog/${post.value.slug}`
      })
    }
  ]
})
</script>

<template>
  <article v-if="post" class="blog-post">
    <NuxtLink to="/blog" class="blog-post__back">← 回文章列表</NuxtLink>

    <header class="blog-post__header">
      <h1 class="blog-post__title">{{ post.title }}</h1>
      <time class="blog-post__date" :datetime="post.date">{{ post.date }}</time>
    </header>

    <div class="blog-post__body">
      <ContentRenderer :value="post" />
    </div>

    <p class="blog-post__disclaimer">
      本文僅為財經知識說明，不構成任何有價證券之買賣建議或獲利保證，實際投資決策請自行判斷並審慎評估風險。
    </p>
  </article>
</template>

<style scoped lang="scss">
// Redesigned 2026-09-07 per docs/0_researches/部落格頁面的設計如何打動人心使人閱讀愉悅.md
// (oingg-conductor-ts), "大幅改版（Medium/Substack 風格）" tier confirmed directly, scoped to
// this page + blog/index.vue only. Narrows the whole article to a ~680px editorial measure
// (report's own CJK-line-length guidance: 30–40 漢字/行), bumps H1/H2/H3 up a tier and gives
// headings an asymmetric vertical rhythm (top margin ~2.3x the bottom margin, so a heading
// visually belongs to the section below it rather than sitting equidistant between two — the
// report's own "鄰近性原則" point) instead of the old uniform flex `gap`. Never drops any text
// below the app's own 16px font floor even where the source report's own table would (its
// 13–14px caption row) — that floor is a standing policy, not something this page overrides.
.blog-post {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.blog-post__back {
  align-self: flex-start;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  text-decoration: none;

  &:hover {
    color: var(--el-color-primary);
  }
}

.blog-post__header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-post__title {
  margin: 0;
  font-size: 38px;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.blog-post__date {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

// The markdown body renders through ContentRenderer as plain h2/p/ul/ol/strong/a elements
// (no Prose component overrides configured).
.blog-post__body {
  :deep(h2) {
    margin: 56px 0 20px;
    font-size: 28px;
    font-weight: 600;
    line-height: 1.3;

    &:first-child {
      margin-top: 0;
    }
  }

  :deep(h3) {
    margin: 40px 0 16px;
    font-size: 20px;
    font-weight: 500;
    line-height: 1.4;
  }

  :deep(p) {
    margin: 0 0 20px;
    font-size: 18px;
    line-height: 1.75;
    letter-spacing: 0.02em;
    color: var(--el-text-color-secondary);

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 20px;
    padding-left: 24px;
    font-size: 18px;
    line-height: 1.75;
    letter-spacing: 0.02em;
    color: var(--el-text-color-secondary);
  }

  :deep(li) {
    margin: 6px 0;
  }

  :deep(strong) {
    color: var(--el-text-color-primary);
    font-weight: 700;
  }

  :deep(a) {
    color: var(--el-color-primary);
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: var(--el-color-primary-light-5);
  }

  :deep(hr) {
    margin: 8px 0;
    border: none;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

.blog-post__disclaimer {
  margin: 0;
  padding-top: 24px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
