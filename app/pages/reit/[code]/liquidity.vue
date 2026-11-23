<script setup lang="ts">
// REITs 面向：成交量（2026-11-23，對照 S-REITs 指南之後先做的流動性，使用者「照順序做」）。每月日均成交張數的柱（受益權單位不分割，看張數），
// 表列張數、沒有成交的日數（手機上排第二欄，不用往右捲就看得到）、交易日數與金額。答句寫最新一個月，再加近 12 個月沒成交的天數：台灣 REITs 的冷門是「有幾天整天沒人買賣」，
// 最新一個月常常一天都沒有。日線約 8 年
const reitData = await useReit()
const { code, data, shortName } = reitData

const months = computed(() => [...(data.value?.liquidity ?? [])].reverse())
const answer = computed(() => {
  const latest = months.value[0]
  if (!latest) return null
  const [year, month] = latest.month.split('-')
  const lastYear = months.value.slice(0, 12)
  const noTradeDays = lastYear.reduce((sum, row) => sum + row.noTradeDays, 0)
  return `${shortName.value}（${code.value}）${year} 年 ${Number(month)} 月平均每個交易日成交 ${reitLots(latest.averageDailyLots)}（${latest.tradingDays} 個交易日）；近 ${lastYear.length} 個月${noTradeDays ? `有 ${noTradeDays} 天沒有成交` : '每個交易日都有成交'}。`
})
</script>

<template>
  <ReitPage :reit-data="reitData" facet="liquidity" :description="answer">
    <StockQuestionSection id="reit-liquidity" :question="`${shortName}（${code}）好不好買賣？`" :answer="answer">
      <ReitFacetChart v-if="data" :data="data" facet="liquidity" />
      <SharedTable v-if="months.length" :label="`${shortName}每月成交`" :caption="`${shortName} ${code} 每月平均每個交易日的成交張數、沒有成交的日數、交易日數與平均每個交易日的成交金額（新的在上）`">
        <thead>
          <tr>
            <th scope="col">月份</th>
            <th scope="col" class="seo-table__num">日均成交張數</th>
            <th scope="col" class="seo-table__num">沒有成交的日數</th>
            <th scope="col" class="seo-table__num">交易日數</th>
            <th scope="col" class="seo-table__num">日均成交金額</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in months" :key="row.month">
            <th scope="row">{{ row.month }}</th>
            <td class="seo-table__num">{{ reitLots(row.averageDailyLots) }}</td>
            <td class="seo-table__num">{{ row.noTradeDays }}</td>
            <td class="seo-table__num">{{ row.tradingDays }}</td>
            <td class="seo-table__num">{{ formatMoney(row.averageDailyValue) }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">1 張是 1,000 個受益權單位。日均是當月成交的張數或金額合計除以交易日數，沒有成交（那天沒有收盤價）的日子算 0。成交少的日子，想買或想賣的張數不一定能在當天、用想要的價格全部成交。</p>
    </StockQuestionSection>
  </ReitPage>
</template>
