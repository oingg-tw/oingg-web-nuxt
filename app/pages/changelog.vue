<script setup lang="ts">
// 更新紀錄（2026-10-29，使用者：「請設計版本更新頁面changelog」）：內容由管理站寫、業務中台存（使用者選的：維護公告要即時，不能等部署），
// 這裡經 /api/cached 讀。三種都收（網站功能、資料、維護公告），一次更新一段、最新在上；進行中的維護公告置頂。篩選是連結（?kind=），
// 伺服器就篩好，沒有 JS 也能用，canonical 不帶查詢字串。先只做這一頁，不加小紅點、橫幅（使用者選的）
const route = useRoute()
const requestUrl = useRequestURL()
const { data, error } = await useFetch<{ items: ReleaseNote[] }>('/api/cached/release-notes', { key: 'release-notes' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '更新紀錄暫時無法取得', fatal: true })

const kind = computed(() => releaseKindOf(route.query.kind))
const notes = computed(() => splitReleaseNotes(data.value?.items ?? [], kind.value))
const filters = [
  { label: '全部', kind: null },
  ...(Object.entries(RELEASE_KIND_LABELS) as [ReleaseKind, string][]).map(([key, label]) => ({ label, kind: key }))
]
const kindLabel = (value: string) => RELEASE_KIND_LABELS[value as ReleaseKind] ?? ''

useSeoMeta({
  title: '更新紀錄',
  description: '安盈選股最近改了什麼：依時間由新到舊列出網站功能、資料的更新與維護公告，進行中的維護公告列在最上面。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/changelog` }] })
</script>

<template>
  <div class="app-page changelog-page">
    <h1 class="app-page__title app-page__title--app">更新紀錄</h1>
    <p class="hub-answer">本站最近改了什麼？依時間由新到舊列出網站功能、資料的更新與維護公告。</p>

    <section v-if="notes.ongoing.length" class="changelog-page__section" aria-labelledby="changelog-ongoing">
      <h2 id="changelog-ongoing" class="app-page__h2">現在有哪些地方受影響？</h2>
      <ul class="changelog-page__changes">
        <li v-for="note in notes.ongoing" :key="note.id">
          <strong>{{ note.title }}</strong>（<time :datetime="note.startedAt ?? note.publishedAt">{{ taipeiDateTime(note.startedAt ?? note.publishedAt) }}</time> 起）
          <ul v-if="note.changes.length" class="changelog-page__changes">
            <li v-for="(change, index) in note.changes" :key="index">
              <NuxtLink v-if="sitePath(change.path)" :to="sitePath(change.path)!" class="hub-inline-link">{{ change.text }}</NuxtLink>
              <template v-else>{{ change.text }}</template>
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <nav class="changelog-page__filters" aria-label="依種類篩選更新紀錄">
      <span class="changelog-page__filters-label" aria-hidden="true">顯示：</span>
      <ul class="changelog-page__filter-list">
        <li v-for="filter in filters" :key="filter.label">
          <NuxtLink
            :to="filter.kind ? { path: '/changelog', query: { kind: filter.kind } } : '/changelog'"
            class="changelog-page__filter"
            :aria-current="filter.kind === kind ? 'page' : undefined"
          >
            {{ filter.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <ol v-if="notes.timeline.length" class="changelog-page__list">
      <li v-for="note in notes.timeline" :key="note.id">
        <article :id="`note-${note.id}`" class="changelog-page__section" :aria-labelledby="`note-${note.id}-title`">
          <h2 :id="`note-${note.id}-title`" class="app-page__h2">
            <time :datetime="note.publishedAt">{{ taipeiDate(note.publishedAt) }}</time>　{{ note.title }}
          </h2>
          <p class="changelog-page__meta">
            {{ kindLabel(note.kind) }}<template v-if="note.kind === 'maintenance' && note.endedAt">{{ kindLabel(note.kind) ? '，' : '' }}已恢復：<time :datetime="note.endedAt">{{ taipeiDateTime(note.endedAt) }}</time></template>
          </p>
          <ul v-if="note.changes.length" class="changelog-page__changes">
            <li v-for="(change, index) in note.changes" :key="index">
              <span v-if="RELEASE_CATEGORY_LABELS[change.category]" class="changelog-page__category">{{ RELEASE_CATEGORY_LABELS[change.category] }}</span>
              <NuxtLink v-if="sitePath(change.path)" :to="sitePath(change.path)!" class="hub-inline-link">{{ change.text }}</NuxtLink>
              <template v-else>{{ change.text }}</template>
            </li>
          </ul>
        </article>
      </li>
    </ol>
    <p v-else class="hub-answer">{{ kind ? `目前還沒有「${RELEASE_KIND_LABELS[kind]}」的更新紀錄。` : '目前還沒有更新紀錄。' }}</p>
  </div>
</template>

<style scoped>
.changelog-page__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.changelog-page__meta,
.changelog-page__changes {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.changelog-page__changes {
  padding-left: 1.5em;
}

.changelog-page__changes li + li {
  margin-top: 4px;
}

.changelog-page__category {
  margin-right: 0.5em;
  font-weight: 600;
}

.changelog-page__list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.changelog-page__list > li + li {
  padding-top: 24px;
  border-top: 1px solid var(--app-divider);
}

.changelog-page__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.changelog-page__filter-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.changelog-page__filter {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--app-surface-border);
  border-radius: 999px;
  color: var(--el-text-color-regular);
  text-decoration: none;
}

.changelog-page__filter:hover {
  color: var(--el-color-primary-dark-2);
}

.changelog-page__filter[aria-current='page'] {
  border-color: var(--el-color-primary-dark-2);
  color: var(--el-color-primary-dark-2);
  font-weight: 600;
}
</style>
