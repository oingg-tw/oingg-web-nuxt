<script setup lang="ts">
// 特別股個別頁：實際配息紀錄（2026-10-18）。依除息日的年份加總的實際配發現金股息，對照目前公告的每年股息。股息會重設的特別股，過去配的
// 跟現在公告的不同（2881A：2.46 元配到 2023 年，重設後 2.66、2.75 元）。圖在前、SSR 表格在後
const preferred = await usePreferredStock()
const { code, data, entry, shortName } = preferred

const YEARS = 8
const thisYear = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric' }).format(new Date()))
const byYear = computed(() => data.value?.dividendsByYear ?? null)
// 從第一筆除息紀錄那年（最多往前 8 年）排到今年；沒有任何紀錄時是空的
const years = computed(() => {
  const recorded = Object.keys(byYear.value ?? {}).sort()
  if (!recorded.length) return []
  const first = Math.max(Number(recorded[0]), thisYear - YEARS + 1)
  return Array.from({ length: thisYear - first + 1 }, (_, i) => {
    const year = String(first + i)
    return { year, amount: byYear.value?.[year] ?? null }
  })
})

const answer = computed(() => {
  const stockEntry = entry.value
  if (!stockEntry || byYear.value === null) return null
  const paid = years.value.filter(row => row.amount !== null)
  const latest = paid.at(-1)
  if (!latest) return `${shortName.value}（${code.value}）目前沒有除息紀錄；目前公告的每年股息 ${preferredYuan(stockEntry.dividendRate)}。`
  const same = stockEntry.dividendRate !== null && Math.abs(latest.amount! - stockEntry.dividendRate) <= 0.01
  return `${shortName.value}（${code.value}）最近一次配發在 ${latest.year} 年，合計 ${preferredYuan(latest.amount)}，${same ? '跟' : '不同於'}目前公告的每年股息 ${preferredYuan(stockEntry.dividendRate)}；近 ${years.value.length} 年中有 ${paid.length} 年有除息紀錄。`
})
</script>

<template>
  <PreferredStockPage :preferred="preferred" topic="實際配息紀錄" :description="answer">
    <StockQuestionSection id="preferred-dividends" :question="`${shortName}（${code}）實際配了多少？跟目前公告的股息一樣嗎？`" :answer="answer">
      <template v-if="years.length">
        <PreferredDividendChart :years="years" :dividend-rate="entry?.dividendRate ?? null" :short-name="shortName" />
        <SharedTableScroll :label="`${shortName}每年實際配發的股息`">
          <table class="seo-table" data-ssr-table>
            <caption class="visually-hidden">{{ shortName }} {{ code }} 依除息年份加總的實際配發現金股息（新的在上）</caption>
            <thead>
              <tr>
                <th scope="col">年份</th>
                <th scope="col" class="seo-table__num">實際配發</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in [...years].reverse()" :key="row.year">
                <th scope="row">{{ row.year }} 年</th>
                <td class="seo-table__num">{{ row.amount === null ? '沒有除息紀錄' : preferredYuan(row.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </template>
      <p class="hub-answer">
        發行條件寫的每年股息不一定每年都一樣：有些特別股的股息每隔幾年會依利率重設；非累積型的特別股如果某一年沒有配發，之後也不補發。
        「沒有除息紀錄」可能是還沒發行、當年沒有配發，或資料還沒涵蓋到。
      </p>
    </StockQuestionSection>
  </PreferredStockPage>
</template>
