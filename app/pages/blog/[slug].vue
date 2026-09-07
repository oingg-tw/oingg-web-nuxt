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
.blog-post {
  display: flex;
  flex-direction: column;
  gap: 24px;
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
  gap: 8px;
}

.blog-post__title {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.4;
}

.blog-post__date {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

// The markdown body renders through ContentRenderer as plain h2/p/ul/ol/strong/a elements
// (no Prose component overrides configured) — styled here via :deep() to match the same
// typography the old hand-written BlogPostSection template used (h2 section titles, 18px/1.8
// paragraphs), so the migration doesn't visibly change any already-shipped post's look.
.blog-post__body {
  display: flex;
  flex-direction: column;
  gap: 12px;

  :deep(h2) {
    margin: 12px 0 0;
    font-size: 22px;
    font-weight: 700;

    &:first-child {
      margin-top: 0;
    }
  }

  :deep(h3) {
    margin: 8px 0 0;
    font-size: 19px;
    font-weight: 600;
  }

  :deep(p) {
    margin: 0;
    font-size: 18px;
    line-height: 1.8;
    color: var(--el-text-color-secondary);
  }

  :deep(ul),
  :deep(ol) {
    margin: 0;
    padding-left: 24px;
    font-size: 18px;
    line-height: 1.8;
    color: var(--el-text-color-secondary);
  }

  :deep(li) {
    margin: 4px 0;
  }

  :deep(strong) {
    color: var(--el-text-color-primary);
    font-weight: 700;
  }

  :deep(a) {
    color: var(--el-color-primary);
  }

  :deep(hr) {
    margin: 4px 0;
    border: none;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

.blog-post__disclaimer {
  margin: 0;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
