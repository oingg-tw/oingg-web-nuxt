// 分享連結（2026-10-19，使用者：「設計分享持股或是 watchlist 的機制」）：有連結就能看、免登入，分享時勾要顯示的欄位。
// 這裡是擁有者那一端：GET／PUT／DELETE /shares（業務中台）。一個對象（一份清單；持股是一個帳戶或全部帳戶）只有一條連結，
// PUT 沒有就建立、有就更新欄位（token 不變）。免登入的公開讀取在 pages/share/[token].vue（GET /public/shares/{token}）。
// 2026-11-09 起（業務中台 48a1c34，資安盤點 H1、L9）：連結有期限（7／30／90 天，沒送是 30），每次 PUT 都從那天重新算；公開頁讀
// 業務中台的快照，內容最多晚 10 分鐘，改設定時快照馬上清掉
export type ShareKind = 'watchlist' | 'holdings'

export const SHARE_EXPIRY_DAYS = [7, 30, 90] as const
export type ShareExpiryDays = typeof SHARE_EXPIRY_DAYS[number]

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
  // 到期後公開頁回 404，跟不存在一樣。2026-11-09 以前建的是 null（不過期），下次存的時候才套用期限
  expiresAt: string | null
  // 持股「全部帳戶」固定包含的帳戶（存的那一刻有的）：之後新建的帳戶要再存一次才會出現；單一帳戶與清單是 null
  portfolioIds: string[] | null
  createdAt: string
  updatedAt: string
}

// 網址裡的 token（業務中台 產生，128-bit 亂數的 base64url）。格式不對的網址不必問上游
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

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
      if (loadedFor.value === uid) shares.value = response.shares ?? []
    } catch (error) {
      devWarn('shares', 'GET /shares unavailable', error)
    }
  }

  const shareOf = (kind: ShareKind, targetId: string | null) =>
    shares.value?.find(share => share.kind === kind && (kind === 'watchlist' ? share.watchlistId : share.portfolioId) === targetId) ?? null

  // 持股的 displayName 每次 PUT 整個換掉、沒送就變 null——只改欄位時也要帶著目前的名稱
  async function saveShare(kind: ShareKind, targetId: string | null, columns: ShareColumn[], displayName: string | null, expiresInDays: ShareExpiryDays): Promise<Share | null> {
    try {
      const body = kind === 'watchlist' ? { kind, watchlistId: targetId, columns, expiresInDays } : { kind, portfolioId: targetId, columns, displayName, expiresInDays }
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
