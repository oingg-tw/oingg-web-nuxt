<script setup lang="ts">
import type { StockBadges } from '~/composables/stock/useStockBadges'
import { findStockBadgeEntry } from '~/composables/stock/useStockBadges'
import type { PiotroskiBreakdown, PiotroskiBreakdownGroups } from '~/composables/stock/usePiotroskiBreakdown'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'
import { GURU_BADGE_DISCLAIMER, buildGuruBadges, guruBadgeSourceUrl } from '~/utils/guru-badges'
import { clampDescription } from '~/utils/stock-digest'

// GET /metrics key of the badge this page is about（GuruBadge.id === metric.key）.
const PIOTROSKI_METRIC_CODE = 'piotroskiFScore'

// /stock/{code}/f-score — the ONE template of a per-stock × per-metric page (2026-09-19, the
// stock-page a11y/SEO redesign), built to test whether such pages get indexed and how Google
// treats their content thickness before anything is programmatically rolled out to the other
// 12–15 badge metrics. The decision and its conditions are in the plan: every page must be led by
// THIS stock's own data (current score, the 9-signal checklist, the score history, disclosure
// dates); the shared methodology text stays a short paragraph that links to the single
// methodology page (/guru-indicators), never the full badge.detail pasted 1,583 times — that is
// the thin/near-duplicate shape Google's scaled-content policy targets, not per-stock pages as
// such (財報狗's own /analysis/{code}/piotroski-f-score pages are indexed and rank).
//
// Indexable only for the pilot batch (shared/utils/f-score-pilot.ts); every other symbol renders
// the same page with `noindex, follow`, and the stocks sitemap lists only the pilot's URLs.
// Reached from company-health's 獲利品質 section (a contextual link), not from the page nav yet.
//
// Everything below is fetched at page level with useAsyncData so it is in the server HTML — the
// card composables for these same endpoints (useStockBadges/usePiotroskiBreakdown) are
// deliberately client-only on a cache miss and aren't used here. Wording is the compliance
// register: 符合／未符合／無資料 per signal, the score as N／9, the badge criterion quoted from the
// catalog, no evaluative adjectives anywhere.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))
const config = useRuntimeConfig()

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

interface FScorePayload {
  badges: StockBadges | null
  breakdown: PiotroskiBreakdown | null
  history: MetricsHistoryEntry[] | null
}

const { data: payload } = await useAsyncData<FScorePayload | null>(
  () => `stock-f-score-${code.value}`,
  async () => {
    const symbol = code.value
    if (!symbol) return null
    const request = <T>(path: string, query?: Record<string, string | number>) =>
      $fetch<T>(path, { baseURL: config.public.apiBase, retry: 0, timeout: 8000, query })
    const [badges, breakdown, history] = await Promise.allSettled([
      request<StockBadges>(`/stocks/${symbol}/badges`),
      request<PiotroskiBreakdown>(`/stocks/${symbol}/piotroski-breakdown`),
      request<{ entries: MetricsHistoryEntry[] }>(`/stocks/${symbol}/metrics-history`, { metricCodes: 'piotroskiFScore', basis: 'Q', limit: 20 })
    ])
    return {
      badges: badges.status === 'fulfilled' ? badges.value : null,
      breakdown: breakdown.status === 'fulfilled' ? breakdown.value : null,
      history: history.status === 'fulfilled' ? history.value.entries : null
    }
  },
  { watch: [code], default: () => null }
)

// The badge's own catalog definition（name/author/summary/criterion/source link）— the same
// buildGuruBadges() every badge UI on this site reads, so the methodology text has one source.
const badgeDefinition = computed(() => buildGuruBadges(filterSchema.value?.categories ?? []).find(badge => badge.id === PIOTROSKI_METRIC_CODE) ?? null)
const sourceUrl = computed(() => (badgeDefinition.value && filterSchema.value ? guruBadgeSourceUrl(filterSchema.value.categories, badgeDefinition.value) : null))

const scoreEntry = computed(() => findStockBadgeEntry(payload.value?.badges ?? null, PIOTROSKI_METRIC_CODE))
const breakdown = computed(() => payload.value?.breakdown ?? null)
const scoreValue = computed<number | null>(() => scoreEntry.value?.value ?? breakdown.value?.totalScore ?? null)
const scorePassed = computed<boolean | null>(() => scoreEntry.value?.passed ?? null)
const periodLabel = computed(() => {
  const data = breakdown.value
  return data?.fiscalYear && data.fiscalQuarter ? `${data.fiscalYear} Q${data.fiscalQuarter}` : null
})
const knowledgeDate = computed(() => {
  const data = breakdown.value
  return data?.knowledgeDate && data.knowledgeDateIsFallback === false ? data.knowledgeDate : (scoreEntry.value?.knowledgeDateIsFallback === false ? scoreEntry.value.knowledgeDate : null)
})

// Signal order follows Piotroski (2000)'s own grouping — the same order
// StockGuruBadgeDialog.vue's checklist uses.
const SIGNAL_ORDER: Record<keyof PiotroskiBreakdownGroups, string[]> = {
  profitability: ['positiveRoa', 'positiveCfo', 'roaImproved', 'accrualQuality'],
  leverageLiquidity: ['leverageDecreased', 'liquidityImproved', 'noDilution'],
  operatingEfficiency: ['grossMarginImproved', 'assetTurnoverImproved']
}

interface SignalRow {
  key: string
  label: string
  passed: boolean | null
}

const signalGroups = computed(() => {
  const data = breakdown.value
  if (!data?.groups) return []
  const groups = data.groups
  return (Object.keys(SIGNAL_ORDER) as (keyof PiotroskiBreakdownGroups)[]).map(key => {
    const values = groups[key] as Record<string, boolean | null>
    const signals: SignalRow[] = SIGNAL_ORDER[key].map(signal => ({ key: signal, label: data.signalLabels?.[signal] ?? signal, passed: values[signal] ?? null }))
    const meta = data.groupMetadata?.find(item => item.key === key)
    return {
      key,
      name: meta?.name ?? key,
      summary: meta?.summary ?? '',
      met: signals.filter(signal => signal.passed === true).length,
      denominator: meta?.denominator ?? signals.length,
      signals
    }
  })
})
const metCount = computed(() => signalGroups.value.reduce((sum, group) => sum + group.met, 0))

// Latest first — the history endpoint returns ascending.
const historyRows = computed(() => {
  const entries = payload.value?.history ?? []
  return entries
    .slice()
    .reverse()
    .map(entry => {
      const point = entry.values.piotroskiFScore
      return { label: `${entry.fiscalYear} Q${entry.fiscalQuarter}`, value: point && point.value !== null ? `${point.value} 分` : '－' }
    })
})

function stateText(passed: boolean | null): string {
  return passed === null ? '無資料' : passed ? '符合' : '未符合'
}

function stateMark(passed: boolean | null): string {
  return passed === null ? '—' : passed ? '✓' : '✗'
}

const description = computed(() => {
  if (scoreValue.value === null) return null
  const groupText = signalGroups.value.map(group => `${group.name} ${group.met}／${group.denominator}`).join('、')
  const period = periodLabel.value ? `${periodLabel.value} ` : ''
  return clampDescription(`${stockShortName.value}（${code.value}）Piotroski F-Score：${period}得分 ${scoreValue.value}／9，9 項訊號符合 ${metCount.value} 項${groupText ? `；${groupText}` : ''}。`)
})

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: 'Piotroski F-Score',
  pathSuffix: '/f-score',
  stock,
  summary,
  description,
  noindex: computed(() => !isFScorePilotSymbol(code.value)),
  parent: { label: '公司健檢', pathSuffix: '/company-health' }
})
</script>

<template>
  <div v-loading="stockPending" class="f-score-page">
    <template v-if="stockPending" />
    <el-result
      v-else-if="!stock"
      icon="warning"
      sub-title="請確認股票代號是否正確"
    >
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="Piotroski F-Score" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <section class="stock-page-section" aria-labelledby="stock-f-score-current-heading">
        <h2 id="stock-f-score-current-heading" class="stock-page-section__title">目前分數</h2>
        <el-card shadow="never" class="f-score-page__card">
          <template v-if="scoreValue !== null">
            <p class="f-score-page__score">
              <span class="f-score-page__score-value">{{ scoreValue }}</span>
              <span class="f-score-page__score-denominator">／9</span>
            </p>
            <p class="f-score-page__line">
              <template v-if="periodLabel">財報期別 {{ periodLabel }}</template>
              <template v-if="knowledgeDate">（揭露日 {{ knowledgeDate }}）</template>
            </p>
            <p v-if="badgeDefinition" class="f-score-page__line">
              徽章門檻：{{ badgeDefinition.threshold.description }}——本期{{ scorePassed === null ? '無法判定' : scorePassed ? '符合' : '未符合' }}
            </p>
          </template>
          <p v-else class="f-score-page__line">目前沒有這檔股票的 Piotroski F-Score 資料。</p>
        </el-card>
      </section>

      <section class="stock-page-section" aria-labelledby="stock-f-score-signals-heading">
        <h2 id="stock-f-score-signals-heading" class="stock-page-section__title">9 項訊號逐項結果</h2>
        <div v-if="signalGroups.length" class="f-score-page__groups">
          <el-card v-for="group in signalGroups" :key="group.key" shadow="never" class="f-score-page__card">
            <template #header>
              <StockCardTitle :title="`${group.name}（${group.met}／${group.denominator}）`" />
            </template>
            <p v-if="group.summary" class="f-score-page__group-summary">{{ group.summary }}</p>
            <ul class="f-score-page__signals">
              <li v-for="signal in group.signals" :key="signal.key" class="f-score-page__signal" :data-passed="signal.passed === null ? 'unknown' : String(signal.passed)">
                <span class="f-score-page__signal-mark" aria-hidden="true">{{ stateMark(signal.passed) }}</span>
                <span class="f-score-page__signal-label">{{ signal.label }}</span>
                <span class="f-score-page__signal-state">{{ stateText(signal.passed) }}</span>
              </li>
            </ul>
          </el-card>
        </div>
        <p v-else class="f-score-page__line">目前沒有這檔股票的訊號明細。</p>
      </section>

      <section class="stock-page-section" aria-labelledby="stock-f-score-history-heading">
        <h2 id="stock-f-score-history-heading" class="stock-page-section__title">近 5 年分數歷史</h2>
        <el-card shadow="never" class="f-score-page__card">
          <table v-if="historyRows.length" class="f-score-page__history">
            <caption class="visually-hidden">{{ stockShortName }} 各季 Piotroski F-Score</caption>
            <thead>
              <tr>
                <th scope="col">財報期別</th>
                <th scope="col">分數（滿分 9）</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in historyRows" :key="row.label">
                <th scope="row">{{ row.label }}</th>
                <td>{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="f-score-page__line">目前沒有這檔股票的分數歷史。</p>
        </el-card>
      </section>

      <section class="stock-page-section" aria-labelledby="stock-f-score-method-heading">
        <h2 id="stock-f-score-method-heading" class="stock-page-section__title">方法論</h2>
        <el-card shadow="never" class="f-score-page__card">
          <template v-if="badgeDefinition">
            <p class="f-score-page__line">{{ badgeDefinition.summary }}</p>
            <p class="f-score-page__line">
              出處：{{ badgeDefinition.author }}
              <template v-if="sourceUrl">・<a :href="sourceUrl" target="_blank" rel="noopener">原始文獻</a></template>
            </p>
          </template>
          <p class="f-score-page__line">
            <NuxtLink :to="`/guru-indicators#guru-badge-${PIOTROSKI_METRIC_CODE}`">看 Piotroski F-Score 的完整說明與其他指標</NuxtLink>
          </p>
          <p class="f-score-page__disclaimer">{{ GURU_BADGE_DISCLAIMER }}</p>
        </el-card>
      </section>
    </template>
  </div>
</template>

<style scoped>
.f-score-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.f-score-page__card {
  border-radius: 12px;
}

.f-score-page__score {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 0 0 8px;
  font-variant-numeric: tabular-nums;
}

.f-score-page__score-value {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1;
  color: var(--el-text-color-primary);
}

.f-score-page__score-denominator {
  font-size: 1.25rem;
  color: var(--el-text-color-secondary);
}

.f-score-page__line {
  margin: 0 0 8px;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.f-score-page__groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.f-score-page__group-summary {
  margin: 0 0 12px;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.f-score-page__signals {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.f-score-page__signal {
  display: grid;
  grid-template-columns: 1.5rem 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 1rem;
  color: var(--el-text-color-primary);
}

.f-score-page__signal-mark {
  font-weight: 700;
  text-align: center;
}

/* State is carried by the word（符合／未符合／無資料）and the mark's shape — colour is an extra
   cue, never the only one. */
.f-score-page__signal[data-passed='true'] .f-score-page__signal-mark {
  color: var(--el-color-success);
}

.f-score-page__signal[data-passed='false'] .f-score-page__signal-mark {
  color: var(--el-color-danger);
}

.f-score-page__signal-state {
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

.f-score-page__history {
  width: 100%;
  border-collapse: collapse;
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.f-score-page__history th,
.f-score-page__history td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  text-align: left;
}

.f-score-page__history th[scope='col'] {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.f-score-page__history th[scope='row'] {
  font-weight: 400;
  color: var(--el-text-color-regular);
}

.f-score-page__disclaimer {
  margin: 12px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}
</style>
