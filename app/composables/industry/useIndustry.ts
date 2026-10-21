import type { IndustryPageData } from '#shared/types/hub'
import type { IndustryFacetKey } from '#shared/utils/hub-slugs'

// 類股個別頁每個面向共用的資料（2026-10-21，同 useEtf）：一支 /api/hub/industry/:code（公司表、分布、月營收、三率、景氣指標），伺服器端
// 讀，SSR 就有內容；面向之間換頁用同一個 key，不重抓。頁面在最上層 await 一次，結果整包交給 IndustryPage。
//
// 網址規則：代號是交易所的兩位數類股代號、slug 是本站的（shared/utils/hub-slugs.ts）；代號對但 slug 舊的 301 到正確網址的同一個面向，
// 代號不存在或類股沒有公司是真的 404（不回空白的 200）。有指標數值的公司少於 5 家 → noindex, follow：對人有用、對索引太薄
const INDEXABLE_ROW_FLOOR = 5

export async function useIndustry(facet: IndustryFacetKey) {
  const route = useRoute()
  const parsed = parseSectorParam(String(route.params.sector))
  const known = parsed ? SECTORS[parsed.code] : undefined
  if (!parsed || !known) throw createError({ statusCode: 404, statusMessage: '找不到這個類股', fatal: true })
  if (parsed.slug !== known.slug) await navigateTo(industryFacetPath(parsed.code, facet), { redirectCode: 301 })

  const code = parsed.code
  const { data, error } = await useFetch<IndustryPageData>(`/api/hub/industry/${code}`, { key: `hub-industry-${code}` })
  if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: '這個類股目前沒有任何公司', fatal: true })
  if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '類股資料暫時無法取得', fatal: true })

  const rows = computed(() => data.value?.companies.rows ?? [])
  const noindex = computed(() => rows.value.length < INDEXABLE_ROW_FLOOR)
  return { code, sectorName: known.name, data, rows, noindex }
}

export type Industry = Awaited<ReturnType<typeof useIndustry>>

// 側欄面向的順序（拖曳），同 ETF；「指標速覽」固定在最上面
export const useIndustryFacetOrder = () => useFacetOrder('industry-facet-order', INDUSTRY_FACETS.filter(facet => facet.key !== 'overview'))
