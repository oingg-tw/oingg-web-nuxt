import type { MetricsHistoryEntry, MetricsHistorySeries, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { FilterCategory } from '~/composables/screener/useFilterSchema'
import { metricDisplayName } from '~/composables/screener/useFilterSchema'
import { formatNullablePoint, nullReasonTitle } from '~/utils/metric-null-reason'
import { findMetricInSchema } from '~/utils/stock-digest'

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
  fiscalQuarter: number
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

export const TIMEFRAME_WORD: Record<MetricsHistoryTimeframe, string> = {
  TTM: '近四季',
  Q: '單季',
  FY: '年度'
}

export function periodLabel(entry: Pick<MetricsHistoryEntry, 'fiscalYear' | 'fiscalQuarter'>, timeframe: MetricsHistoryTimeframe): string {
  return timeframe === 'FY' ? `${entry.fiscalYear} 年` : `${entry.fiscalYear} Q${entry.fiscalQuarter}`
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
  const periods = new Map<string, { fiscalYear: number; fiscalQuarter: number }>()
  const referenced = new Set(columns.map(column => column.group))
  for (const name of referenced) {
    for (const entry of groups[name]?.entries ?? []) periods.set(periodKey(entry), { fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter })
  }
  let ordered = [...periods.values()].sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter)
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
