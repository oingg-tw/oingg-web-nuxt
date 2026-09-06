<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const route = useRoute()
const { getPostBySlug } = useBlogPosts()

const post = getPostBySlug(String(route.params.slug))

// No custom 404 page exists elsewhere in this app to match — createError with fatal:true is
// Nuxt's own standard unmatched-content behavior, same as any other missing dynamic route.
if (!post) {
  throw createError({ statusCode: 404, statusMessage: '找不到這篇文章', fatal: true })
}

useSeoMeta({
  title: `${post.title} — 安盈選股`,
  description: post.description
})

const requestUrl = useRequestURL()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.description,
        datePublished: post.publishedAt,
        url: `${requestUrl.origin}/blog/${post.slug}`
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
      <time class="blog-post__date" :datetime="post.publishedAt">{{ post.publishedAt }}</time>
    </header>

    <section v-for="section in post.sections" :key="section.heading" class="blog-post__section">
      <h2 class="blog-post__section-title">{{ section.heading }}</h2>
      <p v-for="(paragraph, index) in section.paragraphs" :key="index" class="blog-post__paragraph">
        {{ paragraph }}
      </p>
    </section>

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

.blog-post__section {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
  }
}

.blog-post__paragraph {
  margin: 0;
  font-size: 18px;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
}

.blog-post__disclaimer {
  margin: 0;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
