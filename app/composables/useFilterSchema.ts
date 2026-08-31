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
}

export interface FilterMetric {
  key: string
  name: string
  path: string
  fields: FilterField[]
}

export interface FilterCategory {
  key: string
  name: string
  metrics: FilterMetric[]
}

export interface FilterSchema {
  categories: FilterCategory[]
}

// GET /filters' period codes are backend/reporting-cadence jargon (ttm = trailing twelve
// months, snapshot = as-of-latest-report point-in-time) — internal shorthand, never meant
// to reach the screen as-is. Unrecognized codes are dropped rather than shown raw, with a
// dev-only warning so a new one introduced by the real backend gets a translation added
// here instead of silently leaking through to users.
const PERIOD_LABELS: Record<string, string> = {
  ttm: '近四季',
  snapshot: '最新',
  quarterly: '單季',
  quarterlyAnnualized: '單季年化',
  annual: '年度',
  monthly: '每月',
  weekly: '每週',
  daily: '每日'
}

// Same fields the picker lists, ordered by how useful the period generally is for
// screening — TTM smooths out single-quarter noise, so it's the sensible default to land
// on first within a metric's field list. Anything not named here (a period introduced
// later) sorts after all of these, in whatever order the API returned it.
const PERIOD_SORT_ORDER: Record<string, number> = {
  ttm: 0,
  annual: 1,
  quarterly: 2,
  quarterlyAnnualized: 3,
  monthly: 4,
  weekly: 5,
  daily: 6,
  snapshot: 7
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

// `field.name` is just the metric's own name now — the API doesn't fold period info into
// it (no more "ROE（TTM，...)"-style strings) — so this is the one place that assembles the
// two back together for display. Still used by the indicator dialog's column-picking mode
// (see MoleculeIndicatorPickerBody's hidePeriod prop) — condition-picking no longer shows
// period at this step at all, see periodSiblingsOf below for where that moved to instead.
export function formatFieldLabel(field: FilterField): string {
  const periodLabel = formatPeriodLabel(field.period)
  return periodLabel ? `${field.name}（${periodLabel}）` : field.name
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
      metrics: [
        {
          key: 'returns',
          name: '股東權益報酬率／資產報酬率',
          path: '/api/profitability/returns',
          fields: [
            { key: 'roeTtm', name: 'ROE（股東權益報酬率）', period: 'ttm' },
            { key: 'roaTtm', name: 'ROA（資產報酬率）', period: 'ttm' }
          ]
        }
      ]
    },
    {
      key: 'guru',
      name: '大師策略與複合量化估值模型',
      metrics: [
        {
          key: 'grahamNumber',
          name: '葛拉漢數（Graham Number）',
          path: '/api/guru/graham-number',
          fields: [{ key: 'grahamNumber', name: '葛拉漢數', period: 'ttm' }]
        },
        {
          key: 'ncav',
          name: '葛拉漢淨流動資產價值（Graham NCAV）',
          path: '/api/guru/ncav',
          fields: [
            { key: 'ncav', name: 'NCAV（淨流動資產價值）', period: 'snapshot' },
            { key: 'marginOfSafetyPrice', name: '安全邊際價', period: 'snapshot' }
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
