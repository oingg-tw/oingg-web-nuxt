<script setup lang="ts">
// ETF 面向：持有人結構（2026-10-18 第二批）。集保股權分散每週一筆（2026-09-18 起，資料還很短）：15 個級距併成 5 組畫堆疊柱，表列最新一週的
// 15 級原樣。表格與答句跟個股 /holders 共用（SharedHoldersTable、utils/holders-text.ts）
const etfData = await useEtf()
const { code, data, shortName } = etfData

const weeks = computed(() => data.value?.holders?.weeks ?? [])
const levels = computed(() => data.value?.holders?.latestLevels ?? [])
const answer = computed(() => holdersAnswer(weeks.value.at(-1)))
const description = computed(() => holdersDescription(weeks.value, `${shortName.value}（${code.value}）`))
</script>

<template>
  <EtfPage :etf-data="etfData" facet="holders" :description="description">
    <StockQuestionSection id="etf-holders" :question="`${shortName}（${code}）是誰在持有？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="holders" />
      <SharedHoldersTable v-if="levels.length" :levels="levels" :short-name="shortName" :code="code" :date="weeks.at(-1)?.dataDate ?? ''" />
      <p class="hub-answer">資料來源是臺灣集中保管結算所每週公布的集保股權分散表；1 張是 1,000 股，每一級含上限（5～10 張是 5,001～10,000 股）。這一面的資料從 2026 年 9 月才開始，週數還不多。</p>
    </StockQuestionSection>
  </EtfPage>
</template>
