<script setup lang="ts">
import type { PreferredDividendRow } from '#shared/types/screener-detail'

// /preferred/dividends — 實際配息紀錄（2026-10-18）：每一檔近 8 年實際配發的股息（依除息日的年份加總），對照目前公告的每年股息。
// 股息會重設的特別股，過去配的跟現在公告的不同（2881A：2.46 元配到 2023 年，重設後 2.66、2.75 元）——這一頁就是讓讀者看得到這件事
const { entries } = await usePreferredZoneList()
const { data, error, refresh } = await useFetch<{ rows: PreferredDividendRow[] }>('/api/preferred/dividends', { key: 'preferred-zone-dividends' })
watchLoadFailure('preferred-zone-dividends', () => error.value, () => refresh())

const YEARS = 8
const thisYear = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric' }).format(new Date()))
const years = Array.from({ length: YEARS }, (_, i) => String(thisYear - YEARS + 1 + i))
const byYearOf = computed(() => new Map((data.value?.rows ?? []).map(row => [row.symbol, row.byYear])))
const cell = (symbol: string, year: string) => {
  const byYear = byYearOf.value.get(symbol)
  if (byYear === undefined) return ''
  if (byYear === null) return '讀不到'
  const amount = byYear[year]
  return amount === undefined ? '－' : preferredYuan(amount)
}

// 最近一次有配息的那一年，配發金額跟目前公告的每年股息不同的檔數（差超過 1 分錢才算）
const answer = computed(() => {
  if (!data.value) return null
  const differs = entries.value.filter((entry) => {
    const byYear = byYearOf.value.get(entry.symbol)
    if (!byYear || entry.dividendRate === null) return false
    const latestYear = Object.keys(byYear).sort().at(-1)
    return latestYear !== undefined && Math.abs(byYear[latestYear]! - entry.dividendRate) > 0.01
  })
  return `${entries.value.length} 檔中，${differs.length} 檔最近一年實際配發的金額跟目前公告的每年股息不同${differs.length ? `（${differs.map(entry => entry.symbol).join('、')}）` : ''}。表格裡「－」是那一年沒有除息紀錄，可能是還沒發行、當年沒有配發，或資料還沒涵蓋到。`
})
</script>

<template>
  <PreferredZonePage
    title="特別股實際配息紀錄"
    topic="實際配息紀錄"
    path="/preferred/dividends"
    seo-title="特別股實際配息紀錄：近 8 年每年配發的股息"
    description="台灣上市櫃特別股實際配息紀錄：每一檔近 8 年依除息年份加總的實際配發現金股息，對照目前公告的每年股息，看得出哪些特別股的股息有重設、哪一年沒有配發。"
  >
    <section class="stock-page-section" aria-labelledby="preferred-dividends-heading">
      <h2 id="preferred-dividends-heading" class="stock-page-section__title">實際配了多少？跟目前公告的股息一樣嗎？</h2>
      <p class="hub-answer">
        發行條件寫的每年股息不一定每年都一樣：有些特別股的股息每隔幾年會依利率重設，非累積型的特別股如果某一年沒有配發，之後也不補發。
        下表是各檔依除息日年份加總的實際配發金額。
      </p>
      <p v-if="answer" class="hub-answer">{{ answer }}</p>
      <SharedTableScroll v-if="entries.length" label="特別股實際配息紀錄">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">各檔特別股近 {{ YEARS }} 年依除息年份加總的實際配發現金股息，以及目前公告的每年股息</caption>
          <thead>
            <tr>
              <th scope="col">特別股</th>
              <th scope="col">目前每年股息</th>
              <th v-for="year in years" :key="year" scope="col">{{ year }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.symbol">
              <th scope="row"><NuxtLink :to="preferredStockPath(entry.symbol)">{{ entry.name }}</NuxtLink> {{ entry.symbol }}</th>
              <td class="seo-table__num">{{ preferredYuan(entry.dividendRate) }}</td>
              <td v-for="year in years" :key="year" class="seo-table__num">{{ cell(entry.symbol, year) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>
  </PreferredZonePage>
</template>
