import { withTimeout } from '~/utils/with-timeout'

// bff-ts 的 GET/POST/DELETE /watchlist（契約 2026-09-28 向 bff-ts 取得並實測確認）。這支端點一直都在，
// 只是我們從來沒接——所以他們那張 WatchlistItem 表是 0 列，而使用者加進去的股票重新整理就不見。
//
// **形狀跟 pinnedMetricSlugs 那種「整份取代的使用者設定」不一樣，不能照搬 useStockDetailPreferencesSync**：
//
//   - 每一筆有自己的 UUID，刪除是 DELETE /watchlist/{uuid}，不是 /watchlist/{symbol}。所以前端必須
//     保留 id，只存一個 symbol 陣列是刪不掉東西的。
//   - 新增是單筆 POST，沒有 { symbols: [] } 的整份取代。
//   - **不是冪等**：重複加入回 409，未知代號回 404（POST 會先跟 analysis-ts 查一次報價確認代號存在）。
//   - 排序由後端決定（createdAt desc，新的在前），沒有 position 欄位，所以使用者自訂順序目前無處可存。
//
// 配額不要硬編碼：GET /billing/entitlement 的 quotas.watchlistItems 是唯一權威（null = 無限）。
// bff-ts 2026-09-28 實測回報那個上限**目前沒有被強制**（enforceQuota 中介層掛在 screenerPresets 與
// columnPresets，唯獨漏了 watchlist），所以第 11 筆現在會成功。補上之後會回 403 code: "quota_exceeded"，
// 這裡先準備好那條路，不要等它上線才發現沒處理。
export interface UserWatchlistItem {
  id: string
  symbol: string
  note: string | null
}

export interface WatchlistQuota {
  tier: string
  // null = 無限
  limit: number | null
}


export type AddWatchlistResult =
  | { ok: true; item: UserWatchlistItem }
  // duplicate：後端已經有了，本地照樣顯示；unknown：代號不存在，要把本地那一筆收回去
  | { ok: false; reason: 'duplicate' | 'unknown' | 'quota' | 'offline' }

export function useUserWatchlist() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  const authHeader = useAuthHeader()

  // 同步失敗不彈錯誤訊息，跟 useUserStockDetailPreferences 的 warn() 同一個理由：本地已經改好了，
  // 失敗只代表這一次沒存到帳號，下一次成功的同步會蓋回去。加入／刪除的**語意性**失敗（重複、代號不存在、
  // 超過配額）另外由回傳值表達，那些要讓使用者知道。
  function warn(action: string, error: unknown) {
    if (!import.meta.dev) return
    console.warn(`[user-watchlist] ${action} failed (${error instanceof Error ? error.message : String(error)})`)
  }

  // undefined = 這次根本沒問到（未登入／網路或驗證失敗），呼叫端要保留本地狀態不動；
  // 空陣列 = 問到了而且帳號裡真的沒有東西，那是可以直接套用的答案。這兩件事分開，
  // 是因為把前者當成後者會在一次網路失敗之後清空使用者的清單。
  async function fetchWatchlist(): Promise<UserWatchlistItem[] | undefined> {
    const headers = await authHeader()
    if (!headers) return undefined
    try {
      const response = await $fetch<{ items: UserWatchlistItem[] }>('/watchlist', {
        baseURL: config.public.apiBase,
        headers,
        timeout: BFF_REQUEST_TIMEOUT_MS,
        cache: 'no-store'
      })
      return response.items ?? []
    } catch (error) {
      warn('GET /watchlist', error)
      return undefined
    }
  }

  async function addToWatchlist(symbol: string): Promise<AddWatchlistResult> {
    const headers = await authHeader()
    if (!headers) return { ok: false, reason: 'offline' }
    try {
      const response = await $fetch<{ item: UserWatchlistItem }>('/watchlist', {
        baseURL: config.public.apiBase,
        method: 'POST',
        headers,
        body: { symbol },
        timeout: BFF_REQUEST_TIMEOUT_MS
      })
      return { ok: true, item: response.item }
    } catch (error) {
      const status = bffErrorStatus(error)
      if (status === 409) return { ok: false, reason: 'duplicate' }
      if (status === 404) return { ok: false, reason: 'unknown' }
      if (status === 403) return { ok: false, reason: 'quota' }
      warn('POST /watchlist', error)
      return { ok: false, reason: 'offline' }
    }
  }

  async function removeFromWatchlist(id: string): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch(`/watchlist/${id}`, {
        baseURL: config.public.apiBase,
        method: 'DELETE',
        headers,
        timeout: BFF_REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      // 404 代表那一筆已經不在了——對「刪除」來說那就是想要的結果，不算失敗。
      if (bffErrorStatus(error) === 404) return true
      warn('DELETE /watchlist/{id}', error)
      return false
    }
  }

  // PATCH /watchlist/{id} { note }（bff-ts 既有端點，2026-10-06 讀原始碼確認；只能改 note）。null ＝ 清空。
  // 跟加入不同，這裡失敗要讓使用者知道：備註是使用者打的字，靜默沒存到就是弄丟了。
  async function updateNote(id: string, note: string | null): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch(`/watchlist/${id}`, {
        baseURL: config.public.apiBase,
        method: 'PATCH',
        headers,
        body: { note },
        timeout: BFF_REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn('PATCH /watchlist/{id}', error)
      return false
    }
  }

  // POST /watchlist/reorder { ids }（bff-ts f39f811，2026-10-06）。ids 必須剛好是清單裡的每一筆、各一次，
  // 否則 400 而且什麼都沒寫入——那時候呼叫端要重抓清單。GET /watchlist 的陣列順序就是這個順序。
  async function reorderWatchlist(ids: string[]): Promise<'ok' | 'mismatch' | 'failed'> {
    const headers = await authHeader()
    if (!headers) return 'failed'
    try {
      await $fetch('/watchlist/reorder', {
        baseURL: config.public.apiBase,
        method: 'POST',
        headers,
        body: { ids },
        timeout: BFF_REQUEST_TIMEOUT_MS
      })
      return 'ok'
    } catch (error) {
      if (bffErrorStatus(error) === 400) return 'mismatch'
      warn('POST /watchlist/reorder', error)
      return 'failed'
    }
  }

  async function fetchQuota(): Promise<WatchlistQuota | undefined> {
    const headers = await authHeader()
    if (!headers) return undefined
    try {
      const response = await $fetch<{ tier: string; quotas?: { watchlistItems?: number | null } }>('/billing/entitlement', {
        baseURL: config.public.apiBase,
        headers,
        timeout: BFF_REQUEST_TIMEOUT_MS,
        cache: 'no-store'
      })
      return { tier: response.tier, limit: response.quotas?.watchlistItems ?? null }
    } catch (error) {
      warn('GET /billing/entitlement', error)
      return undefined
    }
  }

  return { fetchWatchlist, addToWatchlist, removeFromWatchlist, updateNote, reorderWatchlist, fetchQuota }
}
