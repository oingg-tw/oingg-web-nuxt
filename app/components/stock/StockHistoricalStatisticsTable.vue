<script setup lang="ts">
import { Right } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import { useMetricProvenance } from '~/composables/stock/useMetricProvenance'
import type { MetricProvenanceEntry } from '~/composables/stock/useMetricProvenance'
import { jumpToStatementRow } from '~/composables/stock/useStatementRowFocus'
import type { StockQuarter } from '~/composables/stock/useStockPeriodSelection'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'
import { bySort, metricDisplayName } from '~/composables/screener/useFilterSchema'
import type { FilterMetric } from '~/composables/screener/useFilterSchema'
import { metricHasProvenance } from '~/utils/guru-badges'
import { useHistoricalStatisticsWindow } from '~/composables/stock/useHistoricalStatisticsTableState'
import type { MetricsHistoryTimeframe } from '~/composables/stock/useMetricsHistory'

// 表格模式 (2026-09-13 direct request: "卡片 會計 顯示模式 中間又要把 表格 加上去了") —
// StockExperienceMode had a three-way 簡易/專家/會計 split once before, collapsed to two
// (see useStockExperienceMode.ts's own comment) because 簡易/專家 never actually differentiated
// any content. This reinstates a third value with real, distinct content this time: not another
// card layout, but a table whose entire job is bridging 卡片模式's computed ratios to 會計模式's
// raw filed figures — "這些數字才又可以指向會計。變成稽核鏈".
//
// Renamed from StockIndicatorAuditTable.vue / "指標稽核表" the same day per direct follow-up
// ("命名不叫稽核表 叫做 歷年統計表之類的"), redesigned to multiple historical periods as columns
// per the user's TradingView financials-statistics-and-ratios reference.
//
// Indicator picker REMOVED 2026-09-13 ("選擇指標這個選單就拿掉。要加上TTM與單季的選項") — once
// the table already defaulted to showing every available indicator (see MEMORY history), a
// checkbox picker for narrowing them down stopped earning its keep. That TTM/單季 timeframe toggle
// was ITSELF removed 2026-09-14 per direct follow-up ("歷年統計表的 資料與API 要調整 改成 不讓
// 用戶選擇 單季 近四季 畢竟都顯示五年資料了 最新那一季 統一用 TTM 呈現 也不給改") — removing the
// USER-FACING toggle was the actual request; an early implementation over-read that as "hardcode
// every row to TTM," which silently dropped 48 of ~86 real metrics with no TTM field at all (real
// bug reported live the same day: "前端徽章抓甚麼不要寫死" / "後端剛新增了tobinQ現在前端沒見到")
// — see resolveFieldKey()'s own comment for the actual fix: timeframe resolved PER METRIC now (TTM
// preferred, Q fallback), still with no user control over it.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)

const { data: filterSchema } = await useFilterSchema()

interface AvailableIndicator {
  code: string
  category: string
  name: string
  // Metric-level unit is a literal display suffix already ("%"/"倍"/"元"/"無單位"/etc — confirmed
  // live 2026-09-13, NOT a semantic keyword like OrganismResultTable.vue's older field-level
  // 'percent' convention), so formatValue() below can append it directly. Real bug caught live
  // while adding the (now-removed) picker: an earlier version of this file hardcoded a trailing
  // "%" on every value, which was only ever correct for the original hardcoded ROE-family
  // default — adding 倍-denominated metrics like PER then displayed nonsense like "27.51%" for a
  // P/E ratio.
  unit: string
  // Whether GET /stocks/:symbol/metric-provenance supports this metricCode — read straight off
  // FilterMetric.hasProvenance (see that field's own comment for why this replaced a hardcoded
  // allowlist 2026-09-14: a real bug where payablesTurnover got provenance support server-side
  // but this table never noticed because it wasn't in the old hand-maintained set).
  hasProvenance: boolean
  // Which timeframe THIS metric's own row actually reads — resolved per-metric below, never a single
  // hardcoded value applied to everything.
  fieldKey: MetricsHistoryTimeframe
}

// 每年/每季 column granularity — added 2026-09-14 per direct request ("右上角加上要抓過去每季
// 或是過去每年，預設每年"). Declared here (not down near periodColumns) because it now also
// decides which BASIS each row reads, not just which periods become columns — see
// resolveFieldKey()'s own comment right below for why.
type Granularity = '每年' | '每季'
// Default flipped 每年→每季 2026-09-14 per direct request across all cards ("針對所有卡片，都先
// 幫我改成單季呈現或是預設單季") — same 稽核鏈 reasoning as every other timeframe default flip today
// ("因為要落實稽核鍊就不可能總是呈現近四季給用戶"): 每季 reads each metric's own single-quarter
// figure, which maps back to one real filed disclosure; 每年 reads TTM, a multi-quarter rolling
// aggregate that doesn't. Still user-toggleable, just a different default.
// Flipped BACK 每季→每年 2026-09-18 per direct follow-up ("歷史統計表 優先顯示每年") — back to
// this feature's own original default described in the comment above.
const granularity = ref<Granularity>('每年')

// Real bug fixed 2026-09-14, corrected again the same day once the user caught a wrong
// description ("優先TTM，無TTM則採單季 這個描述是錯的，只有在 每年 的時候 才用 TTM 呈現最新一季
// 的數字 其他 都是 該季") — the actual intended rule is NOT "prefer TTM everywhere": only 每年
// mode reads TTM (including its own trailing latest-quarter column, per the very first request
// this feature came from: "每年的時候，最新那一季 呈現 TTM 的數字"); 每季 mode reads each
// quarter's own single-quarter (Q) figure — showing a TTM number for one季 in 每季 mode would be
// a trailing-12-month total mislabeled as "this quarter," not a per-quarter breakdown at all.
// Falls back to the OTHER timeframe only for the handful of metrics that don't have the preferred one
// at all (e.g. grahamNumber only ever exposes TTM, never Q; tobinsQ only ever exposes Q, never
// TTM — a live count found 48 of ~86 real metrics with no TTM field, and a smaller set with no Q
// field) — this fallback is what stops a metric from silently vanishing from the table depending
// on which granularity happens to be selected (the original bug reported live: "前端徽章抓甚麼
// 不要寫死" / "後端剛新增了tobinQ現在前端沒見到"). Metrics whose only real period grain is
// something this table can't display as a fiscal-quarter column at all (FY/EOD/rolling-window —
// e.g. chowderNumber/dividendYield/beta) still have no row here regardless of granularity; that's
// a genuinely different period model, not something a timeframe fallback can paper over.
function resolveFieldKey(metric: FilterMetric, mode: Granularity): MetricsHistoryTimeframe | null {
  const keys = metric.fields.map(field => field.key)
  const preferred: MetricsHistoryTimeframe = mode === '每年' ? 'TTM' : 'Q'
  const fallback: MetricsHistoryTimeframe = preferred === 'TTM' ? 'Q' : 'TTM'
  if (keys.includes(preferred)) return preferred
  if (keys.includes(fallback)) return fallback
  return null
}

const availableIndicators = computed<AvailableIndicator[]>(() => {
  const list: AvailableIndicator[] = []
  for (const category of filterSchema.value?.categories ?? []) {
    for (const metric of bySort(category.metrics)) {
      const fieldKey = resolveFieldKey(metric, granularity.value)
      if (fieldKey) {
        list.push({ code: metric.key, category: category.name, name: metricDisplayName(metric), unit: metric.unit, hasProvenance: metricHasProvenance(metric), fieldKey })
      }
    }
  }
  return list
})

// Same 近1/2/3/5/8年 lookback convention as every other stock-detail history chart (see
// SharedLookbackWindowSelect.vue's own comment) — quarterly cadence, years×4.
const activeWindow = useHistoricalStatisticsWindow()
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeWindow.value] * 4)

// Two separate fetches, one per resolved timeframe (see resolveFieldKey's own comment for why a
// single shared timeframe no longer works) — bff-ts's own metrics-history endpoint takes ONE timeframe
// per request for however many metricCodes it's given, so metrics needing different bases can't
// share one call. Both still get useMetricsHistory's own ≤10-metricCodes-per-request chunking
// internally; this is one level up from that, not a replacement for it.
const ttmCodes = computed(() => availableIndicators.value.filter(indicator => indicator.fieldKey === 'TTM').map(indicator => indicator.code))
const qCodes = computed(() => availableIndicators.value.filter(indicator => indicator.fieldKey === 'Q').map(indicator => indicator.code))
const ttmBasisRef = ref<MetricsHistoryTimeframe>('TTM')
const qBasisRef = ref<MetricsHistoryTimeframe>('Q')
const { data: ttmHistoryData, pending: ttmHistoryPending, total: ttmHistoryTotal } = useMetricsHistory(symbolRef, ttmCodes, ttmBasisRef, limit)
const { data: qHistoryData, pending: qHistoryPending, total: qHistoryTotal } = useMetricsHistory(symbolRef, qCodes, qBasisRef, limit)

// Merges the two bases' own entries by fiscalYear/fiscalQuarter — same reasoning as
// useMetricsHistory.ts's own cross-chunk merge (a metric's chunk can independently come back
// empty without misaligning the rest), just one level up since these are two separate composable
// instances instead of chunks of the same one.
const historyData = computed<MetricsHistoryEntry[]>(() => {
  const byPeriod = new Map<string, MetricsHistoryEntry>()
  for (const entries of [ttmHistoryData.value ?? [], qHistoryData.value ?? []]) {
    for (const entry of entries) {
      const key = `${entry.fiscalYear}-${entry.fiscalQuarter}`
      const existing = byPeriod.get(key)
      if (existing) Object.assign(existing.values, entry.values)
      else byPeriod.set(key, { fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter, values: { ...entry.values } })
    }
  }
  return [...byPeriod.values()].sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter)
})
// Destructured to top-level bindings (not kept as a nested `history.pending` object property) so
// the template's `v-loading="historyPending"` auto-unwraps correctly — a nested ref accessed as
// `history.pending` in a template does NOT auto-unwrap (only top-level <script setup> bindings
// do), so v-loading would otherwise bind to the Ref object itself (always truthy) instead of its
// value, leaving the loading mask stuck forever. Real bug caught live 2026-09-13 while verifying
// this component with Playwright — the mask never cleared, blocking every click.
const historyPending = computed(() => ttmHistoryPending.value || qHistoryPending.value)
const historyTotal = computed(() => {
  const totals = [ttmHistoryTotal.value, qHistoryTotal.value].filter((value): value is number => value !== null)
  return totals.length ? Math.max(...totals) : null
})

// Same "genuine period count, not just a rough threshold" rule as every other lookback selector
// here (see feedback memory on this) — a symbol with real data back only, say, 24 quarters would
// otherwise let 近8年 be picked and just silently show mostly blank columns.
const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => historyTotal.value !== null && historyTotal.value! < years * 4)
)

// bff-ts's GET /stocks/:symbol/metrics-history returns OLDEST-first (ascending) whenever more
// than one entry comes back — real bug caught live 2026-09-13 while verifying this component:
// an earlier single-entry (limit=1) test on this same endpoint made it LOOK newest-first (with
// exactly one entry, "first" and "last" are the same thing), which is why an earlier version of
// this file wrongly reversed this array and read `[0]` as "latest." Live curl with limit=20
// confirmed the true order is ascending (2021 Q3 → 2026 Q2), which is already exactly what this
// table wants for left-to-right columns — no reverse needed, and "latest" is the LAST element.
const chronological = computed(() => historyData.value ?? [])
const latestEntry = computed(() => {
  const list = historyData.value
  return list && list.length > 0 ? list[list.length - 1]! : null
})

function periodKey(entry: MetricsHistoryEntry): string {
  return `${entry.fiscalYear}-${entry.fiscalQuarter}`
}

interface PeriodColumn {
  key: string
  label: string
  isLatest: boolean
}

// 每年 (default): one column per COMPLETED fiscal year (its Q4 TTM snapshot, which is that
// year's full-year figure) — matching TradingView's own annual-column layout — plus always one
// trailing column for the single latest available quarter, even mid-year, since that's the only
// period GET /stocks/:symbol/metric-provenance can ever explain (it always answers "what is the
// CURRENT computed value based on", not an arbitrary past quarter). If the latest quarter already
// IS a Q4, it's already the last item in the year-end list — not duplicated. Per direct follow-up
// the same day ("每年的時候，最新那一季 呈現 TTM 的數字") — that trailing quarter column reads
// TTM same as every other column in 每年 mode (see resolveFieldKey's own comment above).
//
// 每季: every fetched quarter becomes its own column instead of collapsing to one per year — each
// reading that quarter's own single-quarter (Q) figure instead, not TTM (again see
// resolveFieldKey's own comment above).
const periodColumns = computed<PeriodColumn[]>(() => {
  if (granularity.value === '每季') {
    return chronological.value.map((entry, index) => ({
      key: periodKey(entry),
      label: `${entry.fiscalYear} Q${entry.fiscalQuarter}`,
      isLatest: index === chronological.value.length - 1
    }))
  }
  const yearEnds = chronological.value.filter(entry => entry.fiscalQuarter === 4)
  const columns = yearEnds.map(entry => ({ key: periodKey(entry), label: `${entry.fiscalYear}`, isLatest: false }))
  const latest = latestEntry.value
  if (latest && latest.fiscalQuarter !== 4) {
    columns.push({ key: periodKey(latest), label: `${latest.fiscalYear} Q${latest.fiscalQuarter}`, isLatest: true })
  } else if (columns.length > 0) {
    columns[columns.length - 1]!.isLatest = true
  }
  return columns
})

interface Row {
  code: string
  name: string
  // Only metrics with FilterMetric.hasProvenance true get an audit-chain expand row (see
  // AvailableIndicator's own comment) — every other selected indicator renders every column's
  // value as plain text, no control that always 400s against metric-provenance.
  hasProvenance: boolean
  unit: string
  // Keeps `nullReason` alongside the value (not just the bare number) — real gap fixed 2026-09-13
  // per direct follow-up ("歷年統計表 一怎麼看出示缺少值 還是 不適用?"): a null cell used to
  // always render as a bare "－" with zero indication of WHY, even though
  // GET /stocks/:symbol/metrics-history already returns a `nullReason` string for every null
  // (confirmed live: 中信金 2891's altmanZScore comes back `nullReason: "insufficient_history"`,
  // a distinct case from a genuine "沒有回填" data gap for a plain metric). See formatValue()'s
  // own comment for the interim display rule pending analysis-ts's answer on the full enum.
  valueByPeriodKey: Record<string, { value: number | null; nullReason: string | null }>
  // Set on a synthetic row inserted before each new category's first real row — see rows' own
  // comment below. Every other field is meaningless on a header row (never read for one).
  isCategoryHeader?: boolean
}

// Per direct follow-up 2026-09-13 ("指標 請分類呈現") — inserts one synthetic full-row category
// label ahead of each group's first real indicator, matching the exact category grouping the
// "選擇指標" picker dialog below already uses. Not a real el-table row-grouping feature (element-
// plus has none) — a plain row with `isCategoryHeader: true` that the template renders as a
// bold label with every other cell left blank, cheaper and lower-risk than a colspan/span-method
// merge across a mix of a type="expand" column and a variable-length period-column set.
const rows = computed<Row[]>(() => {
  const list: Row[] = []
  let lastCategory: string | null = null
  for (const indicator of availableIndicators.value) {
    if (indicator.category !== lastCategory) {
      list.push({ code: `category:${indicator.category}`, name: indicator.category, hasProvenance: false, unit: '', valueByPeriodKey: {}, isCategoryHeader: true })
      lastCategory = indicator.category
    }
    const valueByPeriodKey: Record<string, { value: number | null; nullReason: string | null }> = {}
    for (const entry of chronological.value) {
      const point = entry.values[indicator.code]
      // `point` itself missing (bare JSON null, or the key absent) is a DIFFERENT situation from
      // "computed and explicitly nullReason'd" per analysis-ts's own warning 2026-09-13 — it
      // means this period has no computation record for this metric at all (e.g. this metric's
      // whole chunk came back with an empty `entries` array — see useMetricsHistory.ts's own
      // comment on why chunks can independently fail/return nothing). Tagged with a sentinel
      // reason (never a real analysis-ts value — their real enum is exactly 4 values, see
      // NULL_REASON_LABELS below) so titleForValue() can tell it apart from a real nullReason.
      valueByPeriodKey[periodKey(entry)] = point
        ? { value: point.value, nullReason: point.nullReason }
        : { value: null, nullReason: '__no_record__' }
    }
    list.push({
      code: indicator.code,
      name: indicator.name,
      hasProvenance: indicator.hasProvenance,
      unit: indicator.unit,
      valueByPeriodKey
    })
  }
  return list
})

// Checked live 2026-09-13 at ~400px width: only the 指標 column and one period column are
// initially visible with no visible scrollbar — this looked like a bug at first glance but isn't
// one. el-table renders at its container's width and scrolls the rest internally via its own
// `.el-scrollbar__wrap` (confirmed via direct DOM inspection: scrollWidth 788 vs a 311px
// container, overflow-x: auto) — the columns are all there and reachable by swipe/scroll, there
// was just no visible affordance hinting that (see the intro text's own "可左右滑動" addition).
// doLayout() kept here anyway as the same defensive column-width-recalculation aid this app uses
// elsewhere (ValuationRankingCard.vue/DisposedStocksCard.vue/OrganismResultTable.vue) for when
// `data`/columns change after first paint — e.g. picking a different indicator set or lookback
// window — even though it wasn't the fix for the specific "looks broken" report above.
const tableRef = ref<TableInstance>()
watch([rows, periodColumns], () => nextTick(() => tableRef.value?.doLayout()))

// Which row is currently expanded — el-table's own `expand-row-keys` (not `default-expand-all`)
// so opening one row doesn't require re-rendering every other row's own expand slot.
const expandedRowKeys = ref<string[]>([])
function toggleExpand(row: Row) {
  if (!row.hasProvenance) return
  expandedRowKeys.value = expandedRowKeys.value.includes(row.code) ? [] : [row.code]
}

// Only ever set to the single currently-expanded row's own code (or null) — useMetricProvenance
// fires its own request the moment this changes, matching StockGuruBadgeCategoryCard.vue's own
// "fetch only the one thing currently open" pattern rather than eagerly fetching all of them.
const expandedMetricCode = computed(() => expandedRowKeys.value[0] ?? null)
const { data: provenance, pending: provenancePending } = useMetricProvenance(symbolRef, expandedMetricCode)

// Full nullReason enum confirmed by analysis-ts 2026-09-13 (metricNullReasonSchema in their own
// metricBasis.ts, exactly these 4 values, nothing else) — only 'not_applicable_industry' means
// "this metric's model doesn't conceptually apply to this company" (currently only the 5
// crisis-warning models — Altman Z/Z″/Beneish M/Ohlson O/Zmijewski — excluding financial/
// insurance stocks); the other 3 are all still "a real number, just not computable this period"
// for different underlying reasons. Only the industry-inapplicable case gets a distinct in-cell
// label ("不適用") — cluttering every other null cell with 3 different dash-alternatives would
// hurt scannability of an already-dense table more than it'd help, so those stay a plain "－"
// with the specific Chinese reason available via titleForValue()'s tooltip instead.
const NULL_REASON_LABELS: Record<string, string> = {
  missing_input: '計算所需的原始申報欄位缺值',
  zero_or_negative_denominator: '分母為零或負值，比率無意義',
  not_applicable_industry: '依產業別，此指標的模型前提不適用於本公司',
  insufficient_history: '可比較的歷史資料深度不足',
  // Not a real analysis-ts value — see rows' own comment on why this sentinel exists (a period
  // with literally no computation record for this metric, distinct from a real null-with-reason).
  __no_record__: '此期別尚無此指標的計算紀錄'
}

function formatValue(point: { value: number | null; nullReason: string | null }, unit: string): string {
  if (point.value !== null) {
    const suffix = unit === '無單位' ? '' : unit
    return `${formatSignificantDigits(point.value, 4)}${suffix}`
  }
  return point.nullReason === 'not_applicable_industry' ? '不適用' : '－'
}

function titleForValue(point: { value: number | null; nullReason: string | null }): string | undefined {
  if (point.value !== null || !point.nullReason) return undefined
  return NULL_REASON_LABELS[point.nullReason] ?? `原因代碼：${point.nullReason}`
}

const EMPTY_POINT = { value: null, nullReason: null }
function pointFor(row: Row, periodKeyValue: string): { value: number | null; nullReason: string | null } {
  return row.valueByPeriodKey[periodKeyValue] ?? EMPTY_POINT
}

function formatProvenanceValue(raw: string | number): string {
  const value = Number(raw)
  return Number.isFinite(value) ? formatSignificantDigits(value, 4) : String(raw)
}

// Same jump as StockGuruBadgeCategoryCard.vue's own openProvenanceEntry — closes nothing here
// (this table has no dialog on top of it to close), jumpToStatementRow itself navigates to
// financial-statements.vue (2026-09-18: no longer just flipping an experienceMode ref, now that
// 會計模式 is its own route — see that function's own comment) and scrolls to the matched row.
function openProvenanceEntry(entry: MetricProvenanceEntry): void {
  if (entry.type !== 'statementField' || !entry.statementType || !entry.fieldKey) return
  jumpToStatementRow({
    statementType: entry.statementType,
    rowKey: entry.fieldKey,
    year: entry.fiscalYear,
    quarter: entry.fiscalQuarter as StockQuarter
  })
}

</script>

<template>
  <el-card
    v-loading="historyPending"
    class="historical-statistics-table"
    shadow="never"
    :body-style="{ display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0', overflow: 'hidden' }"
  >
    <template #header>
      <div class="historical-statistics-table__header">
        <!-- Renamed 歷年統計表→歷史統計表 2026-09-14 per direct request, same batch as the
             新 每年/每季 granularity selector below — "歷年" implied one-column-per-year even
             before 每季 existed as an option; "歷史" is neutral to either granularity. The title
             itself is StockCardTitle's <h3> (2026-09-19, same as every other stock card); the
             timeframe tag stays a sibling so it never becomes part of the heading's name. -->
        <div class="historical-statistics-table__title">
          <StockCardTitle title="歷史統計表" />
          <!-- Added 2026-09-14 (reported live: "哪邊可以讓用戶知道這是近四季的數字") — the
               TTM/單季 toggle that used to make this visible was removed the same day. Made
               DYNAMIC the same day once granularity started deciding the timeframe too (see
               resolveFieldKey's own comment) — a static "TTM（近四季）" or "優先TTM，無TTM則採
               單季" is wrong half the time now; this just states outright which timeframe 每年/每季
               mode actually reads. Label simplified 「TTM（近四季）」→「近四季」later the same day
               per direct request ("TTM 以後都改名叫 近四季") — "TTM" no longer appears in any
               user-visible label anywhere in this app, only as an internal value/field key. -->
          <el-tag size="small" type="info" class="historical-statistics-table__timeframe-tag">
            {{ granularity === '每年' ? '近四季' : '單季' }}
          </el-tag>
        </div>
        <div class="historical-statistics-table__header-actions">
          <!-- 每年/每季 column-granularity selector, added 2026-09-14 per direct request ("右上角
               加上要抓過去每季 或是過去每年，預設每年") — see resolveFieldKey's own comment for
               why this now decides each row's BASIS too, not just which periods become columns. -->
          <el-select v-model="granularity" size="default" class="historical-statistics-table__granularity-select" aria-label="欄位期別（每年或每季）">
            <el-option label="每年" value="每年" />
            <el-option label="每季" value="每季" />
          </el-select>
          <SharedLookbackWindowSelect v-model="activeWindow" :disabled-years="disabledYears" />
        </div>
      </div>
    </template>

    <p class="historical-statistics-table__intro">
      最新一期（標示為粗體）的數值點擊後可展開計算依據，並可直接跳轉至會計模式對應的原始申報科目與期別；欄位較多時可左右滑動表格查看。「不適用」代表該指標依產業別不適用（如金融業的部分財務韌性指標），「－」代表其他原因暫無數值；滑鼠移到「－」上可查看詳細原因。
    </p>

    <!-- `height="100%"` (not a viewport calc() here) — the OUTER `.historical-statistics-table`
         card below is the one bound to the viewport (sticky + a real calc() height, see its own
         style comment); this table just fills whatever vertical space that card's flex layout
         gives it, so header (標題/近5年 controls) + intro text can take their own natural height
         first without the table's own fixed height double-counting them. -->
    <el-table
      ref="tableRef"
      :data="rows"
      size="small"
      row-key="code"
      height="100%"
      :expand-row-keys="expandedRowKeys"
      :row-class-name="({ row }) => (row.isCategoryHeader ? 'historical-statistics-table__category-row' : '')"
    >
      <!-- Left-frozen 2026-09-15 per direct request ("歷史統計表 表頭要凍結") — real bug found
           live testing this: el-table's own `height="100%"` already freezes the COLUMN header row
           while scrolling rows vertically (confirmed working before this change), but the 指標
           label column itself had no `fixed` prop, so scrolling horizontally through the 40+
           quarterly columns (近10年 view) scrolled the row's own name off-screen along with the
           data — there was no way to tell which metric a value on the right edge belonged to.
           Fixing both this column and 指標 below (not just 指標 alone) keeps the expand-arrow and
           the row label moving together as one visual unit instead of splitting the frozen/
           scrolling boundary in the middle of a row's own identity. -->
      <el-table-column type="expand" fixed="left">
        <template #default="{ row }">
          <div v-if="!row.isCategoryHeader" v-loading="provenancePending" class="historical-statistics-table__expand">
            <template v-if="provenance?.found && provenance.entries.length > 0">
              <ul class="historical-statistics-table__entries">
                <li v-for="(entry, index) in provenance.entries" :key="index">
                  <button
                    v-if="entry.type === 'statementField'"
                    type="button"
                    class="historical-statistics-table__entry-link"
                    @click="openProvenanceEntry(entry)"
                  >
                    <span>{{ entry.role }}：{{ formatProvenanceValue(entry.value) }}</span>
                    <el-icon><Right /></el-icon>
                  </button>
                  <span v-else class="historical-statistics-table__entry-text">
                    {{ entry.role }}：{{ formatProvenanceValue(entry.value) }}（{{ entry.sourceDescription }}）
                  </span>
                </li>
              </ul>
              <p v-if="provenance.methodologyNote" class="historical-statistics-table__note">{{ provenance.methodologyNote }}</p>
            </template>
            <!-- Real bug fixed 2026-09-14 (reported live: "應付帳款週轉率 有稽核下拉選單 點開卻沒有
            東西") — this fallback used to only fire on `!provenance?.found`, so a response that
            comes back `found: true` with an empty `entries` array (a genuine possible shape per
            MetricProvenanceResponse's own type, not just a found/not-found boolean) rendered
            nothing at all: the `found` branch above ran but its `v-for` had zero items to loop
            over, and this message's own `v-else-if` never fired because `found` was true. Now
            covers that case too instead of only the literal not-found one. -->
            <p v-else-if="!provenancePending" class="historical-statistics-table__note">
              {{ row.name }}目前查無可回溯的原始申報資料。
            </p>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="指標" min-width="140" fixed="left">
        <template #default="{ row }">
          <span :class="row.isCategoryHeader ? 'historical-statistics-table__category-label' : 'historical-statistics-table__name'">{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column
        v-for="period in periodColumns"
        :key="period.key"
        :label="period.label"
        align="right"
        min-width="100"
      >
        <template #default="{ row }">
          <template v-if="!row.isCategoryHeader">
            <button
              v-if="period.isLatest && row.hasProvenance"
              type="button"
              class="historical-statistics-table__value-link"
              :aria-expanded="expandedRowKeys.includes(row.code)"
              :title="titleForValue(pointFor(row, period.key))"
              @click="toggleExpand(row)"
            >
              {{ formatValue(pointFor(row, period.key), row.unit) }}
              <el-icon><Right /></el-icon>
            </button>
            <span
              v-else
              class="historical-statistics-table__value"
              :class="{ 'historical-statistics-table__value--latest': period.isLatest }"
              :title="titleForValue(pointFor(row, period.key))"
            >
              {{ formatValue(pointFor(row, period.key), row.unit) }}
            </span>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<style scoped>
/* Sticky + viewport-bound height added 2026-09-14 per direct request ("歷年統計表 還是要可以
   scroll 喔。一樣要貼頂，下緣貼底那種") — this table can run to 70+ rows, and the 近5年/近10年
   control (the TTM/單季 toggle that used to sit beside it was removed the same day, see
   resolveFieldKey's own comment above) lives in this card's own #header slot ("因為要把 年分與 period選項曝露讓
   用戶能操作"), so pinning the whole card (not just internally scrolling the row list) keeps
   it reachable the entire time the user is scrolling through rows, instead of scrolling away
   with the rest of the page after the first screenful. `top` matches the same
   fixed app-shell header offset this page's other sticky elements use (StockSummaryCard.vue's own
   sticky bar). Real fixed height (not just `el-table`'s own, see that element's own comment) is
   required here so the card's IN-FLOW box reserves exactly this much vertical space — that's what
   keeps 公司基本資料 (this table's next sibling in stock/[code].vue) from being covered: once
   scrolled past this card's own sticky range, it releases and 公司基本資料 continues in normal
   flow right after, with the existing `.stock-detail-page__profile` top margin as the gap between
   them, same as any other non-sticky sibling pair on this page. */
.historical-statistics-table {
  position: sticky;
  top: calc(var(--app-header-height) + var(--app-banner-height));
  height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 32px);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
}

.historical-statistics-table__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.historical-statistics-table__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 600;
}

.historical-statistics-table__timeframe-tag {
  font-weight: 400;
}

.historical-statistics-table__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.historical-statistics-table__granularity-select {
  width: 90px;
}

.historical-statistics-table__intro {
  flex-shrink: 0;
  margin: 0 0 12px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

/* el-table's own `height="100%"` (see that element's own template comment) only resolves against
   a definite flex-basis — without flex:1/min-height:0 here, the table would collapse to its
   content's natural (unbounded) height instead of filling the card's remaining space, which is
   exactly what min-height:0 exists to override on a flex child that itself contains a scrolling
   region. */
.historical-statistics-table :deep(.el-table) {
  flex: 1;
  min-height: 0;
}

.historical-statistics-table__name {
  font-weight: 600;
}

.historical-statistics-table__category-label {
  font-weight: 600;
  color: var(--el-color-primary);
}

/* Synthetic full-row category label (see rows' own comment for why this isn't a real el-table
   grouping/colspan feature) — tinted background + no hover affordance distinguishes it from a
   clickable data row at a glance. */
.historical-statistics-table :deep(.historical-statistics-table__category-row) {
  background: var(--el-fill-color-lighter);
}

.historical-statistics-table :deep(.historical-statistics-table__category-row:hover > td) {
  background: var(--el-fill-color-lighter) !important;
}

.historical-statistics-table__value {
  font-variant-numeric: tabular-nums;
}

.historical-statistics-table__value--latest {
  font-weight: 600;
}

.historical-statistics-table__value-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--el-color-primary);
  cursor: pointer;
}

.historical-statistics-table__value-link:hover {
  text-decoration: underline;
}

.historical-statistics-table__expand {
  padding: 4px 24px;
}

.historical-statistics-table__entries {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.historical-statistics-table__entry-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--el-color-primary);
  cursor: pointer;
}

.historical-statistics-table__entry-link:hover {
  text-decoration: underline;
}

.historical-statistics-table__entry-text {
  color: var(--el-text-color-secondary);
}

.historical-statistics-table__note {
  margin: 8px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}
</style>
