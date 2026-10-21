<script setup lang="ts">
// 類股面向：獲利能力（2026-10-10 產業分析設計 #3；2026-10-21 起自成一頁）。三率中位數（近四季）：毛利率、營業利益率、稅後淨利率各自一次
// 類股中位數逐期（industryMarginRows）
const industry = await useIndustry('margins')
const { code, sectorName, data, noindex } = industry

const marginRows = computed(() => (data.value ? industryMarginRows(data.value) : []))
const answer = computed(() => {
  const last = marginRows.value.at(-1)
  if (!last) return null
  return `${last.fiscalYear} Q${last.fiscalQuarter}（近四季），${sectorName}有值的 ${last.count} 家公司：毛利率中位數 ${industryPct(last.values.grossMargin?.value)}、營業利益率中位數 ${industryPct(last.values.operatingMargin?.value)}、稅後淨利率中位數 ${industryPct(last.values.netProfitMargin?.value)}。`
})
</script>

<template>
  <IndustryPage :code="code" :sector-name="sectorName" facet="margins" :description="answer" :noindex="noindex">
    <StockQuestionSection id="industry-margins" :question="`${sectorName}的獲利能力這幾年怎麼走？`" :answer="answer">
      <IndustryFacetChart v-if="data" :data="data" :sector-name="sectorName" facet="margins" />
      <SharedTableScroll v-if="marginRows.length" :label="`${sectorName}三率中位數逐季`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ sectorName }}三率中位數（近四季），新的在上</caption>
          <thead>
            <tr>
              <th scope="col">期別</th>
              <th scope="col" class="seo-table__num">毛利率</th>
              <th scope="col" class="seo-table__num">營業利益率</th>
              <th scope="col" class="seo-table__num">稅後淨利率</th>
              <th scope="col" class="seo-table__num">有值家數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in [...marginRows].reverse()" :key="`${row.fiscalYear}-${row.fiscalQuarter}`">
              <th scope="row">{{ row.fiscalYear }} Q{{ row.fiscalQuarter }}</th>
              <td class="seo-table__num">{{ industryPct(row.values.grossMargin?.value) }}</td>
              <td class="seo-table__num">{{ industryPct(row.values.operatingMargin?.value) }}</td>
              <td class="seo-table__num">{{ industryPct(row.values.netProfitMargin?.value) }}</td>
              <td class="seo-table__num">{{ row.count }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </StockQuestionSection>
  </IndustryPage>
</template>
