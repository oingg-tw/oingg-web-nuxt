<script setup lang="ts">
// 類股面向：月營收（2026-10-10 產業分析設計 #2；2026-10-21 起自成一頁）。合計營收年增率：上游用「當月與去年同月都有營收」的同一批公司相加後
// 算，避免新上市、下市讓年增率跳動。疊景氣同時指標與景氣收縮期（使用者在 /industries/cycle 選「B＋類股頁加景氣線」）
const industry = await useIndustry('revenue')
const { code, sectorName, data, noindex } = industry

const entries = computed(() => data.value?.revenueTrend?.entries ?? [])
const coincidentByMonth = computed(() => data.value?.businessCycle?.coincident ?? {})
const hasCycle = computed(() => Object.keys(coincidentByMonth.value).length > 0)
const coincidentText = (value: number | undefined) => (value === undefined ? '－' : value.toFixed(1))

const answer = computed(() => {
  const last = entries.value.at(-1)
  if (!last) return null
  const recent = entries.value.slice(-12)
  const positive = recent.filter(entry => (entry.yoyChangePct ?? 0) > 0).length
  return `${last.yearMonth} ${sectorName}合計營收比去年同月 ${industrySignedPct(last.yoyChangePct)}（${last.companyCount} 家兩年都有申報的公司）。最近 ${recent.length} 個月裡，有 ${positive} 個月年增率為正。`
})
</script>

<template>
  <IndustryPage :code="code" :sector-name="sectorName" facet="revenue" :description="answer" :noindex="noindex">
    <StockQuestionSection id="industry-revenue" :question="`${sectorName}的營收比去年多還是少？`" :answer="answer">
      <IndustryFacetChart v-if="data" :data="data" :sector-name="sectorName" facet="revenue" />
      <SharedTableScroll v-if="entries.length" :label="`${sectorName}合計月營收年增率`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ sectorName }}合計月營收年增率（兩年都有申報的同一批公司）<template v-if="hasCycle">與景氣同時指標</template>，新的在上</caption>
          <thead>
            <tr>
              <th scope="col">月份</th>
              <th scope="col" class="seo-table__num">年增率</th>
              <th scope="col" class="seo-table__num">公司家數</th>
              <th v-if="hasCycle" scope="col" class="seo-table__num">景氣同時指標</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in [...entries].reverse()" :key="entry.yearMonth">
              <th scope="row">{{ entry.yearMonth }}</th>
              <td class="seo-table__num">{{ industrySignedPct(entry.yoyChangePct) }}</td>
              <td class="seo-table__num">{{ entry.companyCount }}</td>
              <td v-if="hasCycle" class="seo-table__num">{{ coincidentText(coincidentByMonth[entry.yearMonth]) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p v-if="hasCycle" class="hub-answer">景氣同時指標是國家發展委員會公布的去趨勢值，100 代表長期趨勢；景氣收縮期是國發會認定的高峰到谷底。各類股的對照在<NuxtLink to="/industries/cycle" class="hub-inline-link">景氣敏感度</NuxtLink>。</p>
    </StockQuestionSection>
  </IndustryPage>
</template>
