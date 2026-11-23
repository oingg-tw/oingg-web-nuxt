<script setup lang="ts">
// ETF 面向：配息（2026-10-18，原本 /screener/etf/{代號} 第二段的上半）。每個月一格的配息柱＋每次配息的表。組成拆到「配息組成」那一頁
// 2026-11-24 最上面加歷年配息率（使用者：「etf 個別瀏覽要加上 歷年 殖利率」；ETF 叫配息率，詞彙表）：同個股配股配息頁第一段，圖是配息率
// 一條線加每次配息的柱子（EtfFacetChart 有配息率時就這樣畫，速覽同一張），下面一張各年底的配息率。有了這張圖，「每次配多少」只留表；
// 沒有配息率的（成立未滿 12 個月、讀不到）照舊在那一段畫配息柱。年度表不加每年配息合計：分割那年分割前後的金額單位不同，加起來沒有意義（0050 2025）
const etfData = await useEtf()
const { code, data, num, text, shortName } = etfData

const events = computed(() => [...(data.value?.distributions?.events ?? [])].sort((a, b) => b.exDividendDate.localeCompare(a.exDividendDate)))

const answer = computed(() => {
  if (!events.value.length) return text('distributionFrequency') === '不分配' ? '這檔 ETF 不配息，收益留在基金裡、反映在淨值上。' : '目前沒有這檔 ETF 的配息紀錄。'
  const window = data.value?.distributions?.trailing12MonthWindow
  const total = data.value?.distributions?.trailing12MonthDistributionPerUnit ?? null
  const yieldPct = num('trailing12MonthDistributionYieldPct')
  const parts = [`${shortName.value}（${code.value}）共有 ${events.value.length} 次配息紀錄，配息頻率${text('distributionFrequency') ?? '未知'}`]
  if (window && total !== null) parts.push(`近 12 個月每單位合計 ${etfYuan(total)}${yieldPct !== null ? `，配息率 ${etfPct(yieldPct)}` : ''}`)
  return `${parts.join('；')}。`
})

// 不配息的 ETF 配息率每個月都是 0，不畫
const yields = computed(() => (events.value.length ? data.value?.yieldHistory ?? [] : []))
// 只陳述這檔自己的區間，不說高低代表什麼（同個股配股配息頁第一段）
const yieldAnswer = computed(() => {
  const values = yields.value.flatMap(point => (point.value === null ? [] : [point.value]))
  if (values.length < 12) return null
  const sorted = [...values].sort((a, b) => a - b)
  const from = yields.value[0]!.tradeDate.slice(0, 7)
  if (sorted.at(-1) === 0) return `${from} 以來每個月月底的近 12 個月配息率都是 0。`
  return `${from} 以來每月月底的近 12 個月配息率介於 ${etfPct(sorted[0]!)} 到 ${etfPct(sorted.at(-1)!)}，中位數 ${etfPct(sorted[Math.floor(sorted.length / 2)]!)}。`
})
// 過完的年份才列（年底那一點），新的在上，跟全站歷年表一樣列 5 年（HISTORY_TABLE_PERIODS 是 20 季）；今年的最新值在圖上
const yearEnds = computed(() => {
  const thisYear = yields.value.at(-1)?.tradeDate.slice(0, 4) ?? ''
  return yields.value.filter(point => point.tradeDate.slice(5, 7) === '12' && point.tradeDate.slice(0, 4) < thisYear).reverse().slice(0, HISTORY_TABLE_PERIODS / 4)
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="distributions" :description="answer">
    <StockQuestionSection v-if="yields.length" id="etf-distribution-yield" :question="`${shortName}（${code}）歷年的配息率是多少？`" :answer="yieldAnswer">
      <EtfFacetChart v-if="data" :data="data" facet="distributions" />
      <SharedTable v-if="yearEnds.length" :label="`${shortName}各年底配息率`" :caption="`${shortName} ${code} 各年底的近 12 個月配息率（新的在上）`">
        <thead>
          <tr>
            <th scope="col">年底</th>
            <th scope="col" class="seo-table__num">近 12 個月配息率</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="point in yearEnds" :key="point.tradeDate">
            <th scope="row">{{ point.tradeDate }}</th>
            <td class="seo-table__num" :title="nullReasonTitle(point)">{{ reasonedCellText(point, etfPct) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>
    <StockQuestionSection id="etf-distributions" :question="`${shortName}（${code}）每次配多少？`" :answer="answer">
      <EtfFacetChart v-if="data && !yields.length" :data="data" facet="distributions" />
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
            <td class="seo-table__num">{{ event.distributionPerUnit === null ? '金額待公告' : etfYuan(event.distributionPerUnit) }}</td>
            <td>{{ event.paymentDate ?? '－' }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">配息不等於賺到：除息當天股價會扣掉同樣的金額，配息有一部分也可能來自收益平準金或資本利得（見「配息組成」）。</p>
    </StockQuestionSection>
    <StockMetricGuide
      v-if="yields.length"
      id-prefix="etf-distributions"
      topic="近 12 個月配息率"
      :definition="[
        '近 12 個月配息率是每個月最後一個有成交的交易日，往前 12 個月除息的每單位配息合計，除以那天的收盤價。除息日剛好是那天的也算進去，因為那天的收盤價已經扣掉配息。',
        '配息金額來自集保基金資訊觀測站（FundClear），從 2019 年起，所以配息率從 2020 年起才算得出來；成立未滿 12 個月的月份也算不出來。分割前的配息換算成那天的單位，圖上的柱子則是當時配的金額。',
        '配息率是配息除以價格：價格跌了，配息率也會變高。'
      ]"
    />
  </EtfPage>
</template>
