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
  if (item.recentYearDistributionPerUnit !== null) {
    parts.push(`近一年${item.recentYearDistributionCount ? `分配 ${item.recentYearDistributionCount} 次、` : ''}每單位合計 ${reitYuan(item.recentYearDistributionPerUnit, 4)}${item.recentYearDistributionYieldPct === null ? '' : `，分配率 ${reitPct(item.recentYearDistributionYieldPct)}`}`)
  }
  return `${parts.join('；')}。`
})

// 分配率與 10 年期公債殖利率的利差（2026-11-24；使用者 11-23 照 S-REITs 指南要的「利差」，11-24 選 (b′) 的分配率）。答句寫最新一個算得出利差的月份
//（公債殖利率晚 1～2 個月公布，最新幾個月只有分配率），表列近 5 年的年底，同全站歷年表
const spread = computed(() => data.value?.spread ?? [])
const latestSpread = computed(() => [...spread.value].reverse().find(point => point.distributionYieldSpreadPct !== null) ?? null)
const spreadAnswer = computed(() => {
  const point = latestSpread.value
  if (!point || point.distributionYieldSpreadPct === null) return null
  const gap = point.distributionYieldSpreadPct
  return `${point.yearMonth} 的分配率 ${reitPct(point.recentYearDistributionYieldPct)}，10 年期公債殖利率 ${reitPct(point.govBondYield10yPct)}，分配率${gap >= 0 ? '高' : '低'} ${Math.abs(gap).toFixed(2)} 個百分點。`
})
const yearEnds = computed(() => {
  const thisYear = spread.value.at(-1)?.yearMonth.slice(0, 4) ?? ''
  return spread.value.filter(point => point.yearMonth.endsWith('-12') && point.yearMonth.slice(0, 4) < thisYear).reverse().slice(0, HISTORY_TABLE_PERIODS / 4)
})
const cell = (value: number | null, nullReason: string | null) => reasonedCellText({ value, nullReason }, reitPct)
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
            <th scope="col" class="seo-table__num">單次分配率</th>
            <th scope="col">發放日</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in events" :key="event.exDividendDate">
            <th scope="row">{{ event.exDividendDate }}</th>
            <td class="seo-table__num">{{ event.distributionPerUnit === null ? '金額待公告' : reitYuan(event.distributionPerUnit, 4) }}</td>
            <td class="seo-table__num">{{ reitPct(event.yieldOnPreviousClose) }}</td>
            <td>{{ event.paymentDate ?? '－' }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">單次分配率 ＝ 每單位分配 ÷ 除息前一個交易日的收盤價。收益分配不固定，除息當天價格會扣掉同樣的金額。</p>
    </StockQuestionSection>
    <StockQuestionSection v-if="spread.length" id="reit-distribution-spread" :question="`${shortName}（${code}）的分配率比 10 年期公債殖利率高多少？`" :answer="spreadAnswer">
      <ReitFacetChart v-if="data" :data="data" facet="spread" />
      <SharedTable v-if="yearEnds.length" :label="`${shortName}各年底的分配率與公債殖利率`" :caption="`${shortName} ${code} 各年底的分配率、10 年期公債殖利率與利差（新的在上）`">
        <thead>
          <tr>
            <th scope="col">年底</th>
            <th scope="col" class="seo-table__num">分配率</th>
            <th scope="col" class="seo-table__num">10 年期公債殖利率</th>
            <th scope="col" class="seo-table__num">利差（百分點）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="point in yearEnds" :key="point.yearMonth">
            <th scope="row">{{ point.yearMonth }}</th>
            <td class="seo-table__num">{{ cell(point.recentYearDistributionYieldPct, point.nullReason) }}</td>
            <td class="seo-table__num">{{ cell(point.govBondYield10yPct, point.nullReason) }}</td>
            <td class="seo-table__num" :title="nullReasonTitle({ value: point.distributionYieldSpreadPct, nullReason: point.nullReason })">{{ point.distributionYieldSpreadPct === null ? cell(null, point.nullReason) : minusSign(point.distributionYieldSpreadPct.toFixed(2)) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>
    <StockMetricGuide
      v-if="spread.length"
      id-prefix="reit-distributions"
      topic="分配率與利差"
      :definition="[
        '分配率是以最近一次分配為準、往回 11 個月內除息的每單位現金分配合計，除以那個月最後一個有成交的交易日的收盤價；分配次數就是那一年實際配的次數。',
        '10 年期公債殖利率是中央銀行公布的月資料，比分配晚 1～2 個月公布，所以最新幾個月只有分配率、沒有利差。利差是分配率減公債殖利率，單位是百分點。',
        '利差只是兩個比率相減，REITs 的分配不固定、不保本，價格也會變動，利差不代表報酬。表格裡的「尚無資料」是那段期間查不到分配紀錄，或殖利率還沒公布。'
      ]"
    />
  </ReitPage>
</template>
