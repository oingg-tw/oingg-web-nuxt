import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { ScreenerUniverse } from '~/utils/screener-zone'

// 使用者擁有的每種篩選器資源（這個、column-presets、觀察清單、持股、交易）的 id 都是 UUID 字串（業務中台 c40fa87：
// 流水號會洩漏列數與建立順序、容易被枚舉）。不要 Number(id)，那會靜默變成 NaN。
export interface ScreenerPreset {
  id: string
  name: string
  filters: FilterCriterion[]
  // 證交所類股代碼（業務中台 2026-09-11 實測）：兩位數 TWSE／TPEx 類股碼（"24" 半導體業），跟 filters 裡的指標 fieldId 是不同
  // 的分類系統；多個代碼 OR，再跟每個數值條件 AND。存在 preset 上而不是每次 run 的參數，分頁才記得自己的範圍；
  // 代碼→名稱型錄是 GET /api/hub/sectors（getSectors）。這個欄位出現之前建立的 preset 沒有它。
  sectorCodes?: string[]
  // 反向範圍（2026-09-20 使用者要求「普通股篩選要有機制可以排除產業」）：除了這些類股以外的全部。跟 sectorCodes 互斥：
  // 兩個都非空 業務中台 回 400，PATCH 任一個會在伺服器端清掉另一個，呼叫端不用先抓再清。
  // 不在前端用「列出其他所有類股」模擬：約 51 家沒有類股分類的公司在排除法下會留下、在反向包含法下會被靜默丟掉
  // （實測 sectorCodes:["24"] 158 ＋ excludeSectorCodes:["24"] 1425 ＝ 全市場）。
  excludeSectorCodes?: string[]
  // 已經持有（2026-10-22，業務中台 5034637）：帳戶 id，互斥規則同類股。可能含已刪除的帳戶（執行時當成沒持股）
  heldPortfolioIds?: string[]
  excludeHeldPortfolioIds?: string[]
  // run 回應裡的 preset 才有（剛建立的沒有，跑過一次才設），等於 run 回應最上層的 columnPresetId
  lastColumnPresetId?: string | null
  // 上次的排序（業務中台 c9e2208，2026-10-23；使用者：「screener 也要儲存用戶上次的排序 這樣用戶才不用每次點」）：三組都有，兩個一起
  // 有或一起 null，舊的組合是 null。run 不會自動套用，打開時由前端帶（useScreenerTabs／useUniverseScreener 的 presetToTab）
  sortField?: string | null
  order?: 'asc' | 'desc' | null
  createdAt?: string
  updatedAt?: string
}

// 分頁在伺服器端、page 從 1 起，pageSize 省略時 50。count 是**整個結果集**的總檔數（2026-10-07 實測：pageSize 20 回
// count 2248、totalPages 113），篩選器的「目前符合 N 檔」就是讀它。
export interface ScreenerPaginationParams {
  page?: number
  pageSize?: number
}

// 整個結果集的排序（業務中台 2026-09-01 實測）：伺服器在分頁前排，用這個 GET 端點的 query。sortField 只能是 "symbol" 或這次執行的
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

// Go 換版並存（contract-delta A1）：結果列的公司名稱 business-ts 叫 name、Go 版叫 companyName（preset.name 是組合名稱，沒改）
const withName = (rows: (ScreenerResultRow & { companyName?: string })[]): ScreenerResultRow[] =>
  rows.map(({ companyName, ...row }) => ({ ...row, name: companyName ?? row.name }))

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
  heldPortfolioIds?: string[]
  excludeHeldPortfolioIds?: string[]
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

// 放在 body 最上層的範圍（類股、已經持有，見 screener-tab-model.ts 的 scopeFor）
type PresetScope = Pick<ScreenerPreset, 'sectorCodes' | 'excludeSectorCodes' | 'heldPortfolioIds' | 'excludeHeldPortfolioIds'>

// 建立與無狀態查詢只送非空的那幾個（兩邊都非空 業務中台 回 400）；PATCH 原樣送，空陣列是「清掉」
function nonEmptyScope(scope: PresetScope): PresetScope {
  return Object.fromEntries(Object.entries({
    sectorCodes: scope.sectorCodes,
    excludeSectorCodes: scope.excludeSectorCodes,
    heldPortfolioIds: scope.heldPortfolioIds,
    excludeHeldPortfolioIds: scope.excludeHeldPortfolioIds
  }).filter(([, codes]) => codes?.length))
}

// 業務中台 /api-docs 與實際回應確認：POST /screener/presets 回 { preset: {...} }（不是 /watchlist 的 { item }），list() 假設對應的
// { presets: [...] }。
// universe（業務中台 84112d8，2026-10-15）：三組篩選共用這個資源。清單、建立、排序都要帶；不帶就是普通股，跟以前一樣。
// 改名、改條件、刪除用 id 就夠（universe 建立後不能改）。/:id/run 只有普通股能用，特別股與 ETF 自己查。
export function useScreenerPresets(universe: ScreenerUniverse = 'common') {
  const currentUser = useCurrentUser()
  const authedFetch = useAuthedFetch()

  // 每次失敗都更新，呼叫端在拿到 falsy 回傳值之後讀：訊息是 業務中台 給的理由（例如「此名稱已被使用」；網路錯誤或逾時是 null，
  // 呼叫端用自己的文案）；代碼讓 quota_exceeded 顯示「額度已滿＋看方案」而不是通用的失敗訊息（2026-10-06）
  const lastErrorMessage = ref<string | null>(null)
  const lastErrorCode = ref<string | null>(null)
  // 錯誤物件本身（2026-10-11）：篩選器搜尋讀不到時要交給全站彈窗分類（逾時／忙碌／連不上），只有訊息不夠
  const lastError = shallowRef<unknown>(null)

  function warn(action: string, error: unknown) {
    lastError.value = error
    lastErrorMessage.value = describeBusinessError(error)
    lastErrorCode.value = businessErrorCode(error) ?? null
    devWarn('screener-presets', `${action} failed`, error)
  }

  async function list(): Promise<ScreenerPreset[]> {
    if (!currentUser.value) return []
    try {
      const response = await authedFetch<{ presets: ScreenerPreset[] }>('/screener/presets', { query: { universe } })
      return response.presets
    } catch (error) {
      warn('GET /screener/presets', error)
      return []
    }
  }

  // 類股範圍建立時就帶（2026-10-19）：filters 是空的又沒帶類股，業務中台 會自動補「ROE > 30」當起點——「只看半導體」先建立再 PATCH
  // 類股，存下來會變成「半導體且 ROE > 30」。空陣列不送（兩邊都非空 業務中台 回 400）
  async function create(filters: FilterCriterion[], scope: PresetScope = {}): Promise<ScreenerPreset | null> {
    if (!currentUser.value) return null
    try {
      const response = await authedFetch<{ preset: ScreenerPreset }>('/screener/presets', {
        method: 'POST',
        body: { universe, filters, ...nonEmptyScope(scope) }
      })
      return response.preset
    } catch (error) {
      warn('POST /screener/presets', error)
      return null
    }
  }

  async function update(
    id: string,
    patch: { name?: string; filters?: FilterCriterion[]; sortField?: string | null; order?: 'asc' | 'desc' | null } & PresetScope
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

  // 整份取代（業務中台 2026-09-11，跟 column-presets 同一個契約）：呼叫端自己全部 preset 的 id、照順序，跟現況不一致回 400。
  // 沒有這支之前拖曳排序只是分頁內的假象——沒有 order 欄位，重新整理就回到 createdAt desc。
  async function reorder(ids: string[]): Promise<boolean> {
    if (!currentUser.value) return false
    try {
      await authedFetch('/screener/presets/reorder', { method: 'POST', body: { ids, universe } })
      return true
    } catch (error) {
      warn('POST /screener/presets/reorder', error)
      return false
    }
  }

  // 訪客的無狀態執行：不建立任何後端資源。給了 columns 就送 columns、從不送 columnPresetId——訪客沒有自己的 ColumnPreset 可指。
  // 登入的人（還沒存的那一組）帶身分：「已經持有」的條件與欄位沒登入 業務中台 回 401
  async function runStateless(params: StatelessScreenerRunParams): Promise<StatelessScreenerRunResult | null> {
    try {
      const response = await (currentUser.value ? authedFetch : apiFetch)<StatelessScreenerRunApiResponse>('/screener', {
        method: 'POST',
        body: {
          filters: params.filters,
          ...(params.columns ? { columns: params.columns } : {}),
          ...nonEmptyScope(params),
          ...params.pagination,
          ...(params.sort ? { sortField: params.sort.field, order: params.sort.order } : {})
        }
      })
      return {
        count: response.count,
        columns: response.columns,
        results: withName(response.results),
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
          ...(sort ? { sortField: sort.field, order: sort.order } : {})
        }
      })
      return {
        count: response.screener.count,
        columns: response.screener.columns,
        results: withName(response.screener.results),
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

  return { list, create, update, remove, reorder, run, runStateless, lastErrorMessage, lastErrorCode, lastError }
}
