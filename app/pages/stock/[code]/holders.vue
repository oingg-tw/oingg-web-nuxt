<script setup lang="ts">
import type { ShareholdingDistribution } from '#shared/types/screener-detail'

// 持有人結構（2026-11-12，使用者選的盤點第 1 項「個股持有人結構」）：跟 ETF 的持有人結構同一份集保股權分散、同一張圖、同一張表與答句
//（SharedHoldersChart／SharedHoldersTable、utils/holders-text.ts）。集保每週一筆，2026-09-18 起
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '持有人結構'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
// 等它到了才換頁（Nitro 快取的小回應）：頁面沒有讀取中的樣子，就不會有資料晚到把版面往下推
const { data, error, refresh } = await useFetch<ShareholdingDistribution>(() => `/api/stock/${code.value}/holders`, { key: () => `stock-holders-${code.value}`, watch: [code] })
watchLoadFailure(() => `stock-holders:${code.value}`, () => error.value, refresh)
const weeks = computed(() => data.value?.weeks ?? [])
const latest = computed(() => weeks.value.at(-1))
// 集保查無這一檔（上游 404）：說沒有資料，不收錄這一頁
const missing = computed(() => !!data.value && !weeks.value.length)

const answer = computed(() => holdersAnswer(latest.value))
const description = computed(() => {
  const name = `${stockShortName.value}（${code.value}）`
  return clampDescription(holdersDescription(weeks.value, name) ?? `${name}目前沒有集保股權分散資料。`)
})

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '持有人結構：集保股權分散與各級持股比例',
  pathSuffix: '/holders',
  stock,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: missing
})

const footer = computed(() => ({
  sources: ['臺灣集中保管結算所：集保戶股權分散表'],
  freshness: latest.value ? `資料日期 ${latest.value.dataDate}` : null
}))
</script>

<template>
  <StockPageShell
    class="stock-holders-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <StockQuestionSection v-if="latest" id="stock-holders" :question="`${stockShortName}（${code}）是誰在持有？`" :answer="answer">
      <SharedHoldersChart :weeks="weeks" />
      <SharedHoldersTable :levels="data?.latestLevels ?? []" :short-name="stockShortName" :code="code" :date="latest.dataDate" />
      <p class="hub-answer">資料來源是臺灣集中保管結算所每週公布的集保股權分散表；1 張是 1,000 股，每一級含上限（5～10 張是 5,001～10,000 股）。這一頁的資料從 2026 年 9 月才開始，週數還不多。</p>
    </StockQuestionSection>
    <p v-else-if="missing" class="hub-answer">目前沒有{{ stockShortName }}的集保股權分散資料。</p>
  </StockPageShell>
</template>
