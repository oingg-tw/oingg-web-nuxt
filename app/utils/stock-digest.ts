import type { FilterCategory, FilterMetric } from '~/composables/screener/useFilterSchema'
import { metricDisplayName } from '~/composables/screener/useFilterSchema'
import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '~/composables/stock/useMetricsHistory'
import type { StockSummary } from '~/composables/stock/useStockSummary'
import type { ExDividendNotice } from '~/composables/stock/useExDividendNotices'
import { METRIC_CATEGORY_KEY_TO_DISPLAY } from '~/utils/guru-badges'
import { computeGaugeStats, gaugeBandLabel } from '~/utils/percentile'

// Pure builders behind useStockPageDigest / StockPageDigest.vue (2026-09-19, the stock-page
// a11y/SEO redesign). Everything here runs on BOTH the server (into the HTML crawlers read) and
// the client (hydration), so it must be deterministic from its inputs alone: only toFixed/
// Math.round arithmetic, ISO date strings passed through untouched, no Date/Date.now()/
// toLocaleString anywhere — any of those would make the two renders disagree and Vue would flag a
// hydration text mismatch.
//
// Wording is this app's own compliance register (2.4.3 / 刪形容詞測試): numbers with their neutral
// catalog names, percentile positions stated statistically, nothing evaluative — and never the
// string「資料不足」in this text: a clause with no number is dropped, not printed as a placeholder,
// because a description that says「資料不足」on thousands of pages is thin duplicate text about the
// site's coverage, not information about this stock. (The cards' own visible empty states cover
// the human reader.)

// 'company-health' dropped 2026-09-19 when that page was unpublished (see
// app/pages/stock/[code]/company-health.vue's own comment) — StockSeriesPage (shared/types/
// stock-series.ts) and the series plan behind it (server/utils/stock-data.ts) keep the wider set
// for the eventual redesign; only the DIGEST TEXT side narrowed.
export type StockDigestPage = 'index' | 'dividend' | 'metrics-history' | 'financial-statements'

export const STOCK_DIGEST_PAGE_TOPIC: Record<StockDigestPage, string> = {
  index: '財報亮點與風險',
  dividend: '配股配息',
  'metrics-history': '指標歷史',
  'financial-statements': '財務報表'
}

export const STOCK_DIGEST_DISCLAIMER = '以上數字整理自公開財報與交易所每日資料，不代表本站對此個股之評等或投資建議。'

// The exchange's daily valuation feed — cited whenever the digest quotes the summary card's daily
// PE/PB/殖利率 (those numbers come from GET /stocks/:symbol, not from any metrics-history group).
const DAILY_VALUATION_SOURCE_METRIC = 'exchangePeRatio'

export interface StockDigestGroupResult {
  timeframe: MetricsHistoryTimeframe
  entries: MetricsHistoryEntry[]
}

export interface StockDigestFact {
  code: string
  // Display category（市場評價／股東回饋／…）via METRIC_CATEGORY_KEY_TO_DISPLAY.
  category: string
  // Catalog display name（EPS／負債比率／連續配息年數…）.
  label: string
  // 近四季 / 單季 / null for annual and daily figures whose name already carries its period.
  periodLabel: string | null
  value: number
  unit: string
  // "86.27 元" / "34.78%" / "7 年"
  valueText: string
  // "近四季 EPS 86.27 元" / "單季負債比率 30.94%" / "連續配息年數 7 年"
  text: string
  fiscalYear: number
  fiscalQuarter: number
  timeframe: MetricsHistoryTimeframe
  knowledgeDate: string | null
  knowledgeDateIsFallback: boolean
}

export interface StockDigestPercentile {
  code: 'peRatio' | 'pbRatio'
  label: string
  current: number
  percentile: number
  windowLabel: string
  bandLabel: string
  // "本益比 27.65 倍，位於近5年第85百分位（最高20%區間）"
  text: string
}

export interface StockPageDigest {
  page: StockDigestPage
  lead: string
  facts: StockDigestFact[]
  percentiles: StockDigestPercentile[]
  latestPeriod: { fiscalYear: number; fiscalQuarter: number; label: string } | null
  // Latest REAL disclosure date among the facts (knowledgeDateIsFallback === false only).
  latestKnowledgeDate: string | null
  valuationTradeDate: string | null
  sources: string[]
}

export interface StockDigestInput {
  page: StockDigestPage
  categories: FilterCategory[]
  // Every "latest period" group the page plan fetched (limit 1), keyed by group name.
  latest: Record<string, StockDigestGroupResult>
  peHistory: MetricsHistoryEntry[] | null
  pbHistory: MetricsHistoryEntry[] | null
  summary: StockSummary | null
  nextExDividend: ExDividendNotice | null
}

const PERIOD_LABEL: Record<MetricsHistoryTimeframe, string | null> = {
  TTM: '近四季',
  Q: '單季',
  FY: null
}

export function findMetricInSchema(categories: FilterCategory[], code: string): { category: FilterCategory; metric: FilterMetric } | null {
  for (const category of categories) {
    const metric = category.metrics.find(candidate => candidate.key === code)
    if (metric) return { category, metric }
  }
  return null
}

// Integers stay integers（7 年、8 分）, everything else gets two decimals; unit strings are the
// catalog's literal suffixes（%／元／倍／分／年）,「無單位」means none.
export function formatDigestValue(value: number, unit: string): string {
  const number = Number.isInteger(value) ? String(value) : value.toFixed(2)
  if (!unit || unit === '無單位') return number
  if (unit === '%') return `${number}%`
  return `${number} ${unit}`
}

// A space between the period word and a Latin-lettered name（近四季 EPS）, none before a Chinese
// one（單季負債比率）— the same spacing the visible cards use.
function joinPeriodAndLabel(periodLabel: string | null, label: string): string {
  if (!periodLabel) return label
  return /^[A-Za-z0-9]/.test(label) ? `${periodLabel} ${label}` : `${periodLabel}${label}`
}

function latestEntry(entries: MetricsHistoryEntry[]): MetricsHistoryEntry | null {
  let latest: MetricsHistoryEntry | null = null
  for (const entry of entries) {
    if (!latest || entry.fiscalYear > latest.fiscalYear || (entry.fiscalYear === latest.fiscalYear && entry.fiscalQuarter > latest.fiscalQuarter)) latest = entry
  }
  return latest
}

function buildFacts(input: StockDigestInput): StockDigestFact[] {
  const facts: StockDigestFact[] = []
  const seen = new Set<string>()
  for (const group of Object.values(input.latest)) {
    const entry = latestEntry(group.entries)
    if (!entry) continue
    for (const [code, point] of Object.entries(entry.values)) {
      if (seen.has(code)) continue
      if (!point || point.value === null || point.nullReason) continue
      const located = findMetricInSchema(input.categories, code)
      if (!located) continue
      const category = METRIC_CATEGORY_KEY_TO_DISPLAY[located.category.key]
      if (!category) continue
      seen.add(code)
      const label = metricDisplayName(located.metric)
      const periodLabel = PERIOD_LABEL[group.timeframe]
      const valueText = formatDigestValue(point.value, located.metric.unit)
      facts.push({
        code,
        category,
        label,
        periodLabel,
        value: point.value,
        unit: located.metric.unit,
        valueText,
        text: `${joinPeriodAndLabel(periodLabel, label)} ${valueText}`,
        fiscalYear: entry.fiscalYear,
        fiscalQuarter: entry.fiscalQuarter,
        timeframe: group.timeframe,
        knowledgeDate: point.knowledgeDate ?? null,
        knowledgeDateIsFallback: point.knowledgeDateIsFallback
      })
    }
  }
  return facts
}

// Trailing window of the stock's own quarterly ratio history, truncated to the largest whole
// lookback the data can honestly fill（20/12/8/4 quarters → 近5年/近3年/近2年/近1年）. A symbol
// sitting on the market-wide 2022Q1 data floor gets「近3年」, never a padded「近5年」.
const WINDOW_QUARTERS: [number, string][] = [
  [20, '近5年'],
  [12, '近3年'],
  [8, '近2年'],
  [4, '近1年']
]

function buildPercentile(code: 'peRatio' | 'pbRatio', label: string, history: MetricsHistoryEntry[] | null, current: number | null | undefined): StockDigestPercentile | null {
  if (!history || current === null || current === undefined) return null
  const values: number[] = []
  for (const entry of history) {
    const point = entry.values[code]
    if (point && point.value !== null) values.push(point.value)
  }
  const window = WINDOW_QUARTERS.find(([quarters]) => values.length >= quarters)
  if (!window) return null
  const stats = computeGaugeStats(values.slice(-window[0]), current)
  if (!stats) return null
  const percentile = Math.round(stats.currentPercentile)
  const bandLabel = gaugeBandLabel(stats)
  return {
    code,
    label,
    current,
    percentile,
    windowLabel: window[1],
    bandLabel,
    text: `${label} ${current.toFixed(2)} 倍，位於${window[1]}第${percentile}百分位（${bandLabel}）`
  }
}

function valuationClause(summary: StockSummary | null, percentiles: StockDigestPercentile[]): string | null {
  const valuation = summary?.valuation
  if (!valuation) return null
  const parts: string[] = []
  const pe = percentiles.find(item => item.code === 'peRatio')
  const pb = percentiles.find(item => item.code === 'pbRatio')
  if (valuation.peRatio !== null) parts.push(`本益比 ${valuation.peRatio.toFixed(2)} 倍${pe ? `（${pe.windowLabel}第${pe.percentile}百分位）` : ''}`)
  if (valuation.pbRatio !== null) parts.push(`淨值比 ${valuation.pbRatio.toFixed(2)} 倍${pb ? `（${pb.windowLabel}第${pb.percentile}百分位）` : ''}`)
  if (valuation.dividendYield !== null) parts.push(`殖利率 ${valuation.dividendYield.toFixed(2)}%`)
  if (!parts.length) return null
  return `${parts.join('、')}（${valuation.tradeDate}）`
}

function yieldClause(summary: StockSummary | null): string | null {
  const valuation = summary?.valuation
  if (!valuation || valuation.dividendYield === null) return null
  return `殖利率 ${valuation.dividendYield.toFixed(2)}%（${valuation.tradeDate}）`
}

function exDividendClause(notice: ExDividendNotice | null): string | null {
  if (!notice) return null
  const parts: string[] = []
  if (notice.cashDividend !== null) parts.push(`現金股利 ${notice.cashDividend.toFixed(2)} 元`)
  if (notice.stockDividendRatio !== null) parts.push(`股票股利比例 ${notice.stockDividendRatio}`)
  // exType is '息' | '權' | '權息' (useExDividendNotices.ts) → 除息日／除權日／除權息日.
  return `除${notice.exType}日 ${notice.exDate}${parts.length ? `，${parts.join('、')}` : ''}`
}

function buildLead(input: StockDigestInput, facts: StockDigestFact[], percentiles: StockDigestPercentile[], latestPeriodLabel: string | null): string {
  const byCode = new Map(facts.map(fact => [fact.code, fact]))
  const list = (codes: string[]) => codes.map(code => byCode.get(code)?.text ?? null).filter((text): text is string => text !== null)
  const sentences: string[] = []
  const push = (items: string[]) => {
    if (items.length) sentences.push(items.join('、'))
  }
  switch (input.page) {
    case 'index': {
      push(list(['eps', 'roe', 'roa']))
      const valuation = valuationClause(input.summary, percentiles)
      if (valuation) sentences.push(valuation)
      break
    }
    case 'dividend': {
      push(list(['dividendPerShare', 'dividendPayoutRatio', 'dividendCoverageRatio', 'shareholderYield']))
      push(list(['consecutiveDividendYears', 'dividendGrowthRate5y', 'chowderNumber']))
      // The cash chain behind the dividend (the 股息哪裡來 cards on this page since 2026-09-19).
      push(list(['fcfPerShare', 'ocfPerShare', 'eps']))
      const yieldText = yieldClause(input.summary)
      if (yieldText) sentences.push(yieldText)
      const exDividend = exDividendClause(input.nextExDividend)
      if (exDividend) sentences.push(exDividend)
      break
    }
    case 'financial-statements':
      push(list(['revenuePerShare', 'eps', 'ocfPerShare', 'fcfPerShare', 'dividendPerShare', 'bvps']))
      break
    case 'metrics-history': {
      push(list(['eps', 'roe', 'roa', 'grossMargin', 'operatingMargin', 'netProfitMargin']))
      push(list(['debtRatio', 'currentRatio', 'revenueGrowthRate', 'epsGrowthRate']))
      if (sentences.length && latestPeriodLabel) sentences[0] = `最新一期（${latestPeriodLabel}）：${sentences[0]}`
      break
    }
  }
  return sentences.length ? `${sentences.join('；')}。` : ''
}

function collectSources(input: StockDigestInput, facts: StockDigestFact[], usesDailyValuation: boolean): string[] {
  const sources: string[] = []
  const add = (metric: FilterMetric | undefined) => {
    for (const source of metric?.sources ?? []) {
      if (!sources.includes(source)) sources.push(source)
    }
  }
  for (const fact of facts) add(findMetricInSchema(input.categories, fact.code)?.metric)
  if (usesDailyValuation) add(findMetricInSchema(input.categories, DAILY_VALUATION_SOURCE_METRIC)?.metric)
  return sources
}

export function buildStockPageDigest(input: StockDigestInput): StockPageDigest | null {
  const facts = buildFacts(input)
  const percentiles = [
    buildPercentile('peRatio', '本益比', input.peHistory, input.summary?.valuation?.peRatio),
    buildPercentile('pbRatio', '淨值比', input.pbHistory, input.summary?.valuation?.pbRatio)
  ].filter((item): item is StockDigestPercentile => item !== null)
  if (!facts.length && !percentiles.length) return null

  let latestPeriod: StockPageDigest['latestPeriod'] = null
  for (const fact of facts) {
    if (fact.timeframe === 'FY') continue
    if (!latestPeriod || fact.fiscalYear > latestPeriod.fiscalYear || (fact.fiscalYear === latestPeriod.fiscalYear && fact.fiscalQuarter > latestPeriod.fiscalQuarter)) {
      latestPeriod = { fiscalYear: fact.fiscalYear, fiscalQuarter: fact.fiscalQuarter, label: `${fact.fiscalYear} Q${fact.fiscalQuarter}` }
    }
  }
  let latestKnowledgeDate: string | null = null
  for (const fact of facts) {
    if (fact.knowledgeDate && !fact.knowledgeDateIsFallback && (!latestKnowledgeDate || fact.knowledgeDate > latestKnowledgeDate)) latestKnowledgeDate = fact.knowledgeDate
  }
  const lead = buildLead(input, facts, percentiles, latestPeriod?.label ?? null)
  const usesDailyValuation = !!input.summary?.valuation && (input.page === 'index' || input.page === 'dividend')
  return {
    page: input.page,
    lead,
    facts,
    percentiles,
    latestPeriod,
    latestKnowledgeDate,
    valuationTradeDate: usesDailyValuation ? (input.summary?.valuation?.tradeDate ?? null) : null,
    sources: collectSources(input, facts, usesDailyValuation)
  }
}

export function buildDigestFreshnessText(digest: StockPageDigest): string | null {
  const parts: string[] = []
  if (digest.latestPeriod) parts.push(`最新財報資料：${digest.latestPeriod.label}${digest.latestKnowledgeDate ? `（揭露日 ${digest.latestKnowledgeDate}）` : ''}`)
  if (digest.valuationTradeDate) parts.push(`每日估值：${digest.valuationTradeDate}`)
  return parts.length ? parts.join('｜') : null
}

// ≤90 characters, trimmed at a clause boundary（、；，。）rather than mid-number. Was 150 until the
// 2026-09-19 SEO build: the 133–149-character descriptions it produced were truncated in every
// mobile result; the builders now aim for 60–80 and this is the hard ceiling.
const META_DESCRIPTION_MAX = 90

export function clampDescription(text: string, max = META_DESCRIPTION_MAX): string {
  const chars = [...text]
  if (chars.length <= max) return text
  const head = chars.slice(0, max).join('')
  const cut = Math.max(head.lastIndexOf('；'), head.lastIndexOf('、'), head.lastIndexOf('，'), head.lastIndexOf('。'))
  return `${cut > 20 ? head.slice(0, cut) : head}。`
}

export function buildStockMetaDescription(shortName: string, code: string, digest: StockPageDigest | null): string | null {
  if (!digest || !digest.lead) return null
  let text = `${shortName}（${code}）${STOCK_DIGEST_PAGE_TOPIC[digest.page]}：${digest.lead}`
  if (digest.latestPeriod && !text.includes(digest.latestPeriod.label)) text += `最新財報資料 ${digest.latestPeriod.label}。`
  return clampDescription(text)
}
