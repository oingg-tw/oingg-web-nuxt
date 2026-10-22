import type { MetricCategory } from '~/composables/screener/useFilterSchema'
import type { FilterCriterion } from '~/composables/screener/useFilterSearch'
import type { TabFilterSlot } from '~/composables/screener/screener-tab-model'
import type { ScreenerUrlFilter, ScreenerUrlState } from '~/utils/screener-url'

// 篩選頁的網址跟著目前這一組走（2026-10-22，使用者要書籤與分享，選了條件＋欄位＋排序）：改條件、欄位、排序，網址就換成對應的
// ?f=…&c=…&sort=…（replace，不留一長串上一頁）。打開網址的那一側各自處理（普通股在頁面、ETF／特別股在 useUniverseScreener），
// 這裡是兩邊共用的轉換與「畫面 → 網址」。格式在 app/utils/screener-url.ts

// 畫面上的條件 → 網址的條件：沒選欄位、數字沒有上下限、類別沒勾的都不算（同 filtersOf）。類股（sector.code）也在裡面
export function urlFiltersOf(slots: TabFilterSlot[], fieldOut: (fieldId: string) => string = fieldId => fieldId): ScreenerUrlFilter[] {
  return slots.flatMap((slot): ScreenerUrlFilter[] => {
    if (!slot.fieldId) return []
    if (slot.values?.length) return [{ field: fieldOut(slot.fieldId), min: null, max: null, exclude: slot.exclude, values: [...slot.values] }]
    if (slot.values !== undefined || (slot.min === null && slot.max === null)) return []
    return [{ field: fieldOut(slot.fieldId), min: slot.min, max: slot.max, exclude: slot.exclude }]
  })
}

// 網址的條件 → 篩選條件：型錄沒有的不帶（業務中台對不認得的欄位整個查詢回 400），類別值照型錄的選項換回原本的型別（除權息月份的
// 選項值是整數，網址讀出來是字串，膠囊比對選項用 ===）
export function filtersFromUrl(filters: ScreenerUrlFilter[], categories: MetricCategory[], fieldIn: (field: string) => string = field => field): FilterCriterion[] {
  return filters.flatMap((filter): FilterCriterion[] => {
    const fieldId = fieldIn(filter.field)
    const metric = locateFieldInSchema(categories, fieldId)?.metric
    if (!metric) return []
    const values = filter.values?.map(value => metric.options?.find(option => String(option.value) === String(value))?.value ?? value)
    return [{ field: fieldId, min: filter.min, max: filter.max, exclude: filter.exclude, ...(values ? { values } : {}) }]
  })
}

// state 回 null（還在處理打開時的網址、或沒有頁籤）就不動網址。用過的進入參數（?template、?sector）也在這時候一起拿掉
const URL_KEYS = ['f', 'c', 'sort']
export function useScreenerUrlSync(state: () => ScreenerUrlState | null) {
  const route = useRoute()
  const router = useRouter()
  const empty: ScreenerUrlState = { filters: [], columns: [], sort: null }
  watch(state, (value) => {
    if (!value) return
    const query = encodeScreenerQuery(value)
    const current = encodeScreenerQuery(decodeScreenerQuery(route.query) ?? empty)
    const extraKeys = Object.keys(route.query).some(key => !URL_KEYS.includes(key))
    if (extraKeys || JSON.stringify(query) !== JSON.stringify(current)) router.replace({ query })
  }, { deep: true, immediate: true })
}
