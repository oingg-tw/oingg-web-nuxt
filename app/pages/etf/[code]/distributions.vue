<script setup lang="ts">
// ETF 面向：配息（2026-10-18，原本 /screener/etf/{代號} 第二段的上半）。每個月一格的配息柱＋每次配息的表。組成拆到「配息組成」那一頁
const etfData = await useEtf()
const { code, data, num, text, shortName } = etfData

const events = computed(() => [...(data.value?.distributions?.events ?? [])].sort((a, b) => b.exDividendDate.localeCompare(a.exDividendDate)))

const answer = computed(() => {
  if (!events.value.length) return text('distributionFrequency') === '不分配' ? '這檔 ETF 不配息，收益留在基金裡、反映在淨值上。' : '目前沒有這檔 ETF 的配息紀錄。'
  const window = data.value?.distributions?.trailing12MonthWindow
  const total = data.value?.distributions?.trailing12MonthDistributionPerUnit ?? null
  const yieldPct = num('trailing12MonthDistributionYieldPct')
  const parts = [`${shortName.value}（${code.value}）共有 ${events.value.length} 次配息紀錄，配息頻率${text('distributionFrequency') ?? '未知'}`]
  if (window && total !== null) parts.push(`近 12 個月（${window.start}～${window.end}）每單位合計 ${etfYuan(total)}${yieldPct !== null ? `，配息率 ${etfPct(yieldPct)}` : ''}`)
  return `${parts.join('；')}。`
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="distributions" :description="answer">
    <StockQuestionSection id="etf-distributions" :question="`${shortName}（${code}）每次配多少？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="distributions" />
      <SharedTable v-if="events.length" :label="`${shortName}歷次配息`" :caption="`${shortName} ${code} 歷次配息（新的在上）`">
        <thead>
          <tr>
            <th scope="col">除息日</th>
            <th scope="col" class="seo-table__num">每單位配息</th>
            <th scope="col">發放日</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in events" :key="event.exDividendDate">
            <th scope="row">{{ event.exDividendDate }}</th>
            <td class="seo-table__num">{{ event.distributionPerUnit === null ? '尚未公布' : etfYuan(event.distributionPerUnit) }}</td>
            <td>{{ event.paymentDate ?? '－' }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">配息不等於賺到：除息當天股價會扣掉同樣的金額，配息有一部分也可能來自收益平準金或資本利得（見「配息組成」）。</p>
    </StockQuestionSection>
  </EtfPage>
</template>
