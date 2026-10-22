<script setup lang="ts">
// ETF 面向：成交量（2026-10-18）。每個月的日均成交金額柱（金額不受分割影響）＋每月的表（金額與張數都列）。日線約 8 年
const etfData = await useEtf()
const { code, data, shortName } = etfData

const months = computed(() => [...(data.value?.liquidity ?? [])].reverse())
const answer = computed(() => {
  const latest = months.value[0]
  if (!latest) return null
  const [year, month] = latest.month.split('-')
  return `${shortName.value}（${code.value}）${year} 年 ${Number(month)} 月平均每個交易日成交 ${groupThousands(latest.averageDailyLots)} 張、金額 ${formatMoney(latest.averageDailyValue)}（${latest.tradingDays} 個交易日）。`
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="liquidity" :description="answer">
    <StockQuestionSection id="etf-liquidity" :question="`${shortName}（${code}）好不好買賣？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="liquidity" />
      <SharedTable v-if="months.length" :label="`${shortName}每月日均成交`" :caption="`${shortName} ${code} 每月平均每個交易日的成交金額與張數（新的在上）`">
        <thead>
          <tr>
            <th scope="col">月份</th>
            <th scope="col" class="seo-table__num">日均成交金額</th>
            <th scope="col" class="seo-table__num">日均成交張數</th>
            <th scope="col" class="seo-table__num">交易日數</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in months" :key="row.month">
            <th scope="row">{{ row.month }}</th>
            <td class="seo-table__num">{{ formatMoney(row.averageDailyValue) }}</td>
            <td class="seo-table__num">{{ groupThousands(row.averageDailyLots) }} 張</td>
            <td class="seo-table__num">{{ row.tradingDays }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">分割之後（例如一拆四）張數會變多、金額不變，比較不同年份時看金額。</p>
    </StockQuestionSection>
  </EtfPage>
</template>
