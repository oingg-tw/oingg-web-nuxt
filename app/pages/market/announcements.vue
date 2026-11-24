<script setup lang="ts">
import type { MaterialAnnouncement } from '#shared/types/material-announcements'

// 全市場最新重大訊息（2026-11-24，使用者選「做一頁」；數據中台 /market/material-announcements，業務中台轉發）：上市、上櫃、興櫃公司最近
// 50 則，依發言時間新到舊，清單同個股重大訊息頁（SharedAnnouncementList），每則多寫公司名稱、全文底下連到那家公司的重大訊息頁
type MarketAnnouncement = Omit<MaterialAnnouncement, 'market'> & { symbol: string; companyName: string | null }

const { data, error, refresh } = await useFetch<{ items: MarketAnnouncement[] }>('/api/cached/market/material-announcements', { query: { limit: MARKET_LIST_LIMIT }, key: 'market-material-announcements' })
watchLoadFailure('market-material-announcements', () => error.value, refresh)

const today = useState('taipei-today', () => holdingsTaipeiDate())
const groups = computed(() => announcementGroups(data.value?.items ?? [], today.value)
  .map(group => ({ ...group, label: `${group.prefix ? `${group.prefix} ` : ''}${shortDayLabel(group.day)}` })))
const count = computed(() => data.value?.items.length ?? 0)
const answer = computed(() => {
  const first = groups.value[0]
  const latest = first?.items[0]
  if (!data.value) return ''
  if (!first || !latest) return '最近沒有重大訊息。'
  const negatives = groups.value.flatMap(group => group.items).flatMap(item => negativeEventLabel(item.negativeEvent) ?? [])
  const negative = negatives.length ? `其中 ${negatives.length} 則是負面事件（${[...new Set(negatives)].join('、')}）。` : ''
  return `最新一則是${latest.companyName ?? latest.symbol}在 ${first.prefix || shortDayLabel(first.day)}${latest.time ? ` ${latest.time}` : ''} 發布的。${negative}`
})

const breadcrumbs = [
  { label: '首頁', to: '/' },
  { label: '最新重大訊息', to: '/market/announcements' }
]
useHubPageSeo({
  title: '台股最新重大訊息：上市櫃與興櫃公司公告',
  description: () => clampDescription(`全市場上市、上櫃、興櫃公司最新的 ${count.value} 則重大訊息，依發言時間由新到舊，點開看公告全文。${answer.value}資料取自公開資訊觀測站。`),
  path: '/market/announcements',
  breadcrumbs
})
const GUIDE = [
  '重大訊息取自公開資訊觀測站，上市、上櫃、興櫃都有；公開資訊觀測站還沒收進來的最近幾天，上市的取自臺灣證券交易所、上櫃的取自證券櫃檯買賣中心，所以今天發布的公告最快明天才會出現在這裡。',
  `標成負面事件的有八種：${Object.values(NEGATIVE_EVENT_LABELS).join('、')}，由公開資訊觀測站依公告內容分類；沒有標的公告不代表沒有影響。`,
  '這裡列全市場最近 50 則，依發言時間由新到舊；每則點開是全文，原文照錄，底下可以連到那家公司全部的重大訊息。正式內容以公開資訊觀測站為準。'
]
</script>

<template>
  <div class="app-page app-page--compact">
    <h1 class="app-page__title">最新重大訊息</h1>
    <StockBreadcrumb :items="breadcrumbs" />

    <section class="stock-page-section" aria-labelledby="market-announcements-heading">
      <h2 id="market-announcements-heading" class="stock-page-section__title">上市櫃與興櫃公司最近發布了哪些重大訊息？</h2>
      <p class="hub-answer">{{ answer }}</p>
      <SharedAnnouncementList v-if="data" :groups="groups" :title="`最新重大訊息・${count} 則`" empty-text="最近沒有重大訊息" />
      <p class="hub-answer hub-sources">
        資料來源：公開資訊觀測站；最近幾天取自臺灣證券交易所、證券櫃檯買賣中心的開放資料（<a href="https://data.gov.tw/license" target="_blank" rel="noopener noreferrer" class="hub-inline-link">政府資料開放授權條款第 1 版（另開新視窗）</a>）。
      </p>
    </section>

    <StockMetricGuide id-prefix="market-announcements" topic="最新重大訊息" definition-question="這些重大訊息怎麼來的？" :definition="GUIDE" />
  </div>
</template>
