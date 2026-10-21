<script setup lang="ts">
// 類股面向：月營收（2026-10-10 產業分析設計 #2；2026-10-21 起自成一頁）。合計營收年增率：上游用「當月與去年同月都有營收」的同一批公司相加
// 後算，避免新上市、下市讓年增率跳動。圖是近三個月累計年增率的柱＋景氣收縮期灰底（2026-10-21 使用者選「A」，理由見 IndustryFacetChart）；
// 表格同時列近三個月累計、單月與景氣同時指標
const industry = await useIndustry('revenue')
const { code, sectorName, data, noindex } = industry

const entries = computed(() => data.value?.revenueTrend?.entries ?? [])
const yoy3m = computed(() => data.value?.revenueYoy3m ?? {})
const coincidentByMonth = computed(() => data.value?.businessCycle?.coincident ?? {})
const hasCycle = computed(() => Object.keys(coincidentByMonth.value).length > 0)
const coincidentText = (value: number | undefined) => (value === undefined ? '－' : value.toFixed(1))

// 答句講圖上畫的那個數字（近三個月累計）；最近 12 個月裡幾個月是紅柱
const answer = computed(() => {
  const months = Object.keys(yoy3m.value).sort()
  const latest = months.at(-1)
  const companies = entries.value.at(-1)?.companyCount
  if (!latest) return null
  const recent = months.slice(-12)
  const growing = recent.filter(month => (yoy3m.value[month] ?? 0) > 0).length
  return `${latest} ${sectorName}近三個月合計營收比去年同期 ${industrySignedPct(yoy3m.value[latest] ?? null)}${companies ? `（${companies} 家兩年都有申報的公司）` : ''}。最近 ${recent.length} 個月裡，有 ${growing} 個月是成長。`
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
              <th scope="col" class="seo-table__num">近三個月累計年增率</th>
              <th scope="col" class="seo-table__num">單月年增率</th>
              <th scope="col" class="seo-table__num">公司家數</th>
              <th v-if="hasCycle" scope="col" class="seo-table__num">景氣同時指標</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in [...entries].reverse()" :key="entry.yearMonth">
              <th scope="row">{{ entry.yearMonth }}</th>
              <td class="seo-table__num">{{ industrySignedPct(yoy3m[entry.yearMonth] ?? null) }}</td>
              <td class="seo-table__num">{{ industrySignedPct(entry.yoyChangePct) }}</td>
              <td class="seo-table__num">{{ entry.companyCount }}</td>
              <td v-if="hasCycle" class="seo-table__num">{{ coincidentText(coincidentByMonth[entry.yearMonth]) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer">近三個月累計年增率是這三個月的營收加總比去年同三個月，農曆年落在一月或二月造成的單月起落會被攤平；單月年增率是當月比去年同月。</p>
      <p v-if="hasCycle" class="hub-answer">灰底是國家發展委員會認定的景氣收縮期（高峰到谷底）；景氣同時指標是國發會公布的去趨勢值，100 代表長期趨勢。各類股的對照在<NuxtLink to="/industries/cycle" class="hub-inline-link">景氣敏感度</NuxtLink>。</p>
    </StockQuestionSection>
  </IndustryPage>
</template>
