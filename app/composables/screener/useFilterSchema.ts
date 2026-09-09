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
  path: string
  fields: FilterField[]
  // Same semantics as FilterField.sort, scoped to sibling metrics under the same category.
  sort: number
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
  // Beta's own 3 lookback-window/sampling-interval combinations (the only fields that use
  // these three periods) — labeled with both, since a future period could reuse the same
  // lookback with a different sampling interval and "近1年" alone would then be ambiguous.
  '1Y_1D': '1年（日）',
  '2Y_1W': '2年（週）',
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
  '1Y_1D': 4,
  '2Y_1W': 5,
  '5Y_1M': 6
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

// Confirmed contract (oingg-bff-ts API reference): GET {apiBase}/filters -> FilterSchema,
// public (no auth). Falls back to the sample schema above if the BFF isn't reachable yet.
export function useFilterSchema() {
  const config = useRuntimeConfig()

  return useAsyncData<FilterSchema>(
    'filter-schema',
    async () => {
      try {
        return await $fetch<FilterSchema>('/filters', { baseURL: config.public.apiBase })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[filters] GET ${config.public.apiBase}/filters unavailable (${reason}), using sample schema instead`
          )
        }
        return MOCK_FILTER_SCHEMA
      }
    },
    {
      default: () => MOCK_FILTER_SCHEMA,
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
