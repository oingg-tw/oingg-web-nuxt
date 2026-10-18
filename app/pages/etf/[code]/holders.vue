<script setup lang="ts">
// ETF 面向：持有人結構（2026-10-18 第二批）。集保股權分散每週一筆（2026-09-18 起，資料還很短）：15 個級距併成 5 組畫堆疊柱，表列最新一週的
// 15 級原樣。只陳述「持有多少的人占多少」，不寫散戶、大戶、籌碼集中這種帶判斷的詞
const etfData = await useEtf()
const { code, data, shortName } = etfData

const weeks = computed(() => data.value?.holders?.weeks ?? [])
const latest = computed(() => weeks.value.at(-1) ?? null)
const levels = computed(() => data.value?.holders?.latestLevels ?? [])
const lots = (shares: number) => groupThousands(Math.round(shares / 1000))
const rangeText = (minShares: number | null, maxShares: number | null) => {
  if (maxShares === null) return `${groupThousands(minShares ?? 0)} 股以上`
  return `${groupThousands(minShares ?? 0)}～${groupThousands(maxShares)} 股`
}

const answer = computed(() => {
  const week = latest.value
  if (!week) return null
  const groups = week.groups.map(group => `${group.name} ${group.custodyPct.toFixed(2)}%`).join('、')
  return `${week.dataDate} 集保資料，${shortName.value}（${code.value}）依持有張數分組的集保比例：${groups}。資料從 ${weeks.value[0]!.dataDate} 起，共 ${weeks.value.length} 週。`
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="holders" :description="answer">
    <StockQuestionSection id="etf-holders" :question="`${shortName}（${code}）是誰在持有？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="holders" />
      <SharedTableScroll v-if="levels.length" :label="`${shortName}最新一週的集保股權分散`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ shortName }} {{ code }} {{ latest?.dataDate }} 集保股權分散表，15 個持股級距</caption>
          <thead>
            <tr>
              <th scope="col">持股級距</th>
              <th scope="col" class="seo-table__num">人數</th>
              <th scope="col" class="seo-table__num">張數</th>
              <th scope="col" class="seo-table__num">占集保比例</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in levels" :key="row.level">
              <th scope="row">{{ rangeText(row.minShares, row.maxShares) }}</th>
              <td class="seo-table__num">{{ groupThousands(row.holders) }}</td>
              <td class="seo-table__num">{{ lots(row.shares) }}</td>
              <td class="seo-table__num">{{ row.custodyPct.toFixed(2) }}%</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer">資料來源是臺灣集中保管結算所每週公布的集保股權分散表；1 張是 1,000 股。這一面的資料從 2026 年 9 月才開始，週數還不多。</p>
    </StockQuestionSection>
  </EtfPage>
</template>
