// 分享連結（2026-10-19，使用者：「設計分享持股或是 watchlist 的機制」）：有連結就能看、免登入，內容即時，分享時勾要顯示的欄位。
// 這裡是擁有者那一端：GET／PUT／DELETE /shares（業務中台）。一個對象（一份清單；持股是一個帳戶或全部帳戶）只有一條連結，
// PUT 沒有就建立、有就更新欄位（token 不變）。免登入的公開讀取在 pages/share/[token].vue（GET /public/shares/{token}）。
export type ShareKind = 'watchlist' | 'holdings'

export interface ShareColumn {
  key: string
  label: string
}

export interface Share {
  token: string
  kind: ShareKind
  watchlistId: string | null
  // 持股：null ＝ 全部帳戶
  portfolioId: string | null
  columns: ShareColumn[]
  // 持股分享頁的標題「○○分享的持股」，分享者自己填（業務中台 40b115c，2026-10-20）；沒填與觀察清單都是 null
  displayName: string | null
  createdAt: string
  updatedAt: string
}

// 網址裡的 token（業務中台 產生，128-bit 亂數的 base64url）。格式不對的網址不必問上游
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

// 報酬率欄的 key 從 pnlPct 改成 returnPct（2026-10-30，業務中台 B2）。業務中台搬完庫裡的舊 key 之前，讀到的設定可能還是 pnlPct
// shortcut: 業務中台 B2 第 2 步（migration）做完就拿掉這個與 HoldingsSharedView 的 pnlPct 別名
const withReturnPct = (share: Share): Share => ({ ...share, columns: share.columns.map(column => (column.key === 'pnlPct' ? { ...column, key: 'returnPct' } : column)) })

export function useShares() {
  const authedFetch = useAuthedFetch()
  const currentUser = useCurrentUser()
  // 依登入者快取：換了人（或登出）就重讀，上一個人的連結不留在畫面上
  const shares = useState<Share[] | null>('shares', () => null)
  const loadedFor = useState<string | null>('shares-loaded-for', () => null)

  async function ensureShares() {
    const uid = currentUser.value?.uid ?? null
    if (uid !== loadedFor.value) shares.value = null
    loadedFor.value = uid
    if (!uid || shares.value) return
    try {
      const response = await authedFetch<{ shares: Share[] }>('/shares')
      if (loadedFor.value === uid) shares.value = (response.shares ?? []).map(withReturnPct)
    } catch (error) {
      devWarn('shares', 'GET /shares unavailable', error)
    }
  }

  const shareOf = (kind: ShareKind, targetId: string | null) =>
    shares.value?.find(share => share.kind === kind && (kind === 'watchlist' ? share.watchlistId : share.portfolioId) === targetId) ?? null

  // 持股的 displayName 每次 PUT 整個換掉、沒送就變 null——只改欄位時也要帶著目前的名稱
  async function saveShare(kind: ShareKind, targetId: string | null, columns: ShareColumn[], displayName: string | null = null): Promise<Share | null> {
    try {
      const body = kind === 'watchlist' ? { kind, watchlistId: targetId, columns } : { kind, portfolioId: targetId, columns, displayName }
      const { share } = await authedFetch<{ share: Share }>('/shares', { method: 'PUT', body })
      shares.value = [...(shares.value ?? []).filter(item => item.token !== share.token), share]
      return share
    } catch (error) {
      devWarn('shares', 'PUT /shares failed', error)
      return null
    }
  }

  // 已經不在（清單刪了、連結跟著刪）的 404 也算關掉了
  async function revokeShare(token: string): Promise<boolean> {
    try {
      await readOrNull(authedFetch(`/shares/${token}`, { method: 'DELETE' }), 'shares')
      shares.value = (shares.value ?? []).filter(item => item.token !== token)
      return true
    } catch {
      return false
    }
  }

  return { shares, ensureShares, shareOf, saveShare, revokeShare }
}
