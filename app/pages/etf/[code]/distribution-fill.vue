<script setup lang="ts">
// ETF 面向：填息（2026-10-18）。同個股填息頁：除息前一個交易日的收盤價，之後第一次回到那個價位經過幾個交易日。日線約 8 年；
// 期間有分割（0050 2025-06 一拆四）的那幾次算不出來，照實寫原因（computeDividendFills 的 price-break）。只有表，沒有圖（同個股）
const etfData = await useEtf()
const { code, data, shortName } = etfData

const fills = computed(() => data.value?.fills ?? [])
const answer = computed(() => {
  if (data.value?.fills === null) return null
  if (!fills.value.length) return '目前沒有這檔 ETF 的配息紀錄。'
  const summary = fillSummary(fills.value, '配息') ?? '這些配息都沒有逐日股價可以比對。'
  const unavailable = fillUnavailableParts(fills.value)
  return unavailable.length ? `${summary}另有${unavailable.join('、')}，算不出填息天數。` : summary
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="fill" :description="answer">
    <StockQuestionSection id="etf-fill" :question="`${shortName}（${code}）除息之後，股價填回來了嗎？`" :answer="answer">
      <SharedTable v-if="fills.length" :label="`${shortName} ${code} 的除息與填息紀錄`" :caption="`${shortName} ${code} 的除息與填息紀錄（新的在上）`">
        <thead>
          <tr>
            <th scope="col">除息日</th>
            <th scope="col" class="seo-table__num">每單位配息（元）</th>
            <th scope="col" class="seo-table__num">除息前一交易日收盤價（元）</th>
            <th scope="col">回到該價位的日期</th>
            <th scope="col">經過交易日數</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="fill in fills" :key="fill.exDividendDate">
            <th scope="row">{{ fill.exDividendDate }}</th>
            <td class="seo-table__num">{{ formatSignificantDigits(fill.cashDividend, 4) }}</td>
            <td class="seo-table__num">{{ fill.preExClose === null ? '－' : fill.preExClose.toFixed(2) }}</td>
            <td>{{ fill.filledDate ?? '－' }}</td>
            <td>{{ fillDayText(fill) }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">填息是指除息後股價回到除息前一個交易日的收盤價。沒有填息的期間，配到的錢等於是從自己的本金拿出來的。</p>
    </StockQuestionSection>
  </EtfPage>
</template>
