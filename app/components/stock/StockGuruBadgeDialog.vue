<script setup lang="ts">
import { TopRight, Right } from '@element-plus/icons-vue'
import { GURU_BADGE_DISCLAIMER, guruBadgeHasProvenance, guruBadgeMetricCode, PIOTROSKI_FIELD_ID } from '~/utils/guru-badges'
import type { GuruBadge } from '~/utils/guru-badges'
import type { FilterSchema } from '~/composables/screener/useFilterSchema'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'
import type { MetricProvenanceEntry } from '~/composables/stock/useMetricProvenance'
import type { StockQuarter } from '~/composables/stock/useStockPeriodSelection'
import { jumpToStatementRow } from '~/composables/stock/useStatementRowFocus'
import { nullReasonShortText } from '~/utils/metric-null-reason'

// The per-badge detail dialog（比較標準、公式、出處、資料時間、計算依據，and the 9-signal checklist
// for Piotroski）— extracted 2026-09-19 out of StockGuruBadgeCategoryCard.vue, which had been an
// orphan since the badge cards left 公司健檢 on 2026-09-15, so that 財報亮點與風險's own chips can
// open it again (per direct decision:「chip 點開彈窗」). The dialog's content and reasoning are
// that component's, unchanged in substance; only the host moved. Everything below reads from
// caches the host page already filled (the catalog via useNuxtData, badges via
// useStockBadges' cache) — the one extra request, piotroski-breakdown, fires only when the
// Piotroski badge itself is opened.
//
// `badge` is the v-model: the host sets it to open, the dialog emits null on close (X, Esc,
// overlay click, or a provenance jump that navigates away).
const props = defineProps<{
  symbol: string
  badge: GuruBadge | null
}>()

const emit = defineEmits<{
  'update:badge': [value: GuruBadge | null]
}>()

const symbolRef = computed(() => props.symbol)
const { data: schema } = useNuxtData<FilterSchema>('filter-schema')
const categories = computed(() => schema.value?.categories ?? [])
const { data: stockBadges } = useStockBadges(symbolRef)

// Only the Piotroski badge needs the 9-signal breakdown — an undefined symbol keeps
// usePiotroskiBreakdown from fetching at all for every other badge.
const piotroskiSymbol = computed(() => (props.badge?.fieldId === PIOTROSKI_FIELD_ID ? props.symbol : undefined))
const { data: piotroskiBreakdown } = usePiotroskiBreakdown(piotroskiSymbol)

const entry = computed(() => (props.badge ? findStockBadgeEntry(stockBadges.value, guruBadgeMetricCode(props.badge)) : null))

const visible = computed<boolean>({
  get: () => props.badge !== null,
  set: value => {
    if (!value) emit('update:badge', null)
  }
})

// "數字可回溯到原始申報資料" — only for metrics the metric-provenance endpoint covers
// (guruBadgeHasProvenance reads FilterMetric.hasProvenance off the live catalog); a null
// metricCode keeps useMetricProvenance from requesting anything.
const selectedMetricCode = computed(() => (props.badge && guruBadgeHasProvenance(props.badge) ? guruBadgeMetricCode(props.badge) : null))
const { data: provenance } = useMetricProvenance(symbolRef, selectedMetricCode)
const provenanceOpen = ref(false)
watch(() => props.badge, () => {
  provenanceOpen.value = false
})

function unit(badge: GuruBadge): string {
  return locateFieldInSchema(categories.value, badge.fieldId)?.metric.unit ?? ''
}

// `nullReason` straight from GET /stocks/:symbol/badges — 不適用 (industry exclusion) vs 尚無資料.
function currentValueText(badge: GuruBadge): string {
  const value = entry.value?.value ?? null
  if (value === null) return nullReasonShortText(entry.value?.nullReason)
  return `${formatSignificantDigits(value, 3)}${unit(badge)}`
}

const knowledgeDate = computed(() => entry.value?.knowledgeDate ?? null)

interface PiotroskiSignalGroup {
  groupName: string
  signals: { label: string; met: boolean | null }[]
}

const PIOTROSKI_GROUP_ORDER: Array<'profitability' | 'leverageLiquidity' | 'operatingEfficiency'> = ['profitability', 'leverageLiquidity', 'operatingEfficiency']

// Piotroski's 9 signals in the paper's own 3 groups; labels/group names come from the breakdown
// response itself (usePiotroskiBreakdown.ts's signalLabels/groupMetadata), falling back to the
// bare key rather than a hardcoded translation. null for every other badge.
const piotroskiSignalGroups = computed<PiotroskiSignalGroup[] | null>(() => {
  if (props.badge?.fieldId !== PIOTROSKI_FIELD_ID) return null
  const groups = piotroskiBreakdown.value?.groups
  if (!groups) return []
  const labels = piotroskiBreakdown.value?.signalLabels
  const metadata = piotroskiBreakdown.value?.groupMetadata
  return PIOTROSKI_GROUP_ORDER.map(key => ({
    groupName: metadata?.find(item => item.key === key)?.name || key,
    signals: Object.entries(groups[key]).map(([signalKey, met]) => ({ label: labels?.[signalKey] ?? signalKey, met }))
  }))
})

// 4 significant digits (chips use 3) — same overflow reasoning as the former host component.
function formatProvenanceValue(raw: string | number): string {
  const value = Number(raw)
  return Number.isFinite(value) ? formatSignificantDigits(value, 4) : String(raw)
}

// Jumps to 財務報表 at the exact statement row/period this entry came from; closes the dialog
// first since the jump navigates away from it.
function openProvenanceEntry(item: MetricProvenanceEntry): void {
  if (item.type !== 'statementField' || !item.statementType || !item.fieldKey) return
  emit('update:badge', null)
  jumpToStatementRow({
    statementType: item.statementType,
    rowKey: item.fieldKey,
    year: item.fiscalYear,
    quarter: item.fiscalQuarter as StockQuarter
  })
}

const formulaHtml = computed(() => (props.badge ? renderFormulaHtml(locateFieldInSchema(categories.value, props.badge.fieldId)?.metric.formulaLatex, true) : null))
// The badge's OWN threshold source (catalog `badge.sourceUrl`, 2026-09-20). This dialog's
// 「查看公式出處」link is where the reported bug was seen — it used to fall back to the metric's
// referenceUrl, so a reader following it landed on a page that never states the threshold. No
// sourceUrl now renders no link; see GuruBadge.sourceUrl's own comment.
const sourceUrl = computed(() => props.badge?.sourceUrl ?? null)
const hasDistinctNameEn = computed(() => !!props.badge && props.badge.nameEn !== props.badge.name)
</script>

<template>
  <!-- append-to-body so no ancestor's overflow clips it; the header slot's titleId/titleClass keep
       el-dialog's own aria-labelledby pointing at the real title text. -->
  <el-dialog v-model="visible" width="min(600px, 92vw)" align-center append-to-body>
    <template #header="{ titleId, titleClass }">
      <p :id="titleId" :class="[titleClass, 'stock-guru-badge-dialog__title']">{{ badge?.name }}</p>
      <p class="stock-guru-badge-dialog__byline">
        <span v-if="badge"><template v-if="hasDistinctNameEn">{{ badge.nameEn }}｜</template>{{ badge.author }}</span>
        <a
          v-if="sourceUrl"
          :href="sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="stock-guru-badge-dialog__source-link"
        >
          查看公式出處
          <el-icon aria-hidden="true"><TopRight /></el-icon>
        </a>
      </p>
    </template>

    <template v-if="badge">
      <div class="stock-guru-badge-dialog__criteria">
        <p class="stock-guru-badge-dialog__criteria-label">比較標準</p>
        <p class="stock-guru-badge-dialog__criteria-value">{{ badge.threshold.description }}</p>
        <div v-if="piotroskiSignalGroups" class="stock-guru-badge-dialog__signal-groups">
          <div v-for="group in piotroskiSignalGroups" :key="group.groupName" class="stock-guru-badge-dialog__signal-group">
            <p class="stock-guru-badge-dialog__signal-group-name">{{ group.groupName }}</p>
            <ul class="stock-guru-badge-dialog__signal-list">
              <li v-for="signal in group.signals" :key="signal.label" class="stock-guru-badge-dialog__signal">
                <span
                  class="stock-guru-badge-dialog__signal-mark"
                  :class="{ 'is-met': signal.met === true, 'is-unmet': signal.met === false, 'is-unknown': signal.met === null }"
                  aria-hidden="true"
                >
                  {{ signal.met === true ? '✓' : signal.met === false ? '✗' : '—' }}
                </span>
                {{ signal.label }}
                <span class="visually-hidden">{{ signal.met === true ? '符合' : signal.met === false ? '未符合' : '無資料' }}</span>
              </li>
            </ul>
          </div>
        </div>
        <div v-if="formulaHtml" class="stock-guru-badge-dialog__formula" v-html="formulaHtml" />
      </div>

      <p class="stock-guru-badge-dialog__detail">{{ badge.detail }}</p>

      <div v-if="provenance?.found" class="stock-guru-badge-dialog__provenance">
        <button type="button" class="stock-guru-badge-dialog__provenance-toggle" :aria-expanded="provenanceOpen" @click="provenanceOpen = !provenanceOpen">
          {{ provenanceOpen ? '收合計算依據' : '查看計算依據' }}
        </button>
        <div v-if="provenanceOpen" class="stock-guru-badge-dialog__provenance-body">
          <ul class="stock-guru-badge-dialog__provenance-list">
            <li v-for="(item, index) in provenance.entries" :key="index" class="stock-guru-badge-dialog__provenance-entry">
              <button
                v-if="item.type === 'statementField'"
                type="button"
                class="stock-guru-badge-dialog__provenance-link"
                @click="openProvenanceEntry(item)"
              >
                <span>{{ item.role }}：{{ formatProvenanceValue(item.value) }}</span>
                <el-icon aria-hidden="true"><Right /></el-icon>
              </button>
              <span v-else class="stock-guru-badge-dialog__provenance-text">
                {{ item.role }}：{{ formatProvenanceValue(item.value) }}（{{ item.sourceDescription }}）
              </span>
            </li>
          </ul>
          <p v-if="provenance.methodologyNote" class="stock-guru-badge-dialog__provenance-note">{{ provenance.methodologyNote }}</p>
        </div>
      </div>

      <p class="stock-guru-badge-dialog__as-of">
        {{ symbol }} 目前數值：{{ currentValueText(badge) }}
        <template v-if="knowledgeDate">｜資料時間：{{ knowledgeDate }}</template>
      </p>
      <p class="stock-guru-badge-dialog__disclaimer">{{ GURU_BADGE_DISCLAIMER }}</p>
    </template>

    <!-- Visible "關閉" button (2026-09-19, interface-complexity review) — the reference doc wants
         every modal to have an unambiguous, TEXT exit, not just the × in the corner (which this
         dialog still has, via el-dialog's own default — this is an addition, not a replacement). -->
    <template #footer>
      <el-button class="dialog-close-button" @click="visible = false">關閉</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.stock-guru-badge-dialog__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-guru-badge-dialog__byline {
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 16px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-dialog__source-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--el-color-primary-dark-2);
}

.stock-guru-badge-dialog__criteria {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
}

.stock-guru-badge-dialog__criteria-label {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-dialog__criteria-value {
  margin: 4px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

/* Formula is the criteria card's focal point (per the former host's 2026-09-10 rebalancing);
   the tinted box bleeds to the card's own edges via the parent's padding. */
.stock-guru-badge-dialog__formula {
  margin: 12px -16px -12px;
  padding: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  border-radius: 0 0 7px 7px;
  background: var(--el-color-primary-light-9);
  overflow-x: auto;
  text-align: center;
  font-size: 0.875rem;
}

.stock-guru-badge-dialog__signal-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 12px;
}

.stock-guru-badge-dialog__signal-group-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-dialog__signal-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stock-guru-badge-dialog__signal {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  color: var(--el-text-color-regular);
}

.stock-guru-badge-dialog__signal-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  font-weight: 700;
  font-size: 0.875rem;
}

.stock-guru-badge-dialog__signal-mark.is-met {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.stock-guru-badge-dialog__signal-mark.is-unmet {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.stock-guru-badge-dialog__signal-mark.is-unknown {
  background: var(--el-fill-color);
  color: var(--el-text-color-placeholder);
}

.stock-guru-badge-dialog__detail {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.stock-guru-badge-dialog__provenance {
  margin-top: 16px;
}

.stock-guru-badge-dialog__provenance-toggle {
  padding: 0;
  border: none;
  background: transparent;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
  cursor: pointer;
}

.stock-guru-badge-dialog__provenance-body {
  margin-top: 8px;
}

/* Capped + scrollable so a long period list never pushes the dialog's own tail off-screen. */
.stock-guru-badge-dialog__provenance-list {
  list-style: none;
  margin: 0;
  padding: 0 6px 0 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.stock-guru-badge-dialog__provenance-link {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
}

.stock-guru-badge-dialog__provenance-link span {
  flex: 1;
  min-width: 0;
  white-space: normal;
  word-break: break-word;
}

.stock-guru-badge-dialog__provenance-link:hover {
  background: var(--el-fill-color);
  color: var(--el-color-primary-dark-2);
}

.stock-guru-badge-dialog__provenance-text {
  display: block;
  padding: 8px 10px;
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-dialog__provenance-note {
  margin: 8px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

.stock-guru-badge-dialog__as-of {
  margin: 16px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-dialog__disclaimer {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}
</style>
