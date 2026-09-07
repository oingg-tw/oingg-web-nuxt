<script setup lang="ts">
// Same standalone landing layout as index.vue (no app-shell sidebar/search bar) — a blog exists
// for SEO/public discovery, not as an in-app tool section, so it belongs on the public
// marketing track rather than AppPinnedSidebar's authenticated APP_FEATURES list.
definePageMeta({ layout: 'landing' })

// Migrated 2026-09-07 from a hand-written useBlogPosts.ts array to @nuxt/content's real
// content/blog/*.md collection (see content.config.ts) — a draft's frontmatter simply won't
// have status: 'published' yet, same "not in the array" exclusion the old hardcoded array gave
// for free, just backed by real files now instead of manual transcription.
const { data: posts } = await useAsyncData('blog-index', () =>
  queryCollection('blog')
    .where('status', '=', 'published')
    .order('date', 'DESC')
    .select('title', 'path', 'slug', 'date', 'meta_description')
    .all()
)

useSeoMeta({
  title: '文章列表 — 安盈選股',
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
        name: '安盈選股文章列表',
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
          <time class="blog-index__date" :datetime="post.date">{{ post.date }}</time>
          <h2 class="blog-index__item-title">{{ post.title }}</h2>
          <p class="blog-index__item-desc">{{ post.meta_description }}</p>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
// Redesigned 2026-09-07 per docs/0_researches/部落格頁面的設計如何打動人心使人閱讀愉悅.md
// (oingg-conductor-ts), scoped to blog/index.vue + blog/[slug].vue only, "大幅改版
// （Medium/Substack 風格）" tier confirmed directly: narrow the whole page to an editorial
// single-column measure instead of the app's usual wide grid, drop the card/shadow-list
// treatment for a plain kicker-date + large-title + excerpt list separated by hairlines.
// Never goes below the app's own 16px font floor even where the source report's own table
// suggests smaller (its 13-14px caption row) — that floor is a standing policy, not something
// this one page gets to override.
.blog-index {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.blog-index__header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-index__title {
  margin: 0;
  font-size: 40px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.blog-index__lead {
  margin: 0;
  font-size: 18px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.blog-index__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.blog-index__item {
  border-top: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
}

.blog-index__link {
  display: block;
  padding: 32px 4px;
  color: inherit;
  text-decoration: none;
}

.blog-index__date {
  display: block;
  font-size: 16px;
  letter-spacing: 0.06em;
  color: var(--el-text-color-placeholder);
  margin-bottom: 10px;
}

.blog-index__item-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.35;
  transition: color 0.15s ease;

  .blog-index__link:hover & {
    color: var(--el-color-primary);
  }
}

.blog-index__item-desc {
  margin: 10px 0 0;
  font-size: 18px;
  line-height: 1.7;
  letter-spacing: 0.02em;
  color: var(--el-text-color-secondary);
}
</style>
