<script setup lang="ts">
import type { BusinessCycleClockData, EquityRiskPremiumPageData, MacroPageData, MarketEventsPageData } from '#shared/types/hub'
import type { ClockZone } from '#shared/utils/business-cycle-clock'
// /macro — 總經特區的首頁。2026-10-21 重做（使用者：「macro 的設計也請修正 內容與sidebar是重複資訊」，選了「四項的最新數值」）：原本主體
// 是一張「指標｜這一頁呈現什麼」的表，四列就是側欄的四個連結；頁面說明還寫著 10/11 已經刪掉的「十項指標」。現在側欄管「去哪裡」，
// 這一頁答「現在是多少」：每一項最新一期的數字與資料時間，點名稱進那一頁。只寫數字、時間與 OECD／國發會自己的定義，不做推論（同
// 各頁的規則）。資料跟各頁同一支端點、同一個 key，點進去不用再抓一次。
const [{ data: events }, { data: clock }, { data: erp }, ...seriesFetches] = await Promise.all([
  useFetch<MarketEventsPageData>('/api/hub/macro-market-events', { key: 'hub-macro-market-events' }),
  useFetch<BusinessCycleClockData>('/api/hub/macro-business-cycle-clock', { key: 'hub-macro-business-cycle-clock' }),
  useFetch<EquityRiskPremiumPageData>('/api/hub/macro-equity-risk-premium', { key: 'hub-macro-equity-risk-premium' }),
  ...MACRO_PAGES.map(page => useFetch<MacroPageData>(`/api/hub/macro/${page.slug}`, { key: `hub-macro-${page.slug}` }))
])
// 全部讀不到才是整頁的 503（同其他 hub 頁，搜尋引擎要拿到暫時錯誤）；讀不到的那幾項自己寫「暫時無法取得」
if (!events.value && !clock.value && !erp.value && seriesFetches.every(fetch => !fetch.data.value)) {
  throw createError({ statusCode: 503, statusMessage: '總經資料暫時無法取得', fatal: true })
}

const { breadcrumbs } = useHubPageSeo({
  title: '台股總經特區：四項總經指標的最新數值',
  description: '大事件年表、景氣時鐘、股票風險溢酬與 10 年期公債殖利率四項指標的最新數值與資料時間，每一項另有逐期數據表並與加權股價指數畫在同一個時間軸上。',
  path: '/macro',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' }
  ]
})

// 資料時間寫在數值底下一行，不另開一欄：手機上三欄要左右捲（2026-10-21 量 375 寬，資料時間那欄在畫面外）
interface LatestRow {
  label: string
  to: string
  value: string
  date: string | null
}
const UNAVAILABLE = '暫時無法取得'
const fixed = (value: number, digits = 2) => value.toFixed(digits)
const pathOf = (prefix: string) => MACRO_NAV_ITEMS.find(item => item.to.startsWith(prefix))!

// 大盤：最新收盤與歷史最高收盤（大事件年表算下跌段用的同一份日收盤）
const marketRow = computed<LatestRow>(() => {
  const nav = pathOf('/macro/market-events')
  const days = events.value?.days ?? []
  const last = days.at(-1)
  if (!last) return { label: nav.label, to: nav.to, value: UNAVAILABLE, date: null }
  const peak = days.reduce((best, day) => (day.close > best.close ? day : best), last)
  const fromPeak = (last.close / peak.close - 1) * 100
  const value = peak.tradeDate === last.tradeDate
    ? `加權指數 ${groupThousands(fixed(last.close, 0))} 點，就是歷史最高收盤`
    : `加權指數 ${groupThousands(fixed(last.close, 0))} 點，比歷史最高收盤 ${groupThousands(fixed(peak.close, 0))} 點（${peak.tradeDate}）低 ${fixed(Math.abs(fromPeak), 1)}%`
  return { label: nav.label, to: nav.to, value, date: last.tradeDate }
})

// 景氣時鐘：領先、同時兩支各自的去趨勢值、比上個月的變動與所在區域（區域名稱是 OECD 那張圖的定義）
const clockRow = computed<LatestRow>(() => {
  const nav = pathOf('/macro/business-cycle-clock')
  const points = clock.value?.points ?? []
  const parts = ([['leading', '領先指標'], ['coincident', '同時指標']] as const).flatMap(([key, name]) => {
    const usable = points.filter(point => point[key] !== null)
    const [previous, latest] = usable.slice(-2)
    if (!previous || !latest) return []
    const level = latest[key]!
    const change = level - previous[key]!
    return [{ period: latest.period, zone: clockZone(level, change), text: `${name} ${fixed(level, 1)}（比上個月 ${change >= 0 ? '+' : '−'}${fixed(Math.abs(change), 1)}）` }]
  })
  if (!parts.length) return { label: nav.label, to: nav.to, value: UNAVAILABLE, date: null }
  const where = (zone: ClockZone) => `「${CLOCK_ZONES[zone].definition}」那一區（OECD 稱為${CLOCK_ZONES[zone].name}）`
  // 兩支落在同一區就合成一句，不然各自寫
  const value = parts.every(part => part.zone === parts[0]!.zone)
    ? `${parts.map(part => part.text).join('、')}，${parts.length > 1 ? '都' : ''}落在${where(parts[0]!.zone)}`
    : parts.map(part => `${part.text}落在${where(part.zone)}`).join('；')
  return { label: nav.label, to: nav.to, value, date: parts[0]!.period }
})

// 股票風險溢酬：完整窗口的兩種算法（各頁的第一列）
const erpRow = computed<LatestRow>(() => {
  const nav = pathOf('/macro/equity-risk-premium')
  const full = erp.value?.windows[0]
  if (!full || full.erpGeometric === null) return { label: nav.label, to: nav.to, value: UNAVAILABLE, date: null }
  const supply = full.supplySideErp === null ? '' : `、供給面模型 ${fixed(full.supplySideErp)}%`
  // 窗口的終點就是資料時間，句子裡只寫起點（每個數字只出現一次）
  return { label: nav.label, to: nav.to, value: `歷史法（幾何）${fixed(full.erpGeometric)}%${supply}（${full.windowStart} 起的完整窗口）`, date: full.windowEnd }
})

// 序列型的頁（目前是 10 年期公債殖利率）：最新一期有值的那一個月
const seriesRows = computed<LatestRow[]>(() => MACRO_PAGES.map((page, index) => {
  const spec = page.series[0]!
  const latest = [...(seriesFetches[index]?.data.value?.series ?? [])].reverse().find(point => point.values[spec.key] != null)
  const to = macroPagePath(page.slug)
  if (!latest) return { label: page.topic, to, value: UNAVAILABLE, date: null }
  return { label: page.topic, to, value: `${fixed(latest.values[spec.key]!, spec.decimals ?? 2)}${page.unit}`, date: latest.period }
}))

const rows = computed(() => [marketRow.value, clockRow.value, erpRow.value, ...seriesRows.value])
</script>

<template>
  <div class="app-page app-page--compact macro-index">
    <h1 class="app-page__title macro-index__title">台股總經特區</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <section class="stock-page-section" aria-labelledby="macro-index-heading">
      <h2 id="macro-index-heading" class="stock-page-section__title">總經指標現在是多少？</h2>
      <p class="hub-answer">
        四項指標各自最新一期的數字。更新頻率不同（大盤每個交易日，其他每月），資料時間以各列為準；點指標名稱看逐期數據與加權股價指數的對照。
      </p>
      <SharedTableScroll label="總經指標的最新數值">
        <table class="seo-table macro-index__table" data-ssr-table>
          <caption class="visually-hidden">總經特區四項指標的最新數值與資料時間</caption>
          <thead>
            <tr>
              <th scope="col">指標</th>
              <th scope="col">最新數值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.to">
              <th scope="row"><NuxtLink :to="row.to" class="seo-table__link">{{ row.label }}</NuxtLink></th>
              <td>
                {{ row.value }}
                <span v-if="row.date" class="macro-index__date">資料時間 {{ row.date }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer hub-sources">
        只呈現數字與時間，不對指標與股市的關係做任何推論。資料來源：臺灣證券交易所、國家發展委員會、中央銀行。
      </p>
    </section>
  </div>
</template>

<style scoped>
/* 兩欄都是會換行的句子：手機上不左右捲（指標名稱最長「10 年期公債殖利率」也可以折成兩行） */
.macro-index__table th,
.macro-index__table td {
  white-space: normal;
}

.macro-index__table tbody th {
  width: 6.5em;
}

/* 寬的時候指標名稱一行就放得下，不折 */
@media (min-width: 768px) {
  .macro-index__table tbody th {
    width: auto;
    white-space: nowrap;
  }
}

.macro-index__date {
  display: block;
  margin-top: 4px;
  color: var(--el-text-color-secondary);
}
</style>
