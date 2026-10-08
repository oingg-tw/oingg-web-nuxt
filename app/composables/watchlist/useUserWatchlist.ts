// bff-ts 的 GET/POST/DELETE /watchlist（契約 2026-09-28 向 bff-ts 取得並實測確認；在那之前我們從沒接過它，
// 使用者加進去的股票重新整理就不見）。
//
// 形狀跟 pinnedMetricSlugs 那種「整份取代的使用者設定」不一樣，不能照搬 useStockPinnedMetricsSync：
//   - 每一筆有自己的 UUID，刪除是 DELETE /watchlist/{uuid}，不是 /watchlist/{symbol}——前端必須保留 id。
//   - 新增是單筆 POST，沒有整份取代；**不是冪等**：重複加入回 409，未知代號回 404（POST 會先跟 analysis-ts 查一次報價）。
//   - 順序由 POST /watchlist/reorder 存（見 reorderWatchlist）。
// 配額不要硬編碼：GET /billing/entitlement 的 quotas.watchlistItems 是唯一權威（null = 無限）。bff-ts 2026-09-28 實測回報那個
// 上限**目前沒有被強制**（enforceQuota 漏掛在 watchlist），補上之後會回 403 code: "quota_exceeded"，這裡已經準備好那條路。
export interface UserWatchlistItem {
  id: string
  symbol: string
  note: string | null
}

export type AddWatchlistResult =
  | { ok: true; item: UserWatchlistItem }
  // duplicate：後端已經有了，本地照樣顯示；unknown：代號不存在，要把本地那一筆收回去
  | { ok: false; reason: 'duplicate' | 'unknown' | 'quota' | 'offline' }

export interface WatchlistColumn {
  field: string
  label: string
}

// 同步失敗不彈錯誤訊息（跟主題偏好同一個理由）：本地已經改好了，失敗只代表這一次沒存到帳號，下一次成功的同步會蓋回去。
// 加入／刪除的**語意性**失敗（重複、代號不存在、超過配額）另外由回傳值表達，那些要讓使用者知道。
export function useUserWatchlist() {
  const currentUser = useCurrentUser()
  const authedFetch = useAuthedFetch()

  // undefined = 這次根本沒問到（未登入／網路或驗證失敗），呼叫端要保留本地狀態不動；
  // 空陣列 = 問到了而且帳號裡真的沒有東西，那是可以直接套用的答案。這兩件事分開，
  // 是因為把前者當成後者會在一次網路失敗之後清空使用者的清單。
  async function fetchWatchlist(): Promise<UserWatchlistItem[] | undefined> {
    if (!currentUser.value) return undefined
    try {
      const response = await authedFetch<{ items: UserWatchlistItem[] }>('/watchlist')
      return response.items ?? []
    } catch (error) {
      devWarn('user-watchlist', 'GET /watchlist failed', error)
      return undefined
    }
  }

  async function addToWatchlist(symbol: string): Promise<AddWatchlistResult> {
    if (!currentUser.value) return { ok: false, reason: 'offline' }
    try {
      const response = await authedFetch<{ item: UserWatchlistItem }>('/watchlist', { method: 'POST', body: { symbol } })
      return { ok: true, item: response.item }
    } catch (error) {
      const status = bffErrorStatus(error)
      if (status === 409) return { ok: false, reason: 'duplicate' }
      if (status === 404) return { ok: false, reason: 'unknown' }
      // 看 code 不看狀態碼（同 holding-columns、watchlist-columns）：403 不一定是額度
      if (bffErrorCode(error) === 'quota_exceeded') return { ok: false, reason: 'quota' }
      devWarn('user-watchlist', 'POST /watchlist failed', error)
      return { ok: false, reason: 'offline' }
    }
  }

  async function removeFromWatchlist(id: string): Promise<boolean> {
    if (!currentUser.value) return false
    try {
      await authedFetch(`/watchlist/${id}`, { method: 'DELETE' })
      return true
    } catch (error) {
      // 404 代表那一筆已經不在了——對「刪除」來說那就是想要的結果，不算失敗。
      if (bffErrorStatus(error) === 404) return true
      devWarn('user-watchlist', 'DELETE /watchlist/{id} failed', error)
      return false
    }
  }

  // PATCH /watchlist/{id} { note }（bff-ts 既有端點，2026-10-06 讀原始碼確認；只能改 note）。null ＝ 清空。
  // 跟加入不同，這裡失敗要讓使用者知道：備註是使用者打的字，靜默沒存到就是弄丟了。
  async function updateNote(id: string, note: string | null): Promise<boolean> {
    if (!currentUser.value) return false
    try {
      await authedFetch(`/watchlist/${id}`, { method: 'PATCH', body: { note } })
      return true
    } catch (error) {
      devWarn('user-watchlist', 'PATCH /watchlist/{id} failed', error)
      return false
    }
  }

  // POST /watchlist/reorder { ids }（bff-ts f39f811，2026-10-06）。ids 必須剛好是清單裡的每一筆、各一次，
  // 否則 400 而且什麼都沒寫入——那時候呼叫端要重抓清單。GET /watchlist 的陣列順序就是這個順序。
  async function reorderWatchlist(ids: string[]): Promise<'ok' | 'mismatch' | 'failed'> {
    if (!currentUser.value) return 'failed'
    try {
      await authedFetch('/watchlist/reorder', { method: 'POST', body: { ids } })
      return 'ok'
    } catch (error) {
      // 依錯誤代碼判斷（2026-10-08）；三個批次排序端點共用這個代碼（bff aa12b78）
      if (bffErrorCode(error) === 'reorder_mismatch') return 'mismatch'
      devWarn('user-watchlist', 'POST /watchlist/reorder failed', error)
      return 'failed'
    }
  }

  // GET／PUT /users/me/watchlist-columns（bff-ts 9a2eeff，2026-10-06）。存的是整張表的欄位、照顯示順序，
  // 包含預設那 5 欄——所以免費方案的上限是 8（5＋3）。field 會對型錄驗證；兩個假欄位 watchlist.change／
  // watchlist.exDividend 是 bff-ts 特別放行的字面值。
  // 回傳 null ＝ 從沒存過（用預設欄位）；undefined ＝ 這次沒問到（不要覆蓋本地狀態）。
  async function fetchColumns(): Promise<WatchlistColumn[] | null | undefined> {
    if (!currentUser.value) return undefined
    try {
      const response = await authedFetch<{ watchlistColumns: { columns: WatchlistColumn[] | null } }>('/users/me/watchlist-columns')
      return response.watchlistColumns?.columns ?? null
    } catch (error) {
      devWarn('user-watchlist', 'GET /users/me/watchlist-columns failed', error)
      return undefined
    }
  }

  // 整份覆蓋。quota：403 quota_exceeded（只在清單變長時才會擋，降級的人仍可以重排或刪）。
  async function saveColumns(columns: WatchlistColumn[]): Promise<'ok' | 'quota' | 'failed'> {
    if (!currentUser.value) return 'failed'
    try {
      await authedFetch('/users/me/watchlist-columns', { method: 'PUT', body: { columns } })
      return 'ok'
    } catch (error) {
      // 看 code 不看狀態碼，同持股頁的 holding-columns
      if (bffErrorCode(error) === 'quota_exceeded') return 'quota'
      devWarn('user-watchlist', 'PUT /users/me/watchlist-columns failed', error)
      return 'failed'
    }
  }

  return { fetchWatchlist, addToWatchlist, removeFromWatchlist, updateNote, reorderWatchlist, fetchColumns, saveColumns }
}
