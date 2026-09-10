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

// 上一篇/下一篇 nav, added per direct request 2026-09-10. Content v3's replacement for v2's
// `queryContent().findSurround()` — a separate composable, `queryCollectionItemSurroundings`,
// not a chained method (confirmed against the current docs, not assumed from v2-era memory).
// It keys off Nuxt Content's own auto-generated `path`, not this app's `slug` frontmatter field
// (the field everything else — this route, the sitemap, preferred-stocks.vue's hardcoded link —
// keys off), so `path` only ever appears here as the query's own input; the template still
// links out through `slug` like every other blog link in this app. Ordered by `date` ASC
// (oldest → newest) specifically for this query, independent of blog/index.vue's own newest-
// first listing order — "上一篇"/"下一篇" at the bottom of an article conventionally means
// "published before this one" / "published after this one" in chronological reading order, not
// list-display order. `status` filtered the same way every other blog query in this app already
// is, so a draft never surfaces as a prev/next target even if it sits chronologically adjacent.
const { data: surround } = await useAsyncData(`blog-surround-${slug}`, () =>
  queryCollectionItemSurroundings('blog', post.value!.path, { fields: ['title', 'slug'] })
    .where('status', '=', 'published')
    .order('date', 'ASC')
)
const prevPost = computed(() => surround.value?.[0] ?? null)
const nextPost = computed(() => surround.value?.[1] ?? null)

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

    <nav v-if="prevPost || nextPost" class="blog-post__surround" aria-label="文章導覽">
      <NuxtLink v-if="prevPost" :to="`/blog/${prevPost.slug}`" class="blog-post__surround-link blog-post__surround-link--prev">
        <span class="blog-post__surround-label">← 上一篇</span>
        <span class="blog-post__surround-title">{{ prevPost.title }}</span>
      </NuxtLink>
      <NuxtLink v-if="nextPost" :to="`/blog/${nextPost.slug}`" class="blog-post__surround-link blog-post__surround-link--next">
        <span class="blog-post__surround-label">下一篇 →</span>
        <span class="blog-post__surround-title">{{ nextPost.title }}</span>
      </NuxtLink>
    </nav>
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

  // Real bug fixed 2026-09-10 (reported live: "表格有點壞掉") — this block never had any table
  // styling at all (no :deep(table)/(th)/(td) rules existed), so a real GFM table rendered by
  // ContentRenderer came through as a completely bare, unstyled browser-default <table> — no
  // borders, no column padding, no header emphasis — which reads as broken even though the
  // markdown itself parsed fine (confirmed live via curl: a real <table>/<thead>/<tbody>
  // structure was in the HTML output). Horizontally scrolls its own box rather than overflowing
  // the ~680px article measure, same overflow-x pattern this app already uses for wide content
  // elsewhere (e.g. GuruBadgeCard.vue's own formula box).
  :deep(table) {
    width: 100%;
    margin: 0 0 20px;
    border-collapse: collapse;
    font-size: 16px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
    display: block;
    overflow-x: auto;
  }

  :deep(th),
  :deep(td) {
    padding: 10px 16px;
    border: 1px solid var(--el-border-color-lighter);
    text-align: left;
    vertical-align: top;
  }

  :deep(th) {
    background: var(--el-fill-color-light);
    font-weight: 600;
    color: var(--el-text-color-primary);
    white-space: nowrap;
  }

  :deep(tr:nth-child(even)) {
    background: var(--el-fill-color-lighter);
  }
}

.blog-post__disclaimer {
  margin: 0;
  padding-top: 24px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

// 上一篇/下一篇 nav (2026-09-10). Two-column when both links exist; a lone link (first/last
// post in the collection, or the other side landed on an unpublished draft and got filtered
// out) still lands on its own natural side via margin-left/right: auto rather than stretching
// to fill the row — reads as "the one available direction," not a layout gap.
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
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  text-decoration: none;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--el-color-primary);
  }
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
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.blog-post__surround-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
