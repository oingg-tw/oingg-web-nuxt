<script setup lang="ts">
import type { FactItem } from '~/components/shared/SharedFactList.vue'

// ETF 個別頁的首頁：指標速覽（2026-10-18，「類似現在股票那邊的架構」）。原本 /screener/etf/{代號} 的「是什麼樣的 ETF」搬來這裡，配息那一段
// 拆成自己的面向頁。下面是每個面向的那張圖（跟面向頁同一張，EtfFacetChart）與最新數字的表，點名稱進面向頁。不做釘選：面向全部畫出來
const etfData = await useEtf()
const { code, data, etf, values, num, text, shortName } = etfData

const isActive = computed(() => values.value.isActive === true)
const MARKETS: Record<string, string> = { sii: '上市', otc: '上櫃' }

// 管理方式：被動式寫出追蹤的指數；主動式沒有指數（上游給 null）
const style = computed(() => {
  if (etf.value?.trackingIndex) return `被動式，追蹤「${etf.value.trackingIndex}」`
  return isActive.value ? '主動式，由經理人選股、不追蹤指數' : '－'
})

const facts = computed<FactItem[]>(() => {
  if (!etf.value) return []
  const years = num('yearsSinceEstablished')
  const aum = num('aum')
  const threshold = num('statutoryAumThreshold')
  const below = values.value.belowStatutoryThreshold === true
  return [
    { label: '基金全名', value: etf.value.fundName },
    { label: '發行投信', value: etf.value.issuerName },
    { label: '管理方式', value: style.value },
    { label: '資產類型', value: text('assetClass') ?? '－' },
    { label: '市場', value: MARKETS[text('market') ?? ''] ?? '－' },
    { label: '成立日', value: text('establishedDate') ?? '－', note: years !== null ? `成立 ${years} 年` : undefined },
    { label: '配息頻率', value: text('distributionFrequency') ?? '－' },
    { label: '規模', value: aum !== null ? formatMoney(aum) : '－', note: below && threshold !== null ? `低於法定下市門檻 ${formatMoney(threshold)}` : undefined, warning: below },
    { label: '受益人數', value: num('holders') !== null ? `${groupThousands(num('holders')!)} 人` : '－' },
    { label: '淨值', value: num('nav') !== null ? `${groupThousands(num('nav')!.toFixed(2))} 元` : '－' },
    { label: '折溢價率', value: etfPct(num('premiumDiscountPct')) }
  ]
})

const overviewAnswer = computed(() => {
  if (!etf.value) return null
  const assetClass = text('assetClass')
  const aum = num('aum')
  return [
    `${shortName.value}（${code.value}）是${etf.value.issuerName}發行的${etf.value.trackingIndex ? `被動式 ETF，追蹤「${etf.value.trackingIndex}」` : isActive.value ? '主動式 ETF' : ' ETF'}`,
    assetClass ? `，資產類型為${assetClass}` : '',
    aum !== null ? `；規模 ${formatMoney(aum)}` : '',
    '。'
  ].join('')
})

// ---- 各面向最新是多少 ----
const latestFill = computed(() => data.value?.fills?.find(fill => fill.unavailableReason === null) ?? null)
const latestLiquidity = computed(() => data.value?.liquidity?.at(-1) ?? null)
const latestMonthly = computed(() => data.value?.monthly?.at(-1) ?? null)
const latestHolders = computed(() => data.value?.holders?.weeks.at(-1) ?? null)
const latestHolderCount = computed(() => latestMonthly.value?.holders ?? null)
const rows = computed(() => {
  const distributions = data.value?.distributions
  const trailingTotal = distributions?.trailing12MonthDistributionPerUnit ?? null
  const latestComposed = [...(distributions?.events ?? [])].sort((a, b) => b.exDividendDate.localeCompare(a.exDividendDate)).find(event => hasEtfComposition(event.composition))
  const expense = num('expenseRatio')
  return [
    { key: 'distributions', value: trailingTotal !== null ? `近 12 個月 ${etfYuan(trailingTotal)}` : '－', note: num('trailing12MonthDistributionYieldPct') !== null ? `配息率 ${etfPct(num('trailing12MonthDistributionYieldPct'))}` : '' },
    { key: 'composition', value: latestComposed ? `股利所得 ${etfPct(latestComposed.composition!.dividendIncomePct)}` : '－', note: latestComposed ? `${latestComposed.exDividendDate} 除息那一次` : '' },
    { key: 'fill', value: latestFill.value ? fillDayText(latestFill.value) : '－', note: latestFill.value ? `${latestFill.value.exDividendDate} 除息那一次` : '' },
    { key: 'expenses', value: expense !== null ? `總費用率 ${etfPct(expense)}` : '－', note: '最近一個完整年度' },
    { key: 'returns', value: num('return1y') !== null ? `近 1 年 ${etfPct(num('return1y'))}` : '－', note: '配息再投入、以淨值計算' },
    { key: 'size', value: latestHolderCount.value !== null ? `受益人數 ${groupThousands(latestHolderCount.value)} 人` : '－', note: latestMonthly.value?.yearMonth ?? '' },
    { key: 'premium', value: `最新 ${etfPct(num('premiumDiscountPct'))}`, note: '（收盤價 − 淨值）÷ 淨值' },
    { key: 'liquidity', value: latestLiquidity.value ? `日均 ${groupThousands(latestLiquidity.value.averageDailyLots)} 張` : '－', note: latestLiquidity.value?.month ?? '' },
    { key: 'holders', value: latestHolders.value ? `1,000 張以上 ${etfPct(latestHolders.value.groups.at(-1)?.custodyPct)}` : '－', note: latestHolders.value ? `${latestHolders.value.dataDate} 集保比例` : '' }
  ] as const
})
const labelOf = (key: string) => ETF_FACETS.find(facet => facet.key === key)!.label
const CHART_FACETS = ['distributions', 'composition', 'expenses', 'returns', 'size', 'premium', 'liquidity', 'holders'] as const
</script>

<template>
  <EtfPage :etf-data="etfData" facet="overview" :description="overviewAnswer">
    <StockQuestionSection id="etf-overview" :question="`${shortName}（${code}）是什麼樣的 ETF？`" :answer="overviewAnswer">
      <SharedFactList :items="facts" :label="`${shortName}的基本資料`" />
    </StockQuestionSection>

    <StockQuestionSection v-if="data" id="etf-quick-view" :question="`${shortName}各方面的最新數字是多少？`" answer="每一個面向的圖與最新一期的數字。點名稱可以看那一面的完整紀錄。">
      <div class="etf-quick-view__grid">
        <EtfFacetChart v-for="facet in CHART_FACETS" :key="facet" :data="data" :facet="facet">
          <template #header>
            <h3 class="etf-quick-view__title"><NuxtLink :to="etfFacetPath(code, facet)" class="hub-inline-link">{{ labelOf(facet) }}</NuxtLink></h3>
          </template>
        </EtfFacetChart>
      </div>
      <SharedTableScroll :label="`${shortName}各面向的最新數字`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ shortName }} {{ code }} 各面向的最新數字</caption>
          <thead>
            <tr>
              <th scope="col">面向</th>
              <th scope="col">最新數字</th>
              <th scope="col">說明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <th scope="row"><NuxtLink :to="etfFacetPath(code, row.key)" class="seo-table__link">{{ labelOf(row.key) }}</NuxtLink></th>
              <td>{{ row.value }}</td>
              <td>{{ row.note || '－' }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </StockQuestionSection>
  </EtfPage>
</template>

<style scoped>
/* 同個股指標速覽的格狀：最多三欄（2026-10-17「滿版的時候最多給3columns就好」） */
.etf-quick-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(max(min(100%, 480px), (100% - 2 * 16px) / 3), 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.etf-quick-view__grid > * {
  min-width: 0;
}

.etf-quick-view__grid :deep(.shared-chart-card) {
  margin-bottom: 0;
}

.etf-quick-view__title {
  margin: 0;
  font-size: 18px;
}
</style>
