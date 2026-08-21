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

// Used as the offline/dev fallback below — this is the exact sample payload the schema
// service is expected to return, so the filter builder still works before it's reachable.
const MOCK_FILTER_SCHEMA: FilterSchema = {
  categories: [
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

// Assumed contract: GET {filterApiBase}/filters -> FilterSchema. Falls back to the sample
// schema above if that service isn't reachable yet, same pattern as useStockUniverse.
export function useFilterSchema() {
  const config = useRuntimeConfig()

  return useAsyncData<FilterSchema>(
    'filter-schema',
    async () => {
      try {
        return await $fetch<FilterSchema>('/filters', { baseURL: config.public.filterApiBase })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[filters] GET ${config.public.filterApiBase}/filters unavailable (${reason}), using sample schema instead`
          )
        }
        return MOCK_FILTER_SCHEMA
      }
    },
    { default: () => MOCK_FILTER_SCHEMA }
  )
}
