export interface FilterField {
  key: string
  name: string
  period: string
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
// two back together for display. Every UI that shows a field's name (the picker dialog,
// the pill it ends up on) should go through this rather than reading `field.name` alone,
// so there's exactly one spot that knows how the two get combined.
export function formatFieldLabel(field: FilterField): string {
  const periodLabel = formatPeriodLabel(field.period)
  return periodLabel ? `${field.name}（${periodLabel}）` : field.name
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
    { default: () => MOCK_FILTER_SCHEMA }
  )
}
