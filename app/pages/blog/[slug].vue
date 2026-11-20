<script setup lang="ts">
import type { BlogPost, BlogPostSummary } from '#shared/types/blog'
definePageMeta({ layout: 'landing' })

const route = useRoute()
const slug = String(route.params.slug)

// 文章在業務中台（2026-11-20 起，原本是網站 repo 的 content/blog），經 /api/cached 讀，同 /changelog。草稿、排程中、下架、不存在的
// 業務中台都回 404，網址代號格式不對的 /api/cached 自己就 404，所以兩種都是這一頁的 404；其他讀取失敗是 503，不把文章說成不存在
const [{ data: post, error }, { data: list }] = await Promise.all([
  useFetch<BlogPost>(`/api/cached/blog-posts/${slug}`, { key: `blog-post-${slug}` }),
  // 上一篇／下一篇（2026-09-10）從列表算，跟 /blog 同一份快取；列表讀不到就不放這一段，文章照常
  useFetch<{ entries: BlogPostSummary[] }>('/api/cached/blog-posts', { key: 'blog-posts' })
])
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: '找不到這篇文章', fatal: true })
if (error.value || !post.value) throw createError({ statusCode: 503, statusMessage: '文章暫時無法取得', fatal: true })

// 列表是新到舊：上一篇是早一點發布的那篇，下一篇是晚一點的
const position = computed(() => list.value?.entries.findIndex(entry => entry.slug === slug) ?? -1)
const prevPost = computed(() => (position.value >= 0 ? list.value!.entries[position.value + 1] ?? null : null))
const nextPost = computed(() => (position.value > 0 ? list.value!.entries[position.value - 1] ?? null : null))
const category = computed(() => blogCategoryOf(post.value?.category))

useSeoMeta({
  // Brand suffix now comes from nuxt.config.ts's global `titleTemplate` (2026-09-19).
  title: post.value.title,
  description: post.value.description ?? undefined
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
        description: post.value.description ?? undefined,
        datePublished: post.value.publishedAt,
        dateModified: post.value.updatedAt,
        author: post.value.authorName ? { '@type': 'Person', name: post.value.authorName } : { '@type': 'Organization', name: '安盈選股' },
        articleSection: category.value ? BLOG_CATEGORIES[category.value] : undefined,
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
      <!-- 主題連回列表的那一類（2026-11-19） -->
      <p class="blog-post__date">
        <time :datetime="post.publishedAt">{{ taipeiDate(post.publishedAt) }}</time><template v-if="category">・<NuxtLink :to="{ path: '/blog', query: { category } }" class="hub-inline-link blog-post__category">{{ BLOG_CATEGORIES[category] }}</NuxtLink></template>
      </p>
    </header>

    <!-- 業務中台轉好、跳脫過的 HTML（標籤白名單見 BlogPost.bodyHtml） -->
    <div class="blog-post__body" v-html="post.bodyHtml" />

    <p class="blog-post__disclaimer">
      本文僅為財經知識說明，不構成任何有價證券之買賣建議或獲利保證，實際投資決策請自行判斷並審慎評估風險。
    </p>

    <nav v-if="prevPost || nextPost" class="blog-post__surround" aria-label="文章導覽">
      <NuxtLink v-if="prevPost" :to="`/blog/${prevPost.slug}`" class="app-card blog-post__surround-link blog-post__surround-link--prev">
        <span class="blog-post__surround-label">← 上一篇</span>
        <span class="blog-post__surround-title">{{ prevPost.title }}</span>
      </NuxtLink>
      <NuxtLink v-if="nextPost" :to="`/blog/${nextPost.slug}`" class="app-card blog-post__surround-link blog-post__surround-link--next">
        <span class="blog-post__surround-label">下一篇 →</span>
        <span class="blog-post__surround-title">{{ nextPost.title }}</span>
      </NuxtLink>
    </nav>
  </article>
</template>

<style scoped>
/* Redesigned 2026-09-07 per docs/0_researches/部落格頁面的設計如何打動人心使人閱讀愉悅.md
   (oingg-conductor-ts), "大幅改版（Medium/Substack 風格）" tier confirmed directly, scoped to
   this page + blog/index.vue only. Narrows the whole article to a ~680px editorial measure
   (report's own CJK-line-length guidance: 30–40 漢字/行), bumps H1/H2/H3 up a tier and gives
   headings an asymmetric vertical rhythm (top margin ~2.3x the bottom margin, so a heading
   visually belongs to the section below it rather than sitting equidistant between two — the
   report's own "鄰近性原則" point) instead of the old uniform flex `gap`. Never drops any text
   below the app's own 16px font floor even where the source report's own table would (its
   13–14px caption row) — that floor is a standing policy, not something this page overrides. */
.blog-post {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.blog-post__back {
  align-self: flex-start;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  text-decoration: none;
}

.blog-post__back:hover {
  color: var(--el-color-primary);
}

.blog-post__header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-post__title {
  margin: 0;
  font-size: 2.375rem;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.blog-post__date {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

/* The body is 業務中台's bodyHtml（2026-11-20; ContentRenderer before）: plain h2–h4/p/ul/ol/strong/a/blockquote/table/pre elements. */
.blog-post__body :deep(h2) {
  margin: 56px 0 20px;
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.3;
}

.blog-post__body :deep(h2):first-child {
  margin-top: 0;
}

.blog-post__body :deep(h3) {
  margin: 40px 0 16px;
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.4;
}

.blog-post__body :deep(p) {
  margin: 0 0 20px;
  font-size: 1.125rem;
  line-height: 1.75;
  letter-spacing: 0.02em;
  color: var(--el-text-color-secondary);
}

.blog-post__body :deep(p):last-child {
  margin-bottom: 0;
}

.blog-post__body :deep(ul),
.blog-post__body :deep(ol) {
  margin: 0 0 20px;
  padding-left: 24px;
  font-size: 1.125rem;
  line-height: 1.75;
  letter-spacing: 0.02em;
  color: var(--el-text-color-secondary);
}

.blog-post__body :deep(li) {
  margin: 6px 0;
}

.blog-post__body :deep(strong) {
  color: var(--el-text-color-primary);
  font-weight: 700;
}

.blog-post__body :deep(a) {
  color: var(--el-color-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--el-color-primary-light-5);
}

.blog-post__body :deep(hr) {
  margin: 8px 0;
  border: none;
  border-top: 1px solid var(--app-divider);
}

/* Real bug fixed 2026-09-10 (reported live: "表格有點壞掉") — this block never had any table
   styling at all (no :deep(table)/(th)/(td) rules existed), so a real GFM table in the
   article body came through as a completely bare, unstyled browser-default <table> — no
   borders, no column padding, no header emphasis — which reads as broken even though the
   markdown itself parsed fine (confirmed live via curl: a real <table>/<thead>/<tbody>
   structure was in the HTML output). Horizontally scrolls its own box rather than overflowing
   the ~680px article measure, same overflow-x pattern this app already uses for wide content
   elsewhere (e.g. GuruBadgeCard.vue's own formula box). */
.blog-post__body :deep(table) {
  width: 100%;
  margin: 0 0 20px;
  border-collapse: collapse;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  display: block;
  overflow-x: auto;
}

.blog-post__body :deep(th),
.blog-post__body :deep(td) {
  padding: 10px 16px;
  border: 1px solid var(--el-border-color-lighter);
  text-align: left;
  vertical-align: top;
}

.blog-post__body :deep(th) {
  background: var(--app-table-head-bg);
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.blog-post__body :deep(tr:nth-child(even)) {
  background: var(--el-fill-color-lighter);
}


.blog-post__disclaimer {
  margin: 0;
  padding-top: 24px;
  border-top: 1px solid var(--app-divider);
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

/* 上一篇/下一篇 nav (2026-09-10). Two-column when both links exist; a lone link (first/last
   post in the collection, or the other side landed on an unpublished draft and got filtered
   out) still lands on its own natural side via margin-left/right: auto rather than stretching
   to fill the row — reads as "the one available direction," not a layout gap. */
.blog-post__surround {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.blog-post__surround-link {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 320px;
  padding: 16px;
  text-decoration: none;
  transition: border-color 0.2s ease;
}

.blog-post__surround-link:hover {
  border-color: var(--el-color-primary);
}

.blog-post__surround-link--prev {
  margin-right: auto;
  text-align: left;
}

.blog-post__surround-link--next {
  margin-left: auto;
  text-align: right;
}

.blog-post__surround-label {
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

.blog-post__surround-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
