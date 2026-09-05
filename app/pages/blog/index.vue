<script setup lang="ts">
// Same standalone landing layout as index.vue (no app-shell sidebar/search bar) — a blog exists
// for SEO/public discovery, not as an in-app tool section, so it belongs on the public
// marketing track rather than AppPinnedSidebar's authenticated APP_FEATURES list.
definePageMeta({ layout: 'landing' })

const { posts } = useBlogPosts()

useSeoMeta({
  title: '文章列表 — 安盈存股',
  description: '財報指標、殖利率觀念等存股族實用知識，用真實案例與計算方式說明，不做個股推薦。'
})

const requestUrl = useRequestURL()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: '安盈存股文章列表',
        url: `${requestUrl.origin}/blog`
      })
    }
  ]
})
</script>

<template>
  <div class="blog-index">
    <header class="blog-index__header">
      <h1 class="blog-index__title">文章</h1>
      <p class="blog-index__lead">財報指標、殖利率觀念等存股族實用知識，說明計算方式與常見誤區，不做個股推薦。</p>
    </header>

    <ul class="blog-index__list">
      <li v-for="post in posts" :key="post.slug" class="blog-index__item">
        <NuxtLink :to="`/blog/${post.slug}`" class="blog-index__link">
          <time class="blog-index__date" :datetime="post.publishedAt">{{ post.publishedAt }}</time>
          <h2 class="blog-index__item-title">{{ post.title }}</h2>
          <p class="blog-index__item-desc">{{ post.description }}</p>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.blog-index {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.blog-index__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.blog-index__title {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
}

.blog-index__lead {
  margin: 0;
  font-size: 18px;
  color: var(--el-text-color-secondary);
}

.blog-index__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.blog-index__link {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.3);
    transform: translateY(-2px);
  }
}

.blog-index__date {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.blog-index__item-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.blog-index__item-desc {
  margin: 0;
  font-size: 18px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
</style>
