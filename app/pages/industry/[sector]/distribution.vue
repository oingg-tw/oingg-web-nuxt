<script setup lang="ts">
// 類股面向：指標分布（2026-10-09 產業分析設計；2026-10-21 起自成一頁）。本益比、股價淨值比、殖利率、近四季 ROE 的 10／25／50／75／90
// 百分位：一張箱型圖＋一張表。只講類股的分布，不標公司名（合規上這一段講的是類股，不是成員之間比高下）
const industry = await useIndustry('distribution')
const { code, sectorName, data, rows, noindex } = industry

const distribution = computed(() => (data.value ? industryDistribution(data.value) : []))
const answer = computed(() => {
  const stats = data.value?.companies.stats
  if (!stats) return null
  const parts = [
    stats.peRatio.median !== null && `本益比中位數 ${stats.peRatio.median.toFixed(2)} 倍`,
    stats.dividendYield.median !== null && `殖利率中位數 ${stats.dividendYield.median.toFixed(2)}%`,
    stats.roe.median !== null && `近四季 ROE 中位數 ${stats.roe.median.toFixed(2)}%`
  ].filter(Boolean)
  return parts.length ? `${sectorName}有指標資料的 ${rows.value.length} 家公司：${parts.join('、')}。` : null
})
</script>

<template>
  <IndustryPage :code="code" :sector-name="sectorName" facet="distribution" :description="answer" :noindex="noindex">
    <StockQuestionSection id="industry-distribution" :question="`${sectorName}的本益比與殖利率分布如何？`" :answer="answer">
      <IndustryFacetChart v-if="data" :data="data" :sector-name="sectorName" facet="distribution" />
      <SharedTable v-if="distribution.length" :label="`${sectorName}各指標的分布`" :caption="`${sectorName}上市櫃公司的指標分布（10／25／50／75／90 百分位）`">
        <thead>
          <tr>
            <th scope="col">指標</th>
            <th scope="col" class="seo-table__num">有值家數</th>
            <th scope="col" class="seo-table__num">10%</th>
            <th scope="col" class="seo-table__num">25%</th>
            <th scope="col" class="seo-table__num">中位數</th>
            <th scope="col" class="seo-table__num">75%</th>
            <th scope="col" class="seo-table__num">90%</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in distribution" :key="item.label">
            <th scope="row">{{ item.label }}</th>
            <td class="seo-table__num">{{ item.stat.count }}</td>
            <td class="seo-table__num">{{ industryStat(item.stat.p10, item.unit) }}</td>
            <td class="seo-table__num">{{ industryStat(item.stat.q1, item.unit) }}</td>
            <td class="seo-table__num">{{ industryStat(item.stat.median, item.unit) }}</td>
            <td class="seo-table__num">{{ industryStat(item.stat.q3, item.unit) }}</td>
            <td class="seo-table__num">{{ industryStat(item.stat.p90, item.unit) }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p v-else class="hub-answer">有值的公司少於 5 家，不畫分布。</p>
      <!-- 殖利率的口徑（2026-10-24 改讀自算、沒配息算 0%，見 server/utils/hub-data.ts 的 sectorStats） -->
      <p v-if="distribution.some(item => item.label === '殖利率')" class="hub-answer">殖利率是近 12 個月已除息的現金股利除以最新收盤價；近 12 個月沒有配息紀錄的公司以 0% 計，所以殖利率的家數是全部公司。</p>
    </StockQuestionSection>
  </IndustryPage>
</template>
