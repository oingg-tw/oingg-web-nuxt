import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/screener/useFilterSearch'

// 使用者擁有的每種篩選器資源（這個、column-presets、觀察清單、持股、交易）的 id 都是 UUID 字串（bff-ts c40fa87：
// 流水號會洩漏列數與建立順序、容易被枚舉）。不要 Number(id)，那會靜默變成 NaN。
export interface ScreenerPreset {
  id: string
  name: string
  filters: FilterCriterion[]
  // 證交所類股代碼（bff-ts 2026-09-11 實測）：兩位數 TWSE／TPEx 類股碼（"24" 半導體業），跟 filters 裡的指標 fieldId 是不同
  // 的分類系統；多個代碼 OR，再跟每個數值條件 AND。存在 preset 上而不是每次 run 的參數，分頁才記得自己的範圍；
  // 代碼→名稱型錄是 GET /api/hub/sectors（getSectors）。這個欄位出現之前建立的 preset 沒有它。
  sectorCodes?: string[]
  // 反向範圍（2026-09-20 使用者要求「普通股篩選要有機制可以排除產業」）：除了這些類股以外的全部。跟 sectorCodes 互斥：
  // 兩個都非空 bff 回 400，PATCH 任一個會在伺服器端清掉另一個，呼叫端不用先抓再清。
  // 不在前端用「列出其他所有類股」模擬：約 51 家沒有類股分類的公司在排除法下會留下、在反向包含法下會被靜默丟掉
  // （實測 sectorCodes:["24"] 158 ＋ excludeSectorCodes:["24"] 1425 ＝ 全市場）。
  excludeSectorCodes?: string[]
  // run 回應裡的 preset 才有（剛建立的沒有，跑過一次才設），等於 run 回應最上層的 columnPresetId
  lastColumnPresetId?: string | null
  createdAt?: string
  updatedAt?: string
}

// 分頁在伺服器端、page 從 1 起，pageSize 省略時 50。count 是**整個結果集**的總檔數（2026-10-07 實測：pageSize 20 回
// count 2248、totalPages 113），篩選器的「目前符合 N 檔」就是讀它。
export interface ScreenerPaginationParams {
  page?: number
  pageSize?: number
}

// 整個結果集的排序（bff-ts 2026-09-01 實測）：伺服器在分頁前排，用這個 GET 端點的 query。sortField 只能是 "symbol" 或這次執行的
// 欄位 key；"name" 不支援（公司名是每次請求另外從 analysis-ts 接上的，不在可查詢的資料裡），在 SharedMetricTable 做頁內排序。
// 兩個欄位要一起給，只給一個會 400，所以包成一個物件。
export interface ScreenerSortParams {
  field: string
  order: 'asc' | 'desc'
}

interface ScreenerPagination {
  page: number
  pageSize: number
  totalPages: number
}

// GET /screener/presets/{id}/run 的回應包在 `screener` 底下（不是平的）；run() 攤平成 ScreenerRunResult。
interface ScreenerRunApiResponse {
  preset: ScreenerPreset
  screener: {
    count: number
    columns: ScreenerResultColumn[]
    results: ScreenerResultRow[]
  } & ScreenerPagination
  // 伺服器決定這次顯示的欄位組合：傳入的 columnPresetId → 這個 preset 上次看的 → 使用者的 isDefault → null（內建的
  // 股價／PER／PBR／殖利率）。下次 run 把它傳回去，伺服器就記成這個分頁的檢視。
  columnPresetId: string | null
}

export interface ScreenerRunResult extends ScreenerPagination {
  count: number
  columns: ScreenerResultColumn[]
  results: ScreenerResultRow[]
  columnPresetId: string | null
  preset: ScreenerPreset
}

// 訪客用的無狀態 POST /screener（2026-09-11 實測，不帶 Authorization），對應登入後的 /screener/presets/{id}/run（見
// useGuestScreener）。回應是平的：count／page／pageSize／totalPages／columns／results 都在最上層，沒有 preset。
// `columns`（欄位 key 陣列，例如 ColumnPresetTemplate 的 fieldKeys）跟 columnPresetId 互斥（都給回 400）；送 columns 時
// columnPresetId 永遠是 null，所以結果型別不帶它。
export interface StatelessScreenerRunParams {
  filters: FilterCriterion[]
  columns?: string[]
  sectorCodes?: string[]
  // 見 ScreenerPreset.excludeSectorCodes，互斥規則相同
  excludeSectorCodes?: string[]
  pagination?: ScreenerPaginationParams
  sort?: ScreenerSortParams
}

export interface StatelessScreenerRunResult extends ScreenerPagination {
  count: number
  columns: ScreenerResultColumn[]
  results: ScreenerResultRow[]
}

interface StatelessScreenerRunApiResponse extends ScreenerPagination {
  count: number
  columns: ScreenerResultColumn[]
  results: ScreenerResultRow[]
  columnPresetId: string | null
}

// bff-ts /api-docs 與實際回應確認：POST /screener/presets 回 { preset: {...} }（不是 /watchlist 的 { item }），list() 假設對應的
// { presets: [...] }。
export function useScreenerPresets() {
  const currentUser = useCurrentUser()
  const authedFetch = useAuthedFetch()

  // 每次失敗都更新，呼叫端在拿到 falsy 回傳值之後讀：訊息是 bff 給的理由（例如「此名稱已被使用」；網路錯誤或逾時是 null，
  // 呼叫端用自己的文案）；代碼讓 quota_exceeded 顯示「額度已滿＋看方案」而不是通用的失敗訊息（2026-10-06）
  const lastErrorMessage = ref<string | null>(null)
  const lastErrorCode = ref<string | null>(null)

  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeBffError(error)
    lastErrorCode.value = bffErrorCode(error) ?? null
    devWarn('screener-presets', `${action} failed`, error)
  }

  async function list(): Promise<ScreenerPreset[]> {
    if (!currentUser.value) return []
    try {
      const response = await authedFetch<{ presets: ScreenerPreset[] }>('/screener/presets')
      return response.presets
    } catch (error) {
      warn('GET /screener/presets', error)
      return []
    }
  }

  async function create(filters: FilterCriterion[], sectorCodes?: string[]): Promise<ScreenerPreset | null> {
    if (!currentUser.value) return null
    try {
      const response = await authedFetch<{ preset: ScreenerPreset }>('/screener/presets', {
        method: 'POST',
        body: { filters, ...(sectorCodes !== undefined ? { sectorCodes } : {}) }
      })
      return response.preset
    } catch (error) {
      warn('POST /screener/presets', error)
      return null
    }
  }

  async function update(
    id: string,
    patch: { name?: string; filters?: FilterCriterion[]; sectorCodes?: string[]; excludeSectorCodes?: string[] }
  ): Promise<ScreenerPreset | null> {
    if (!currentUser.value) return null
    try {
      const response = await authedFetch<{ preset: ScreenerPreset }>(`/screener/presets/${id}`, { method: 'PATCH', body: patch })
      return response.preset
    } catch (error) {
      warn(`PATCH /screener/presets/${id}`, error)
      return null
    }
  }

  // 整份取代（bff-ts 2026-09-11，跟 column-presets 同一個契約）：呼叫端自己全部 preset 的 id、照順序，跟現況不一致回 400。
  // 沒有這支之前拖曳排序只是分頁內的假象——沒有 order 欄位，重新整理就回到 createdAt desc。
  async function reorder(ids: string[]): Promise<boolean> {
    if (!currentUser.value) return false
    try {
      await authedFetch('/screener/presets/reorder', { method: 'POST', body: { ids } })
      return true
    } catch (error) {
      warn('POST /screener/presets/reorder', error)
      return false
    }
  }

  // 訪客的無狀態執行：不建立任何後端資源。給了 columns 就送 columns、從不送 columnPresetId——訪客沒有自己的 ColumnPreset 可指。
  async function runStateless(params: StatelessScreenerRunParams): Promise<StatelessScreenerRunResult | null> {
    try {
      const response = await apiFetch<StatelessScreenerRunApiResponse>('/screener', {
        method: 'POST',
        body: {
          filters: params.filters,
          ...(params.columns ? { columns: params.columns } : {}),
          ...(params.sectorCodes?.length ? { sectorCodes: params.sectorCodes } : {}),
          ...(params.excludeSectorCodes?.length ? { excludeSectorCodes: params.excludeSectorCodes } : {}),
          ...params.pagination,
          ...(params.sort ? { sortField: params.sort.field, sortOrder: params.sort.order } : {})
        }
      })
      return {
        count: response.count,
        columns: response.columns,
        results: response.results,
        page: response.page,
        pageSize: response.pageSize,
        totalPages: response.totalPages
      }
    } catch (error) {
      warn('POST /screener', error)
      return null
    }
  }

  async function remove(id: string): Promise<boolean> {
    if (!currentUser.value) return false
    try {
      await authedFetch(`/screener/presets/${id}`, { method: 'DELETE' })
      return true
    } catch (error) {
      warn(`DELETE /screener/presets/${id}`, error)
      return false
    }
  }

  async function run(
    id: string,
    columnPresetId?: string,
    pagination?: ScreenerPaginationParams,
    sort?: ScreenerSortParams
  ): Promise<ScreenerRunResult | null> {
    if (!currentUser.value) return null
    try {
      const response = await authedFetch<ScreenerRunApiResponse>(`/screener/presets/${id}/run`, {
        query: {
          ...(columnPresetId !== undefined ? { columnPresetId } : {}),
          ...pagination,
          ...(sort ? { sortField: sort.field, sortOrder: sort.order } : {})
        }
      })
      return {
        count: response.screener.count,
        columns: response.screener.columns,
        results: response.screener.results,
        columnPresetId: response.columnPresetId,
        preset: response.preset,
        page: response.screener.page,
        pageSize: response.screener.pageSize,
        totalPages: response.screener.totalPages
      }
    } catch (error) {
      warn(`GET /screener/presets/${id}/run`, error)
      return null
    }
  }

  return { list, create, update, remove, reorder, run, runStateless, lastErrorMessage, lastErrorCode }
}
