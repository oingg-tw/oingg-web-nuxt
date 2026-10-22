<script setup lang="ts">
// ETF 面向：折溢價（2026-10-18 第二批）。每日的折溢價（市價對淨值）彙總成每月的平均、最高、最低（伺服器端 cachedEtfPremiumMonths）。
// 不畫淨值走勢：上游每日淨值沒有還原分割（0050 2025-06 一拆四會斷崖）；折溢價是同一天的市價對淨值，不受影響
const etfData = await useEtf()
const { code, data, num, shortName } = etfData

const months = computed(() => [...(data.value?.premium ?? [])].reverse())
const signed = (value: number | null) => (value === null ? '－' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`)

const answer = computed(() => {
  const latest = months.value[0]
  if (!latest) return null
  const today = num('premiumDiscountPct')
  const [year, month] = latest.month.split('-')
  const lastYear = months.value.slice(0, 12)
  const highest = Math.max(...lastYear.map(row => row.highest))
  const lowest = Math.min(...lastYear.map(row => row.lowest))
  return `${shortName.value}（${code.value}）${today !== null ? `最新折溢價 ${signed(today)}；` : ''}${year} 年 ${Number(month)} 月平均 ${signed(latest.average)}，近 ${lastYear.length} 個月單日最高 ${signed(highest)}、最低 ${signed(lowest)}。`
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="premium" :description="answer">
    <StockQuestionSection id="etf-premium" :question="`${shortName}（${code}）的市價比淨值高還是低？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="premium" />
      <SharedTable v-if="months.length" :label="`${shortName}每月折溢價`" :caption="`${shortName} ${code} 每月折溢價的平均、單日最高與最低（新的在上）`">
        <thead>
          <tr>
            <th scope="col">月份</th>
            <th scope="col" class="seo-table__num">平均</th>
            <th scope="col" class="seo-table__num">單日最高</th>
            <th scope="col" class="seo-table__num">單日最低</th>
            <th scope="col" class="seo-table__num">有成交的日數</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in months" :key="row.month">
            <th scope="row">{{ row.month }}</th>
            <td class="seo-table__num">{{ signed(row.average) }}</td>
            <td class="seo-table__num">{{ signed(row.highest) }}</td>
            <td class="seo-table__num">{{ signed(row.lowest) }}</td>
            <td class="seo-table__num">{{ row.tradingDays }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">折溢價 ＝（收盤價 − 淨值）÷ 淨值。正的是溢價（市價高於淨值），負的是折價。淨值來自基金資訊觀測站，沒有成交的日子不算。</p>
    </StockQuestionSection>
  </EtfPage>
</template>
