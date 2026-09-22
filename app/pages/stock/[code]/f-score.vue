<script setup lang="ts">
import type { PiotroskiBreakdownGroups } from '#shared/types/piotroski'
import { findStockBadgeEntry } from '~/composables/stock/useStockBadges'
import { GURU_BADGE_DISCLAIMER, buildGuruBadges } from '~/utils/guru-badges'
import { clampDescription, findMetricInSchema } from '~/utils/stock-digest'
import { joinClauses } from '~/utils/stock-answers'

// This page's own entry in the shared badge-page registry (2026-09-20) — it renders from this
// hand-built file rather than [slug].vue's generic template（`ownRoute`）, but its metricCode,
// topic and titleKeywords live in BADGE_PAGES with the other three badge pages' so the sitemap,
// the badge table's row link and this page can't disagree about them. Non-null by construction;
// the fallback keeps this page rendering if the entry is ever removed.
const BADGE_PAGE = findBadgePage('f-score')
const PIOTROSKI_METRIC_CODE = BADGE_PAGE?.metricCode ?? 'piotroskiFScore'
const TOPIC = BADGE_PAGE?.topic ?? 'Piotroski F-Score'

// /stock/{code}/f-score — the ONE template of a per-stock × per-metric page (2026-09-19, the
// stock-page a11y/SEO redesign), built to test whether such pages get indexed and how Google
// treats their content thickness before anything is programmatically rolled out to the other
// badge metrics; the user's later call（「先來 f score 徽章作為示範就足夠，看著狀況好再擴大」）keeps
// it the only one. Every page is led by THIS stock's own data (current score, the 9-signal
// checklist, disclosure dates); a per-quarter score-history table was here too until 2026-09-20,
// removed per direct decision ("近 5 年的分數怎麼變 這個希望可以拿掉，沒有識別價值") — a column of
// 0–9 integers repeated across 1,583 symbols distinguishes almost nothing between them, which is
// the same near-duplicate-content problem this page's own design is otherwise built to avoid. The
// 優點與限制 section (2026-09-20) replaced it as the page's third block; the shared methodology
// text stays a short
// paragraph that links to the single methodology page (/guru-indicators), never the full
// badge.detail pasted 1,583 times — that is the thin/near-duplicate shape Google's scaled-content
// policy targets, not per-stock pages as such.
//
// Indexable only for the pilot batch (shared/utils/f-score-pilot.ts); every other symbol renders
// the same page with `noindex, follow`, and the stocks sitemap lists only the pilot's URLs.
// Reached from the stock index page's 亮點與風險 section (a contextual link), not from the page
// nav yet — company-health, its original entry point, was unpublished 2026-09-19 (see that
// file's own comment).
//
// Data comes through the same cached series route as every other stock page
// (/api/stock/:code/series?page=f-score: badges and the Piotroski breakdown — useStockPageDigest
// pre-warms those caches from it too; the 20-quarter score-history group it also used to carry
// went away with the history table itself on 2026-09-20, see below). Headings are
// question-form with a number-led answer since the SEO build's document rebuild the same day.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

// 'f-score' isn't a digest page（no lead sentence, no digest section）— only its series payload
// is used; the description below is this page's own.
const { series } = await useStockPageDigest(code, 'f-score', { shortName: stockShortName })
const payload = computed(() => series.value ?? null)

// The badge's own catalog definition（name/author/summary/criterion/source link）— the same
// buildGuruBadges() every badge UI on this site reads, so the methodology text has one source.
const badgeDefinition = computed(() => buildGuruBadges(filterSchema.value?.categories ?? []).find(badge => badge.id === PIOTROSKI_METRIC_CODE) ?? null)
// The badge's OWN threshold source (catalog `badge.sourceUrl`, 2026-09-20) — never the metric's
// referenceUrl, which answers "what is this metric" rather than "why is the threshold ≥ 8". Renders
// nothing when absent; see GuruBadge.sourceUrl's own comment.
const sourceUrl = computed(() => badgeDefinition.value?.sourceUrl ?? null)

// 優點與限制 section (2026-09-20 per direct request: "我希望能夠加上依照這個「指標」判斷的優點與
// 缺點") — the 限制/常見誤讀 halves are rendered VERBATIM from GET /metrics' own `limitations`
// and `misreadings` fields (the same two fields /metrics/{code} explainer pages already render),
// never rewritten here: they're analysis-ts's own compliance-reviewed text about what this
// indicator can and can't answer, and paraphrasing a limitation is exactly how a limitation stops
// being one. The 優點 half has no backing field of its own on the catalog — it's written here as
// plain properties of the method (public fixed rules, uniform across companies, every signal
// traceable to a filing, direction of change visible over time), never an outcome claim, per this
// app's own compliance register.
const metricEntry = computed(() => findMetricInSchema(filterSchema.value?.categories ?? [], PIOTROSKI_METRIC_CODE)?.metric ?? null)
const limitationsText = computed(() => metricEntry.value?.limitations ?? null)
const misreadingsText = computed(() => metricEntry.value?.misreadings ?? null)

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


function stateText(passed: boolean | null): string {
  return passed === null ? '無資料' : passed ? '符合' : '未符合'
}

function stateMark(passed: boolean | null): string {
  return passed === null ? '—' : passed ? '✓' : '✗'
}

// Answers（number-led, no adjectives）for the three question headings.
const scoreAnswer = computed(() => {
  if (scoreValue.value === null) return null
  return joinClauses([
    `${stockShortName.value}目前的 Piotroski F-Score 為 ${scoreValue.value}／9 分`,
    periodLabel.value ? `財報期別 ${periodLabel.value}` : null,
    knowledgeDate.value ? `揭露日 ${knowledgeDate.value}` : null,
    badgeDefinition.value ? `徽章門檻「${badgeDefinition.value.threshold.description}」本期${scorePassed.value === null ? '無法判定' : scorePassed.value ? '符合' : '未符合'}` : null
  ])
})

const signalsAnswer = computed(() => {
  if (!signalGroups.value.length) return null
  return `9 項訊號符合 ${metCount.value} 項：${signalGroups.value.map(group => `${group.name} ${group.met}／${group.denominator}`).join('、')}。`
})

const description = computed(() => {
  if (scoreValue.value === null) return null
  const groupText = signalGroups.value.map(group => `${group.name} ${group.met}／${group.denominator}`).join('、')
  const period = periodLabel.value ? `${periodLabel.value} ` : ''
  return clampDescription(`${stockShortName.value}（${code.value}）Piotroski F-Score：${period}得分 ${scoreValue.value}／9，9 項訊號符合 ${metCount.value} 項${groupText ? `；${groupText}` : ''}。`)
})

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: BADGE_PAGE?.titleKeywords ?? 'Piotroski F-Score 9 項訊號',
  pathSuffix: `/${BADGE_PAGE?.slug ?? 'f-score'}`,
  stock,
  summary,
  description,
  noindex: computed(() => !isFScorePilotSymbol(code.value)),
  sectorCode: computed(() => profile.value?.industry ?? null)
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
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-f-score-current" :question="`${stockShortName}（${code}）的 Piotroski F-Score 幾分？`" :answer="scoreAnswer">
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
      </StockQuestionSection>

      <StockQuestionSection id="stock-f-score-signals" question="9 項訊號哪些通過？" :answer="signalsAnswer">
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
      </StockQuestionSection>

      <StockQuestionSection id="stock-f-score-pros-cons" question="用 F-Score 判斷有什麼優點與限制？">
        <div class="f-score-page__pros-cons">
          <section class="f-score-page__pros-cons-block" aria-labelledby="f-score-pros-heading">
            <h3 id="f-score-pros-heading" class="f-score-page__pros-cons-title">優點</h3>
            <ul class="f-score-page__pros-cons-list">
              <li>9 項訊號的規則公開且固定，每一家公司都用同一套標準計算，不含本站自訂的判斷。</li>
              <li>每一項訊號都能回溯到財報的原始數字，上方「9 項訊號哪些通過？」逐項列出通過與否。</li>
              <li>分數是逐季計算的，看得出財務體質是往改善還是往退步的方向走，不只是單一時點的高低。</li>
            </ul>
          </section>

          <section v-if="limitationsText" class="f-score-page__pros-cons-block" aria-labelledby="f-score-limits-heading">
            <h3 id="f-score-limits-heading" class="f-score-page__pros-cons-title">限制</h3>
            <p class="stock-answer">{{ limitationsText }}</p>
          </section>

          <section v-if="misreadingsText" class="f-score-page__pros-cons-block" aria-labelledby="f-score-misreadings-heading">
            <h3 id="f-score-misreadings-heading" class="f-score-page__pros-cons-title">常見誤讀</h3>
            <p class="stock-answer">{{ misreadingsText }}</p>
          </section>
        </div>
      </StockQuestionSection>

      <StockQuestionSection id="stock-f-score-method" question="Piotroski F-Score 是怎麼算的？">
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
      </StockQuestionSection>

      <p class="stock-page-section__link">
        <NuxtLink :to="`/stock/${code}`">回 {{ stockShortName }} {{ code }} 的財報亮點與風險</NuxtLink>
      </p>
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

.f-score-page__pros-cons {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.f-score-page__pros-cons-title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 40em cap removed 2026-09-20 with every other one — see main.css's .hub-answer comment. */
.f-score-page__pros-cons-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
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

.f-score-page__disclaimer {
  margin: 12px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}
</style>
