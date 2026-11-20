<script setup lang="ts">
import type { BlogPostSummary } from '#shared/types/blog'
// Same standalone landing layout as index.vue (no app-shell sidebar/search bar) — a blog exists
// for SEO/public discovery, not as an in-app tool section, so it belongs on the public
// marketing track rather than AppPinnedSidebar's authenticated APP_FEATURES list.
definePageMeta({ layout: 'landing' })

// 文章在業務中台（2026-11-20 起，管理站寫、人按發布；原本是網站 repo 的 content/blog），經 /api/cached 讀，同 /changelog。
// 業務中台只回已發布的文章、新到舊。讀不到就整頁 503，同 /changelog：空的列表會被讀成「沒有文章」
const { data, error } = await useFetch<{ entries: BlogPostSummary[] }>('/api/cached/blog-posts', { key: 'blog-posts' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '文章列表暫時無法取得', fatal: true })
const posts = computed(() => data.value?.entries ?? [])
const categoryLabel = (post: BlogPostSummary): string | null => {
  const key = blogCategoryOf(post.category)
  return key ? BLOG_CATEGORIES[key] : null
}

// 主題（2026-11-19，使用者選「少數大主題」；欄名照詞彙表二之十一叫 category）：照 /changelog 的做法，篩選是連結（?category=），
// 伺服器就篩好，canonical 不帶查詢字串。只列有文章的主題，空的那類點了只會是空清單；有文章的主題不到兩類就不放這一排
const route = useRoute()
const category = computed(() => blogCategoryOf(route.query.category))
const shown = computed(() => posts.value.filter(post => !category.value || post.category === category.value))
const filters = computed(() => [
  { label: '全部', category: null },
  ...(Object.entries(BLOG_CATEGORIES) as [BlogCategory, string][])
    .filter(([key]) => posts.value.some(post => post.category === key))
    .map(([key, label]) => ({ label, category: key }))
])

useSeoMeta({
  // Brand suffix now comes from nuxt.config.ts's global `titleTemplate` (2026-09-19).
  title: '文章列表',
  description: '財報指標、殖利率觀念等存股族實用知識，用真實案例與計算方式說明，不做個股推薦。'
})

const requestUrl = useRequestURL()

useHead({
  link: [{ rel: 'canonical', href: `${requestUrl.origin}/blog` }],
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
      <nav v-if="filters.length > 2" class="blog-index__filters" aria-label="依主題篩選文章">
        <ul class="blog-index__filter-list">
          <li v-for="filter in filters" :key="filter.label">
            <NuxtLink
              :to="filter.category ? { path: '/blog', query: { category: filter.category } } : '/blog'"
              class="hub-chip"
              :aria-current="filter.category === category ? 'page' : undefined"
            >
              {{ filter.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </header>

    <ul class="blog-index__list">
      <li v-for="post in shown" :key="post.slug" class="blog-index__item">
        <NuxtLink :to="`/blog/${post.slug}`" class="blog-index__link">
          <span class="blog-index__date">
            <time :datetime="post.publishedAt">{{ taipeiDate(post.publishedAt) }}</time><template v-if="categoryLabel(post)">・<span class="blog-index__category">{{ categoryLabel(post) }}</span></template>
          </span>
          <h2 class="blog-index__item-title">{{ post.title }}</h2>
          <p v-if="post.description" class="blog-index__item-desc">{{ post.description }}</p>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Redesigned 2026-09-07 per docs/0_researches/部落格頁面的設計如何打動人心使人閱讀愉悅.md
   (oingg-conductor-ts), scoped to blog/index.vue + blog/[slug].vue only, "大幅改版
   （Medium/Substack 風格）" tier confirmed directly: narrow the whole page to an editorial
   single-column measure instead of the app's usual wide grid, drop the card/shadow-list
   treatment for a plain kicker-date + large-title + excerpt list separated by hairlines.
   Never goes below the app's own 16px font floor even where the source report's own table
   suggests smaller (its 13-14px caption row) — that floor is a standing policy, not something
   this one page gets to override. */
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
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.blog-index__lead {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.blog-index__filters {
  margin-top: 8px;
}

.blog-index__filter-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.blog-index__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.blog-index__item {
  border-top: 1px solid var(--app-divider);
}

.blog-index__item:last-child {
  border-bottom: 1px solid var(--app-divider);
}

.blog-index__link {
  display: block;
  padding: 32px 4px;
  color: inherit;
  text-decoration: none;
}

.blog-index__date {
  display: block;
  font-size: 1rem;
  letter-spacing: 0.06em;
  color: var(--el-text-color-placeholder);
  margin-bottom: 10px;
}

.blog-index__item-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.35;
  transition: color 0.15s ease;
}

.blog-index__link:hover .blog-index__item-title {
  color: var(--el-color-primary);
}

.blog-index__item-desc {
  margin: 10px 0 0;
  font-size: 1.125rem;
  line-height: 1.7;
  letter-spacing: 0.02em;
  color: var(--el-text-color-secondary);
}
</style>
