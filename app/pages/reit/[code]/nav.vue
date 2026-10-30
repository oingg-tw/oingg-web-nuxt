<script setup lang="ts">
// REITs 面向：收盤價與淨值（2026-10-30）。每日淨值與折溢價（數據中台 /reits/{代號}/daily-nav）在伺服器端併成每月一列：月底的收盤價與淨值畫成
// 兩條線（距離就是折溢價），表格列每月折溢價的平均、單日最高、最低（同 ETF 折溢價）
const reitData = await useReit()
const { code, data, reit, shortName } = reitData

const months = computed(() => [...(data.value?.navMonths ?? [])].reverse())

const answer = computed(() => {
  const item = reit.value
  if (!item) return null
  const parts: string[] = []
  if (item.nav !== null) parts.push(`${item.navDate ?? '最新'}每單位淨值 ${reitYuan(item.nav)}${item.premiumDiscountPct === null ? '' : `，當天折溢價 ${reitSignedPct(item.premiumDiscountPct)}`}`)
  const lastYear = months.value.slice(0, 12)
  const highs = lastYear.flatMap(row => row.premiumHighest ?? [])
  const lows = lastYear.flatMap(row => row.premiumLowest ?? [])
  if (highs.length) parts.push(`近 ${lastYear.length} 個月單日折溢價最高 ${reitSignedPct(Math.max(...highs))}、最低 ${reitSignedPct(Math.min(...lows))}`)
  return parts.length ? `${shortName.value}（${code.value}）${parts.join('；')}。` : null
})
</script>

<template>
  <ReitPage :reit-data="reitData" facet="nav" :description="answer">
    <StockQuestionSection id="reit-nav" :question="`${shortName}（${code}）的收盤價比淨值高還是低？`" :answer="answer">
      <ReitFacetChart v-if="data" :data="data" facet="nav" />
      <SharedTable v-if="months.length" :label="`${shortName}每月收盤價、淨值與折溢價`" :caption="`${shortName} ${code} 每月月底的收盤價與每單位淨值，以及當月折溢價的平均、單日最高與最低（新的在上）`">
        <thead>
          <tr>
            <th scope="col">月份</th>
            <th scope="col" class="seo-table__num">月底收盤價</th>
            <th scope="col" class="seo-table__num">月底淨值</th>
            <th scope="col" class="seo-table__num">平均折溢價</th>
            <th scope="col" class="seo-table__num">單日最高</th>
            <th scope="col" class="seo-table__num">單日最低</th>
            <th scope="col" class="seo-table__num">有成交的日數</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in months" :key="row.month">
            <th scope="row">{{ row.month }}</th>
            <td class="seo-table__num">{{ reitYuan(row.close) }}</td>
            <td class="seo-table__num">{{ reitYuan(row.nav) }}</td>
            <td class="seo-table__num">{{ reitSignedPct(row.premiumAverage) }}</td>
            <td class="seo-table__num">{{ reitSignedPct(row.premiumHighest) }}</td>
            <td class="seo-table__num">{{ reitSignedPct(row.premiumLowest) }}</td>
            <td class="seo-table__num">{{ row.tradingDays }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">折溢價 ＝（收盤價 − 淨值）÷ 淨值。正的是溢價（收盤價高於淨值），負的是折價。淨值是受託機構每天公告的每單位淨資產價值，沒有成交的日子不算折溢價。</p>
    </StockQuestionSection>
  </ReitPage>
</template>
