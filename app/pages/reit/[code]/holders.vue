<script setup lang="ts">
// REITs 面向：持有人結構（2026-11-23，同成交量一起做）。集保股權分散每週一筆（2026-09-18 起）：圖、表與答句跟 ETF 面向、個股 /holders 共用
//（SharedHoldersChart 經 ReitFacetChart、SharedHoldersTable、utils/holders-text.ts）
const reitData = await useReit()
const { code, data, shortName } = reitData

const weeks = computed(() => data.value?.holders?.weeks ?? [])
const levels = computed(() => data.value?.holders?.latestLevels ?? [])
const answer = computed(() => holdersAnswer(weeks.value.at(-1)))
const description = computed(() => holdersDescription(weeks.value, `${shortName.value}（${code.value}）`))
</script>

<template>
  <ReitPage :reit-data="reitData" facet="holders" :description="description">
    <StockQuestionSection id="reit-holders" :question="`${shortName}（${code}）是誰在持有？`" :answer="answer">
      <ReitFacetChart v-if="data" :data="data" facet="holders" />
      <SharedHoldersTable v-if="levels.length" :levels="levels" :short-name="shortName" :code="code" :date="weeks.at(-1)?.dataDate ?? ''" />
      <p class="hub-answer">資料來源是臺灣集中保管結算所每週公布的集保股權分散表；1 張是 1,000 個受益權單位，每一級含上限（5～10 張是 5,001～10,000 個單位）。這一面的資料從 2026 年 9 月才開始，週數還不多。</p>
    </StockQuestionSection>
  </ReitPage>
</template>
