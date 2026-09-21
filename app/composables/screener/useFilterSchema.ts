export interface FilterField {
  key: string
  name: string
  period: string
  // Plain-language explanation of what this field actually measures — only some fields need
  // one (a cryptic short name like Altman Z-Score's "X1" is meaningless on its own; "EPS"
  // isn't). Its mere presence IS the signal for whether to show an explanation affordance —
  // no separate "hasDescription" flag, `if (field.description)` is the whole check.
  description?: string
  // Alternate names a user might search by (e.g. "股東權益報酬率" for ROE) — the indicator
  // dialog's search matches against these too (see MoleculeIndicatorPickerBody.vue), but
  // they're never displayed; every UI that shows a field still shows only its own name.
  aliases?: string[]
  // Confirmed live with bff-ts 2026-09-01: 'currency' | 'percent' | 'times' | 'ratio' |
  // 'days' | 'score' so far (not a closed enum bff-ts has committed to, so kept as a plain
  // string rather than a union — treat unrecognized values as "no special formatting"
  // rather than an error). Only 'percent' is acted on right now (OrganismResultTable.vue
  // appends a % suffix), per the actual request — the others are just carried through.
  unit: string
  // 0-based, scoped to sibling fields under the same metric — confirmed live with bff-ts
  // 2026-08-31 (not new data, just newly exposing the `position` column they already order
  // the query by; the array was already correctly ordered before this existed). Use this
  // instead of any name/alphabetical sort — see sortedFieldsOf in
  // MoleculeIndicatorPickerBody.vue, which used to alphabetize and got real cases wrong
  // (e.g. bias5d/bias20d/bias60d sorting as strings, not the intended numeric order).
  sort: number
}

export interface FilterMetric {
  key: string
  name: string
  // Added by analysis-ts 2026-09-11 alongside a breaking rename of `name` itself on 5 existing
  // metrics (e.g. exchangePeRatio's own name went from "交易所 PER" to plain "PER", with
  // "交易所" moved here) — a qualifier that distinguishes a metric from a related base variant
  // (交易所/非上市版/非製造業版/Greenblatt, and analysis-ts's own stated plan to reuse this for
  // the new live-valuation metrics too, e.g. liveGrahamNumber). Optional/absent on every metric
  // that doesn't need one — `name` alone is still the correct complete label in that case.
  // Never read `name` alone assuming it's the full original string; use metricDisplayName()
  // below, which reconstructs it.
  //
  // Field itself RENAMED from `displayNameSuffix` to `nameSuffix` by analysis-ts 2026-09-12 —
  // this metric-level "human-readable name" trio (name/nameSuffix/nameEn below) got unified onto
  // the same shared NamedEntity field names FilterMetricBadge already uses (badge.name/nameEn/
  // nameSuffix), across all 94 metrics, not just the ~15 with a badge.
  nameSuffix?: string
  // Optional English name, added by analysis-ts 2026-09-12 alongside the nameSuffix rename above
  // — only populated on the ~15 metrics that already had a guru badge (badge.nameEn existed
  // first); the other ~79 metrics carry `undefined` here until analysis-ts backfills them.
  nameEn?: string
  path: string
  // Metric-level unit — confirmed live in the real GET /metrics response (same string as every
  // sibling field's own `unit` in practice, e.g. "無單位"/"%"/"元"). Added 2026-09-10 for
  // guru-indicators.vue's indicator table (see GuruIndicatorRow.vue), which shows one unit per
  // metric row rather than per period/field.
  unit: string
  fields: FilterField[]
  // Same semantics as FilterField.sort, scoped to sibling metrics under the same category.
  sort: number
  // LaTeX string for this metric's own formula, added by analysis-ts 2026-09-10 (confirmed
  // live via bff-ts, commit f843118) so the frontend never has to maintain its own copy of a
  // formula that could drift from the real calculation. `null` (not merely absent) on every
  // metric that hasn't been backfilled yet — currently only roe/peRatio/sue/chowderNumber have
  // a real value, everything else is null; analysis-ts said they'll fill in the remaining ~85
  // over time, so callers must treat null as "no formula to show yet," not an error. Display-
  // only — analysis-ts's own explicit caution: their real values are bigint-precise, the
  // compute-engine family (KaTeX/mathlive) these formulas are written for evaluates in floating
  // point, so never use this to recompute a number, only to render the formula's shape.
  formulaLatex?: string | null
  // Real, checkable link to the methodology's own primary/secondary source — wired in by bff-ts
  // 2026-09-10 (commit 71572ca), same treatment as formulaLatex (relayed cross-session per
  // direct request: "後端有給 referenceUrl，你前端忠實呈現就好。不然這樣我管理起來要兩邊跑" —
  // don't maintain this twice). `null`/absent on any metric analysis-ts hasn't documented a
  // reference for yet; most of the 84 metrics already have a real value (mostly Wikipedia, a
  // few practitioner sources like Seeking Alpha for chowderNumber) as of this date. Replaces
  // guru-badges.ts's own former hardcoded `sourceUrl` field — see that file's own history.
  referenceUrl?: string | null
  // A direct link to the ORIGINAL academic paper (author/year/journal), distinct from
  // referenceUrl above (a general-reader explanation, often Wikipedia) — analysis-ts's own
  // distinction, confirmed by reading their metricDefinitionSpec.ts directly: "referenceUrl 給
  // 一般讀者看的白話解釋，academicSourceUrl 給想找原始論文的人". Only ever set on the curated
  // "guru badge" methodologies (13 of them per their own commit history), never on a plain
  // indicator — a badge can have neither, either, or both; when both exist, the badge dialog
  // should prefer this one (per direct request 2026-09-10: "徽章彈窗 有 academicSourceUrl 就用
  // 沒有的話 referenceUrl 才當備案"). Not yet wired through bff-ts's own GET /metrics as of this
  // date (confirmed live via curl: 0/86 metrics carry the field at all, even though it exists in
  // analysis-ts's own codebase) — same "request sent, build ahead of it" pattern as sources was.
  academicSourceUrl?: string | null
  // Curated "guru badge" data — wired in by bff-ts 2026-09-10 (commit a128d28), migrated from
  // app/utils/guru-badges.ts's own former hardcoded GURU_BADGES array per direct request
  // ("畫面不變動，只把資料設定搬去後端"). Only present on the ~11 metrics that actually have a
  // real, literature-sourced badge (everything else is undefined) — see guru-badges.ts's own
  // buildGuruBadges() for how this gets turned into a real GuruBadge. `badge.timeframe` is
  // missing (not just empty) on the one badge whose criterion spans two fields instead of one
  // (S&P 500 earnings eligibility, via allPositiveFieldIds) — bff-ts confirmed this is
  // deliberate, not a bug, so callers must treat it as optional.
  badge?: FilterMetricBadge | null
  // Data-provenance category labels (資產負債表/損益表/現金流量表/股本變動申報/證交所每日收盤價/
  // etc. — a fixed 9-label vocabulary), wired in by bff-ts 2026-09-10 (commit a1876eb), same
  // day it was requested — confirmed live, all 86 metrics carry a real, non-empty array now
  // (bff-ts treats a missing/malformed one as a hard sync failure on their side, same severity
  // as displayName/unit). A metric can list more than one, e.g. peRatio combines 損益表/股本變動
  // 申報/證交所每日收盤價. Kept optional here anyway (defensive typing, not because it's expected
  // to be absent) — matches this file's own convention for every other bff-ts-sourced field.
  //
  // NOT the same as bff-ts's own separate, existing `source` (singular) field on the real API
  // response — that one's a free-text tooltip analysis-ts has never populated (always null) and
  // isn't modeled in this interface at all. Don't conflate the two if extending this later.
  sources?: string[]
  // Whether GET /stocks/:symbol/metric-provenance supports this metricCode — added by analysis-ts
  // 2026-09-14 per direct request, replacing what used to be a hand-maintained frontend allowlist
  // (guru-badges.ts's own PROVENANCE_PILOT_METRIC_CODES, now removed) that a real user report
  // showed had gone stale the moment a non-badge metric (payablesTurnover) got provenance support
  // but wasn't a badge, so nothing in this app ever noticed. Read this field directly instead of
  // maintaining a second list — analysis-ts's own words: "之後我們每次擴大範圍，這個欄位會自動
  // 反映，你們不用再改". Optional/defensive typing only because this app hasn't confirmed bff-ts
  // has synced it yet (same lag pattern seen on other recent breaking changes) — don't read this
  // raw field directly, call guru-badges.ts's own metricHasProvenance(metric) instead, which
  // falls back to a small legacy allowlist only for the transitional window while this field is
  // genuinely absent from bff-ts's own response.
  hasProvenance?: boolean
  // Plain-language explanation trio added by analysis-ts 2026-09-19 (commit cf2d409a) on this
  // app's request for the /metrics/{code} explanation pages: one-sentence definition, the
  // metric's applicability limits / industry differences, and its common misreadings. Present
  // together or not at all; the first batch covers the 35 badge metrics. Optional here until
  // bff-ts re-syncs its catalog cache（it only syncs at startup）— read with `?.`.
  description?: string | null
  limitations?: string | null
  misreadings?: string | null
}

export interface FilterMetricBadgeThreshold {
  description: string
  denominator: number
  // Prose explaining HOW the threshold is applied, distinct from `description` (which is just the
  // comparison, e.g. "3 / 3"). Typed 2026-09-21 when /stock/:code/margins began rendering it for
  // the 三率三升 badge — the field was already being sent（confirmed live）and simply had no
  // declaration here, which is why that page's first build failed typecheck on `threshold.note`
  // rather than on anything the backend was missing. Optional because most badges omit it.
  note?: string | null
  // 'in_range' added 2026-09-10 (analysis-ts commit dcb1f17) — a real correction, not a new
  // feature request: the Fidelity payout-ratio badge's own original "< 60%" reading turned out
  // to be wrong. The user directly compared the source PDF and found its actual conclusion is a
  // 40–60% RANGE (too low wastes capital-allocation leverage, too high raises sustainability
  // doubt), not a one-sided "below 60% is safe" floor — the single-sided comparator vocabulary
  // literally couldn't express the paper's real point. Uses valueMin/valueMax (both required
  // together when this comparator is used), not a second `value` field.
  comparator?: 'gt' | 'lt' | 'gte' | 'abs_lt' | 'in_range'
  value?: number
  valueMin?: number
  valueMax?: number
  // Compares against ANOTHER field's own value instead of a fixed constant (e.g. Graham Number/
  // NCAV compare the stock's own price against the metric's value) — direction is always
  // `(value at this fieldId) <comparator> (this metric's own value)`.
  compareAgainstFieldId?: string
  // Compound "every one of these fields must be positive" case (S&P 500 earnings eligibility) —
  // when present, `comparator`/`value` are absent; the first fieldId here is this badge's own
  // metric field, the rest are extra fields to check alongside it.
  allPositiveFieldIds?: string[]
}

export interface FilterMetricBadge {
  // `id` was removed by analysis-ts 2026-09-12 (duplicated the parent FilterMetric's own `key`,
  // e.g. ncavBadge.id === 'ncav' === metric.key) — use the parent metric's `key` to identify a
  // badge instead (see guru-badges.ts's metricBadgeToGuruBadge, which now sources GuruBadge.id
  // from `metric.key`).
  name: string
  nameEn: string
  // Reserved for future use by analysis-ts — undefined on every badge as of this date.
  nameSuffix?: string
  author: string
  summary: string
  detail: string
  // The timeframe/period this badge's threshold reads from (e.g. "TTM"/"Q"/"FY"/"EOD") — absent when
  // the threshold spans multiple fields with no single one to name (see allPositiveFieldIds
  // above). Named `token` here until 2026-09-14, when a real bug was found live (reported: "不管
  // 怎麼重新整理都顯示資料不足") — bff-ts's actual field is `timeframe`, confirmed by curling
  // GET /metrics directly (e.g. liveGrahamNumber's badge carries `"timeframe":"EOD"`, no `token`
  // key at all); this file's own type had never been updated to match, so every badge whose
  // fieldId depended on this field (nearly all of them — only the allPositiveFieldIds/
  // compareAgainstFieldId shapes and the hardcoded Piotroski trio don't) silently built a fieldId
  // like "sue.undefined", which the backend correctly 400'd as an unknown filter field. Renamed
  // to match reality.
  timeframe?: string
  threshold: FilterMetricBadgeThreshold
  // The BADGE's own source link, added by analysis-ts 2026-09-20 (commit 2fc57f6b) to fix a
  // structural problem, not a batch of wrong URLs: badges had no source field of their own, so
  // every badge UI fell back to the parent METRIC's referenceUrl/academicSourceUrl — and those
  // answer「這支指標是什麼、公式怎麼算」(a Wikipedia article on gross margin), never「為什麼門檻
  // 是 40%」. A user reported exactly that:「徽章連結點過去根本沒看到公式或門檻」.
  //
  // The contract here is stricter than referenceUrl's: analysis-ts opened every URL and confirmed
  // the page states that threshold number verbatim (their per-badge file comments record the
  // quote). 21 of 23 badges have one; grossMargin/netProfitMargin are deliberately EMPTY because
  // their threshold comes from a print book (Mary Buffett & David Clark, 2008) with no legal free
  // full text.
  //
  // When it's absent, render NO link — never fall back to the metric's own referenceUrl, which is
  // the exact bug this field exists to fix. An empty sourceUrl does NOT mean the threshold is this
  // app's own invention: the attribution is still real and nameable, in `author`.
  sourceUrl?: string | null
}

export interface FilterCategory {
  key: string
  name: string
  metrics: FilterMetric[]
  // Same semantics as FilterField.sort, scoped to sibling categories (top-level).
  sort: number
}

export interface FilterSchema {
  categories: FilterCategory[]
}

// Shared by every place that renders categories/metrics/fields — see FilterField.sort's own
// comment for where this value comes from. Returns a new array (doesn't mutate `items`),
// matching how every other list transform in this app's screener code works.
export function bySort<T extends { sort: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort - b.sort)
}

// GET /filters' period codes are backend/reporting-cadence jargon — internal shorthand, never
// meant to reach the screen as-is. Unrecognized codes are dropped rather than shown raw, with a
// dev-only warning so a new one introduced by the real backend gets a translation added here
// instead of silently leaking through to users.
//
// Re-synced 2026-09-09 to the schema's ACTUAL current period codes (confirmed against a live
// GET /filters response — every field.period value that exists anywhere in the real schema:
// TTM/Q/Q_ANN/EOD/1Y_1D/2Y_1W/5Y_1M) — the previous key set here (lowercase ttm/snapshot/
// quarterly/quarterlyAnnualized/annual/monthly/weekly/daily) matched none of them at all, not
// even case-insensitively (this isn't just a casing bug — annual/monthly/weekly/daily don't
// correspond to any real period in the schema). Every period lookup was silently failing,
// firing this file's own dev warning on every field and falling back to no period suffix at
// all — found while tracing a real reported bug (indicator-picker rows showing a raw period
// code like "TTM" as their whole label — see MoleculeIndicatorPickerBody.vue's own
// expandFields/collapseFields comments for that half of the same investigation).
const PERIOD_LABELS: Record<string, string> = {
  TTM: '近四季',
  Q: '單季',
  Q_ANN: '單季年化',
  EOD: '最新',
  // Added 2026-09-11 (reported live: "存股的分類 看到 columns 呈現 FY") — chowderNumber/
  // consecutiveDividendYears both use this timeframe (see StockChowderNumberChart.vue's own
  // comment: "no TTM/Q variant exists for this metric"), same missing-mapping bug pattern this
  // file's own dev-warning already exists to catch, just never actually fixed for this specific
  // code because nothing surfaced it as a visible screener column until the 存股與股利
  // column-preset-template started using it.
  FY: '年度',
  // Beta's own lookback-window/sampling-interval combinations (the only fields that use these
  // periods) — labeled with both, since a future period could reuse the same lookback with a
  // different sampling interval and "近1年" alone would then be ambiguous.
  //
  // 3Y_1W added 2026-09-22. It was the exact bug this map's own comment above describes —
  // beta grew from three windows to four, nothing re-read this list, and the unmapped period
  // fell through to the dev warning and a label with no period suffix. Found while checking
  // whether beta's new badge（timeframe 5Y_1M, the first badge not on Q/TTM/EOD）needed anything
  // here: 5Y_1M was already mapped, 3Y_1W was not.
  '1Y_1D': '1年（日）',
  '2Y_1W': '2年（週）',
  '3Y_1W': '3年（週）',
  '5Y_1M': '5年（月）'
}

// Same fields the picker lists, ordered by how useful the period generally is for
// screening — TTM smooths out single-quarter noise, so it's the sensible default to land
// on first within a metric's field list. Anything not named here (a period introduced
// later) sorts after all of these, in whatever order the API returned it.
const PERIOD_SORT_ORDER: Record<string, number> = {
  TTM: 0,
  Q_ANN: 1,
  Q: 2,
  EOD: 3,
  FY: 4,
  '1Y_1D': 5,
  '2Y_1W': 6,
  '3Y_1W': 7,
  '5Y_1M': 8
}

export function periodSortRank(period: string): number {
  return PERIOD_SORT_ORDER[period] ?? Object.keys(PERIOD_SORT_ORDER).length
}

export function formatPeriodLabel(period: string): string | null {
  const label = PERIOD_LABELS[period]
  if (!label && import.meta.dev) {
    console.warn(`[filters] no display label mapped for period "${period}" — add one to PERIOD_LABELS in useFilterSchema.ts`)
  }
  return label ?? null
}

// Real bug fixed 2026-09-09 (reported live: "點選選項後無反應 也沒送出API請求" — traced to
// every field label in the indicator picker showing a raw period code like "TTM" instead of a
// real name). This comment used to claim "field.name is just the metric's own name now" — true
// at some earlier point, but confirmed FALSE against a live GET /filters response: field.name is
// always just the field's own period code repeated (e.g. period "TTM" → name "TTM" too), never a
// distinct display name — apparently a backend contract that silently reverted at some point
// without this comment (or the code relying on it) getting updated. metricName has to come from
// the caller now (the metric's own `name`, threaded through from MoleculeIndicatorPickerBody),
// there's nothing usable on the field itself.
export function formatFieldLabel(metricName: string, field: FilterField): string {
  const periodLabel = formatPeriodLabel(field.period)
  return periodLabel ? `${metricName}（${periodLabel}）` : metricName
}

// Same "metricName + period" combination as formatFieldLabel above, but for a screener RESULT
// column (POST /screener's own {metricName, fieldName} pair) rather than a schema FilterField —
// `fieldName` there is bff-ts's own raw period token (Q/TTM/...) for a period-based column, or
// already a real sub-label (e.g. "股價" for stock.price) for one that isn't. Moved here 2026-09-11
// from useScreenerTabs.ts once useGuestScreener.ts needed the exact same logic for the stateless
// anonymous run's own result columns — one shared home instead of two copies that could drift.
export function columnLabelFrom(metricName: string, fieldName: string): string {
  const periodLabel = formatPeriodLabel(fieldName)
  return periodLabel ? `${metricName}（${periodLabel}）` : fieldName || metricName
}

// Reconstructs the metric's own full original label — see FilterMetric.nameSuffix's own
// comment for why `metric.name` alone can no longer be assumed complete (analysis-ts split e.g.
// exchangePeRatio's "交易所 PER" into name:"PER" + nameSuffix:"交易所"). Every call site
// that used to read `metric.name` directly as a complete display string should read this instead.
export function metricDisplayName(metric: FilterMetric): string {
  return metric.nameSuffix ? `${metric.nameSuffix} ${metric.name}` : metric.name
}

export function locateFieldInSchema(categories: FilterCategory[], fieldId: string): { metric: FilterMetric; field: FilterField } | null {
  for (const category of categories) {
    for (const metric of category.metrics) {
      for (const field of metric.fields) {
        if (`${metric.key}.${field.key}` === fieldId) return { metric, field }
      }
    }
  }
  return null
}

export interface PeriodOption {
  fieldId: string
  period: string
  label: string
}

// Every field within fieldId's own metric that shares its name — i.e. every period variant
// of "the same thing" (ROE TTM/單季/近四季), sorted by periodSortRank so the most useful one
// leads. Powers the range editor's period switcher: picking a condition's field no longer
// asks for a period up front (see MoleculeIndicatorPickerBody's condition-mode collapsing),
// so this is the one place left to change it, as a refinement alongside min/max/exclude
// rather than a totally separate field choice.
export function periodSiblingsOf(categories: FilterCategory[], fieldId: string | null): PeriodOption[] {
  if (!fieldId) return []
  const location = locateFieldInSchema(categories, fieldId)
  if (!location) return []
  return location.metric.fields
    .filter(field => field.name === location.field.name)
    .map(field => ({
      fieldId: `${location.metric.key}.${field.key}`,
      period: field.period,
      label: formatPeriodLabel(field.period) ?? field.period
    }))
    .sort((a, b) => periodSortRank(a.period) - periodSortRank(b.period))
}

// Used as the offline/dev fallback below — this is the exact sample payload the schema
// service is expected to return, so the filter builder still works before it's reachable.
const MOCK_FILTER_SCHEMA: FilterSchema = {
  categories: [
    {
      key: 'profitability',
      name: '獲利能力與資本配置效率',
      sort: 0,
      metrics: [
        {
          key: 'returns',
          name: '股東權益報酬率／資產報酬率',
          path: '/api/profitability/returns',
          sort: 0,
          fields: [
            { key: 'roeTtm', name: 'ROE（股東權益報酬率）', period: 'TTM', unit: 'percent', sort: 0 },
            { key: 'roaTtm', name: 'ROA（資產報酬率）', period: 'TTM', unit: 'percent', sort: 1 }
          ]
        }
      ]
    },
    {
      key: 'guru',
      name: '大師策略與複合量化估值模型',
      sort: 1,
      metrics: [
        {
          key: 'grahamNumber',
          name: '葛拉漢數（Graham Number）',
          path: '/api/guru/graham-number',
          sort: 0,
          fields: [{ key: 'grahamNumber', name: '葛拉漢數', period: 'TTM', unit: 'currency', sort: 0 }]
        },
        {
          key: 'ncav',
          name: '葛拉漢淨流動資產價值（Graham NCAV）',
          path: '/api/guru/ncav',
          sort: 1,
          fields: [
            { key: 'ncav', name: 'NCAV（淨流動資產價值）', period: 'EOD', unit: 'currency', sort: 0 },
            { key: 'marginOfSafetyPrice', name: '安全邊際價', period: 'EOD', unit: 'currency', sort: 1 }
          ]
        }
      ]
    }
  ]
}

// Confirmed contract (oingg-bff-ts API reference): GET {apiBase}/metrics -> FilterSchema,
// public (no auth). Falls back to the sample schema above if the BFF isn't reachable yet.
//
// Renamed GET /filters -> GET /metrics 2026-09-10 (relayed live by bff-ts) — analysis-ts's own
// upstream endpoint was renamed first (it returns metric definitions, not filters), and bff-ts
// then renamed its own public path to match for ubiquitous language, per direct request. Same
// response shape, no payload change. The old /filters path now 404s — confirmed live.
// Real bug fixed 2026-09-14 — MOCK_FILTER_SCHEMA used to be an unconditional fallback for ANY
// failure, not just "endpoint doesn't exist" — GET /metrics is confirmed live, so a real failure
// here is a transient network blip or a genuine production outage, not a permanently-missing
// route the way /api/stocks was (see useStocks.ts's own history of that exact mistake). Silently
// substituting a 2-category sample schema in production would make the screener/stock-detail
// pages LOOK like they're working while actually missing the vast majority of real filter
// categories/metrics — same class of bug as MOCK_STOCK_UNIVERSE, just for UI scaffolding instead
// of numbers. Now gated to import.meta.dev only (this file's own local-offline-development
// convenience, same as every console.warn already was) — a production failure returns a genuinely
// empty schema instead, so consuming pages show their own real "no data" state rather than a
// fake-but-plausible-looking one.
export function useFilterSchema() {
  const EMPTY_SCHEMA: FilterSchema = { categories: [] }

  return useAsyncData<FilterSchema>(
    'filter-schema',
    async () => {
      try {
        // Through this app's own cached passthrough（/api/bff, server/api/bff/[...path].get.ts）
        // since 2026-09-19: same GET /metrics path and shape, cached an hour on the server, so a
        // crawl of thousands of pages costs bff-ts one catalog call an hour instead of one each.
        return await $fetch<FilterSchema>('/metrics', { baseURL: '/api/bff', retry: 0 })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[metrics] GET /api/bff/metrics unavailable (${reason}), using sample schema instead`
          )
          return MOCK_FILTER_SCHEMA
        }
        return EMPTY_SCHEMA
      }
    },
    {
      default: () => (import.meta.dev ? MOCK_FILTER_SCHEMA : EMPTY_SCHEMA),
      // Without this, useAsyncData only dedupes the SSR→hydration handoff — a later
      // client-side remount (e.g. navigating away from /screener and back) calls this
      // composable fresh and refetches over the network by default, even though the schema
      // never changes mid-session. Since screener.vue awaits this at the top of its setup,
      // that refetch blocked the whole page from rendering anything until it resolved —
      // reported as a jitter/blank flash switching pages into the screener. Reusing whatever
      // is already in the payload (SSR) or static cache (a prior client fetch) skips that
      // network round-trip entirely on every visit after the first.
      getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
    }
  )
}
