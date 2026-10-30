<script setup lang="ts">
// REITs 面向：收益分配（2026-10-30）。每次分配一根柱＋每次分配的表。分配率是數據中台算好的（每單位分配 ÷ 除息前一個交易日的收盤價）。
// REITs 的收益分配不固定、不保本，只陳述實際分配了多少
const reitData = await useReit()
const { code, data, reit, shortName } = reitData

const events = computed(() => [...(data.value?.distributions ?? [])].sort((a, b) => b.exDividendDate.localeCompare(a.exDividendDate)))

const answer = computed(() => {
  const item = reit.value
  if (!item) return null
  if (!events.value.length) return `目前沒有${shortName.value}（${code.value}）的收益分配紀錄。`
  const parts = [`${shortName.value}（${code.value}）共有 ${events.value.length} 次收益分配紀錄`]
  if (item.trailing12MonthDistributionPerUnit !== null) {
    parts.push(`近 12 個月${item.trailing12MonthDistributionCount === null ? '' : `分配 ${item.trailing12MonthDistributionCount} 次、`}每單位合計 ${reitYuan(item.trailing12MonthDistributionPerUnit, 4)}${item.trailing12MonthDistributionYieldPct === null ? '' : `，分配率 ${reitPct(item.trailing12MonthDistributionYieldPct)}`}`)
  }
  return `${parts.join('；')}。`
})
</script>

<template>
  <ReitPage :reit-data="reitData" facet="distributions" :description="answer">
    <StockQuestionSection id="reit-distributions" :question="`${shortName}（${code}）每次分配多少？`" :answer="answer">
      <ReitFacetChart v-if="data" :data="data" facet="distributions" />
      <SharedTable v-if="events.length" :label="`${shortName}歷次收益分配`" :caption="`${shortName} ${code} 歷次收益分配（新的在上）`">
        <thead>
          <tr>
            <th scope="col">除息日</th>
            <th scope="col" class="seo-table__num">每單位分配</th>
            <th scope="col" class="seo-table__num">分配率</th>
            <th scope="col">發放日</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in events" :key="event.exDividendDate">
            <th scope="row">{{ event.exDividendDate }}</th>
            <td class="seo-table__num">{{ event.distributionPerUnit === null ? '尚未公布' : reitYuan(event.distributionPerUnit, 4) }}</td>
            <td class="seo-table__num">{{ reitPct(event.yieldOnPreviousClose) }}</td>
            <td>{{ event.paymentDate ?? '－' }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">分配率 ＝ 每單位分配 ÷ 除息前一個交易日的收盤價。收益分配不固定，除息當天價格會扣掉同樣的金額。</p>
    </StockQuestionSection>
  </ReitPage>
</template>
