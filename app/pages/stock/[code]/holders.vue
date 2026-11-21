<script setup lang="ts">
import type { ShareholdingDistribution } from '#shared/types/screener-detail'
import type { ShareholderDistribution } from '~/utils/holders-text'

// 持有人結構（2026-11-12，使用者選的盤點第 1 項「個股持有人結構」）：跟 ETF 的持有人結構同一份集保股權分散、同一張圖、同一張表與答句
//（SharedHoldersChart／SharedHoldersTable、utils/holders-text.ts）。集保每週一筆，2026-09-18 起
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '持有人結構'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
// 董監質押比例（2026-11-21；使用者 11-16「先放最新一份，標出表日」）：只寫最新一份與出表日。兩所都只有 2026-08-19 一份；興櫃沒有公布
//（dataSince 是 null）就不寫這一段。讀不到也只是不寫，不擋整頁
interface PledgeRatioHistory { dataSince: string | null; entries: { generatedDate: string; pledgePct: number | null }[] }
// 兩份一起等它到了才換頁（Nitro 快取的小回應）：頁面沒有讀取中的樣子，就不會有資料晚到把版面往下推
// 股權分散表（2026-11-22）也一起等：讀不到（404 不在名單）只是不寫那一段
const [{ data, error, refresh }, { data: pledge }, { data: distribution }] = await Promise.all([
  useFetch<ShareholdingDistribution>(() => `/api/stock/${code.value}/holders`, { key: () => `stock-holders-${code.value}`, watch: [code] }),
  useFetch<PledgeRatioHistory>(() => `/api/cached/stocks/${code.value}/pledge-ratio-history`, { key: () => `stock-pledge-${code.value}`, watch: [code] }),
  useFetch<ShareholderDistribution>(() => `/api/cached/stocks/${code.value}/shareholder-distribution`, { key: () => `stock-shareholder-distribution-${code.value}`, watch: [code] })
])
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

const latestPledge = computed(() => [...(pledge.value?.entries ?? [])].filter(entry => entry.pledgePct !== null).sort((a, b) => b.generatedDate.localeCompare(a.generatedDate))[0] ?? null)
const pledgeAnswer = computed(() => (latestPledge.value ? `董監質押比例 ${minusSign(latestPledge.value.pledgePct!.toFixed(2))}%（資料出表日 ${latestPledge.value.generatedDate}）。` : null))

// 哪一類股東持有最多（股權分散表，2026-11-22）：答句寫最大的兩組，圖是一條比例條（一期、七組，用不到圖表套件），表格照 MOPS 列 11 類
const typeAnswer = computed(() => holderTypeAnswer(distribution.value))
const { resolvedMode, color: accentColorName } = useAppTheme()
const typeGroups = computed(() => {
  const colors = [getAccentColor(resolvedMode.value, accentColorName.value), ...getStackLayerColors(resolvedMode.value)]
  return holderTypeGroups(distribution.value).map(group => ({ ...group, color: colors[HOLDER_GROUP_NAMES.indexOf(group.base)] ?? colors.at(-1)!, text: `${group.name} ${group.pct.toFixed(2)}%` }))
})
const typeLegend = computed(() => [{ items: typeGroups.value.map(group => ({ name: group.text, color: group.color, kind: 'bar' as const })) }])
const directors = computed(() => distribution.value?.directorsAndMajorShareholders ?? null)
const lots = (shares: number | null) => (shares === null ? '－' : groupThousands(Math.round(shares / 1000)))
const count = (value: number | null) => (value === null ? '－' : groupThousands(value))

const footer = computed(() => ({
  sources: ['臺灣集中保管結算所：集保戶股權分散表', ...(latestPledge.value ? ['臺灣證券交易所、證券櫃檯買賣中心：董監事持股與質押'] : []), ...(typeAnswer.value ? ['公開資訊觀測站：股權分散表'] : [])],
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
    <StockQuestionSection v-if="typeAnswer && distribution" id="stock-holder-types" :question="`哪一類股東持有${stockShortName}最多？`" :answer="typeAnswer">
      <SharedChartCard>
        <SharedChartLegend :groups="typeLegend" />
        <div class="stock-holders-page__types" role="img" :aria-label="`${stockShortName}各類股東的持股比例：${typeGroups.map(group => group.text).join('、')}`">
          <span v-for="group in typeGroups" :key="group.name" :style="{ flexGrow: group.pct, background: group.color }" />
        </div>
        <p v-if="directors?.sharesPct != null" class="stock-holders-page__note">董監與大股東合計 {{ directors.sharesPct.toFixed(2) }}%（{{ count(directors.holderCount) }} 人），跟上面的類別重疊。</p>
      </SharedChartCard>
      <SharedTable :label="`${stockShortName}的股權分散表（${distribution.dataDate}）`">
        <thead>
          <tr>
            <th scope="col">股東類別</th>
            <th scope="col" class="seo-table__num">占總股數</th>
            <th scope="col" class="seo-table__num">人數</th>
            <th scope="col" class="seo-table__num">張數</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in distribution.categories" :key="item.category">
            <th scope="row">{{ HOLDER_CATEGORY_LABELS[item.category] ?? item.category }}</th>
            <td class="seo-table__num">{{ item.sharesPct === null ? '－' : `${item.sharesPct.toFixed(2)}%` }}</td>
            <td class="seo-table__num">{{ count(item.holderCount) }}</td>
            <td class="seo-table__num">{{ lots(item.shares) }}</td>
          </tr>
          <tr>
            <th scope="row">合計</th>
            <td class="seo-table__num">100.00%</td>
            <td class="seo-table__num">{{ count(distribution.totalShareholders) }}</td>
            <td class="seo-table__num">{{ lots(distribution.totalShares) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>
    <StockQuestionSection v-if="pledgeAnswer" id="stock-pledge" :question="`${stockShortName}的董監事把多少持股拿去質押？`" :answer="pledgeAnswer" />
  </StockPageShell>
</template>

<style scoped>
/* 股東類別的比例條：段與段之間留 2px 卡片底色，兩端圓角；寬度照比例 */
.stock-holders-page__types {
  display: flex;
  gap: 2px;
  height: 24px;
  margin-top: 12px;
  border-radius: 4px;
  overflow: hidden;
}

.stock-holders-page__note {
  margin: 12px 0 0;
  color: var(--el-text-color-secondary);
}
</style>
