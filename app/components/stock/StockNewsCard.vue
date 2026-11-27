<script setup lang="ts">
import type { StockNewsResponse } from '#shared/types/stock-news'

// 指標速覽的「近期新聞」卡片（2026-11-16，使用者：「重新安排 預設的 指標速覽 要把新聞放進去」；看過覆蓋率——全市場均勻抽 80 檔只有
// 6% 有新聞——選「先不放預設，只做成可以釘」）：最新 5 則的標題、來源與時間，寫法同新聞頁（stockNewsGroups、stockNewsAgo、websiteHref、
// 小箭頭與藏起來的「另開新視窗」）。跟圖表卡的骨架一樣高：桌機兩欄時不把同一列撐高，載入、沒有新聞、簡稱不比對都不會跳；標題一行、
// 太長結尾「…」，完整的在新聞頁。data-nosnippet：新聞頁不給收錄（使用者：「不收錄 noindex」），速覽頁會被收錄，標題不讓搜尋結果的摘要引用
const props = defineProps<{
  news: StockNewsResponse | null
  loading: boolean
  shortName: string
  // 伺服器算的台北日期（useState 'taipei-today'），今天／昨天跟新聞頁一致
  today: string
}>()
defineSlots<{ header: () => unknown }>()

const SHOWN = 5
const dayText = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`
const items = computed(() => stockNewsGroups(props.news?.articles ?? [], props.today)
  .flatMap(group => group.items.map(item => ({ ...item, day: group.prefix || dayText(group.day) })))
  .slice(0, SHOWN))
// 幾分鐘前要讀者看的時刻，掛上之後才算（同新聞頁）
const now = ref<number | null>(null)
onMounted(() => { now.value = Date.now() })
</script>

<template>
  <SharedChartCard>
    <template #header><slot name="header" /></template>
    <div v-if="news" class="news-card" data-nosnippet>
      <p v-if="news.isNameSearchable === false" class="news-card__empty">{{ shortName }}的簡稱沒辦法從新聞標題比對，這裡不列新聞。</p>
      <p v-else-if="!items.length" class="news-card__empty">目前沒有{{ shortName }}的新聞。</p>
      <template v-else>
        <p class="news-card__hint">點標題到原網站看全文，另開新視窗</p>
        <ul class="news-card__list">
          <li v-for="item in items" :key="item.link" class="news-card__item">
            <a v-if="websiteHref(item.link)" :href="websiteHref(item.link)" target="_blank" rel="noopener" class="news-card__title">
              <span class="news-card__text">{{ item.title }}</span><svg class="news-card__arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg><span class="visually-hidden">（另開新視窗）</span>
            </a>
            <span v-else class="news-card__title"><span class="news-card__text">{{ item.title }}</span></span>
            <span class="news-card__meta">{{ item.source }}・<time :datetime="item.publishedAt">{{ item.day }} {{ item.time }}</time>{{ now === null ? '' : stockNewsAgo(item.publishedAt, now) }}</span>
          </li>
        </ul>
      </template>
    </div>
    <div v-else-if="loading" class="news-card app-skeleton" aria-hidden="true" />
  </SharedChartCard>
</template>

<style scoped>
/* 新聞卡的最小高度：窄的時候 44＋8＋320，520 起 32＋8＋320。指標速覽給這張卡片的佔位預設照這兩個數字（pages/stock/[code]/index.vue 的 BODY_DEFAULTS），改這裡要一起改 */
.news-card {
  display: flex;
  flex-direction: column;
  min-height: calc(44px + 8px + 320px);
}

@container (min-width: 520px) {
  .news-card {
    min-height: calc(32px + 8px + 320px);
  }
}

.news-card__empty {
  margin: 0;
  color: var(--el-text-color-regular);
}

.news-card__hint,
.news-card__meta {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.news-card__hint {
  margin: 0 0 4px;
}

.news-card__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 5 則各兩行（標題、來源與時間），520 起合計約 343px，放得進圖表卡的 360px */
.news-card__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 8px 0;
}

.news-card__item + .news-card__item {
  border-top: 1px solid var(--app-divider);
}

/* 標題一行，太長結尾「…」；小箭頭在外面，截斷時照樣看得到 */
.news-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--el-color-primary-dark-2);
  text-decoration: none;
}

a.news-card__title:hover .news-card__text,
a.news-card__title:focus-visible .news-card__text {
  text-decoration: underline;
}

.news-card__text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.news-card__arrow {
  flex: none;
  width: 0.875em;
  height: 0.875em;
}

.news-card__meta {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
