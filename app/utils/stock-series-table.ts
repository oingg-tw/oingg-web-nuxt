import type { MetricsHistoryEntry, MetricsHistorySeries, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { FilterCategory } from '~/composables/screener/useFilterSchema'
// Pure builders behind StockMetricSeriesTable.vue (2026-09-19, the SEO build): turn the series
// groups a page received from /api/stock/:code/series into table rows. Runs identically on the
// server and the client（no Date, no locale formatting）so the server-rendered table text is
// byte-for-byte what hydration produces.

export interface SeriesTableColumn {
  code: string
  // Catalog display name（EPS／負債比率…）.
  label: string
  // Catalog unit（元／%／倍／分／年／次／天）;「無單位」or '' means none.
  unit: string
  timeframe: MetricsHistoryTimeframe
  // The response group（server plan name）that carries this code.
  group: string
  decimals?: number
}

export interface SeriesTableCell {
  code: string
  value: number | null
  nullReason: string | null
  text: string
  title?: string
}

export interface SeriesTableRow {
  key: string
  label: string
  fiscalYear: number
  fiscalQuarter: number | null
  isLatest: boolean
  cells: SeriesTableCell[]
}

export interface SeriesTableOptions {
  // Newest period first（default for periods-as-rows）.
  latestFirst?: boolean
  // 逐年 mode: every Q4 entry（a Q4 TTM figure is the full fiscal year）plus the latest entry when
  // it isn't a Q4, so the newest quarter is never hidden.
  annual?: boolean
  // Keep only the last N periods（before ordering）.
  maxPeriods?: number
}

// A column whose label/unit come from the metric catalog（the same names the cards and the digest
// use）; the code itself is the fallback label for a code the catalog doesn't know.
export function catalogColumn(categories: FilterCategory[], code: string, group: string, timeframe: MetricsHistoryTimeframe, decimals?: number): SeriesTableColumn {
  const located = findMetricInSchema(categories, code)
  return { code, label: located ? metricDisplayName(located.metric) : code, unit: located?.metric.unit ?? '', timeframe, group, decimals }
}

// 全站唯一一組期別用詞。2026-10-02 之前有三組：這一組、metric-history-points.ts 的
//「近四季合計／單季／會計年度」、以及 StockMetricHistoryChartInteractive.vue 自己的一份
//（跟這一組一字不差）。
//
// **合併方向是由正確性決定的，不是多數決。** 那一組的「近四季合計」對比率型指標是錯的：
// ROE 的近四季是「近四季淨利 ÷ 平均股東權益」，不是四季 ROE 相加，而指標頁絕大多數是比率。
// 它渲染出來就是「以下為 台積電 由新到舊的 股東權益報酬率（近四季合計）」。
//「近四季」對流量型與比率型都成立，所以留這一組。
//
//「年度」而不是「會計年度」：台股上市櫃公司幾乎全是曆年制，而本站的讀者是退休族，平白的詞優先。
// **使用者 2026-10-02 確認「用 年度 就好」**，所以這不是待決定事項。
//
// 同日的一個量測更正，寫在這裡是因為它決定了上面那段的強度：我原本說「合併前兩種詞彙同時渲染在
// 同一頁上」——那是錯的。我用 `curl | grep` 數原始 HTML，而那裡面包含 SSR 序列化的指標型錄
// payload（analysis-ts 自己的 definition／limitations 文案裡有「會計年度」，屬於別的指標）。
// 用瀏覽器量 `document.body.innerText` 之後：`會計年度` 在任何指標頁上都是 **0 次**。
//
// 所以 FY 那個分支在渲染輸出裡確實到不了畫面（我 2026-10-01 的筆記本來就是對的，是我隔天拿壞的
// 量測去「更正」它）。**但這一組合併仍然該做**，理由不變且與 FY 無關：「近四季合計」是真的渲染出來
// 的（每個比率頁 2 次，caption 與開頭那一句），而它對比率是錯的。
//
// 教訓：`curl | grep` 數的是 payload，不是畫面。要主張「讀者看得到」就得量 innerText。
export const TIMEFRAME_WORD: Record<MetricsHistoryTimeframe, string> = {
  TTM: '近四季',
  Q: '單季',
  FY: '年度'
}

export function periodLabel(entry: Pick<MetricsHistoryEntry, 'fiscalYear' | 'fiscalQuarter'>, timeframe: MetricsHistoryTimeframe): string {
  return timeframe === 'FY' ? `${entry.fiscalYear} 年` : (entry.fiscalQuarter === null ? `${entry.fiscalYear} 年` : `${entry.fiscalYear} Q${entry.fiscalQuarter}`)
}

export function columnHeading(column: SeriesTableColumn): string {
  const unit = column.unit && column.unit !== '無單位' ? column.unit : ''
  const parts = [TIMEFRAME_WORD[column.timeframe], unit].filter(Boolean)
  return parts.length ? `${column.label}（${parts.join('，')}）` : column.label
}

function periodKey(entry: Pick<MetricsHistoryEntry, 'fiscalYear' | 'fiscalQuarter'>): string {
  return `${entry.fiscalYear}-${entry.fiscalQuarter}`
}

export function buildSeriesTableRows(groups: Record<string, MetricsHistorySeries | null>, columns: SeriesTableColumn[], options: SeriesTableOptions = {}): SeriesTableRow[] {
  // Union of periods across the referenced groups（TTM and Q series index the same quarters, so
  // a 本益比（近四季）and a 淨值比（單季）column line up on the same rows）.
  const periods = new Map<string, { fiscalYear: number; fiscalQuarter: number | null }>()
  const referenced = new Set(columns.map(column => column.group))
  for (const name of referenced) {
    for (const entry of groups[name]?.entries ?? []) periods.set(periodKey(entry), { fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter })
  }
  let ordered = [...periods.values()].sort((a, b) => a.fiscalYear - b.fiscalYear || (a.fiscalQuarter ?? 0) - (b.fiscalQuarter ?? 0))
  if (options.annual && ordered.length) {
    const latest = ordered[ordered.length - 1]!
    ordered = ordered.filter(period => period.fiscalQuarter === 4 || period === latest)
  }
  if (options.maxPeriods && ordered.length > options.maxPeriods) ordered = ordered.slice(-options.maxPeriods)
  const latestKey = ordered.length ? periodKey(ordered[ordered.length - 1]!) : null
  // The row label's timeframe: FY when every column is annual, otherwise the quarterly form.
  const labelTimeframe: MetricsHistoryTimeframe = columns.every(column => column.timeframe === 'FY') ? 'FY' : 'Q'

  const rows = ordered.map(period => {
    const key = periodKey(period)
    const cells: SeriesTableCell[] = columns.map(column => {
      const entry = groups[column.group]?.entries.find(candidate => candidate.fiscalYear === period.fiscalYear && candidate.fiscalQuarter === period.fiscalQuarter)
      const point = entry?.values[column.code] ?? null
      const normalized = point ? { value: point.value, nullReason: point.nullReason } : { value: null, nullReason: entry ? '__no_record__' : null }
      return { code: column.code, value: normalized.value, nullReason: normalized.nullReason, text: formatNullablePoint(normalized, column.decimals), title: nullReasonTitle(normalized) }
    })
    const isLatest = key === latestKey
    const label = options.annual && isLatest && period.fiscalQuarter !== 4 ? `${periodLabel(period, 'Q')}（最新）` : periodLabel(period, labelTimeframe)
    return { key, label, fiscalYear: period.fiscalYear, fiscalQuarter: period.fiscalQuarter, isLatest, cells }
  })
  return options.latestFirst === false ? rows : rows.reverse()
}
