// 持股帳戶（2026-10-19，使用者：「可以有多組 watchlist 還有持股（比如不同券商）」；業務中台 c7d949a）。使用者選了「全部帳戶合併＋單一帳戶切換」：
//   - 讀取（/holdings、/holdings/*、GET /transactions）帶選填的 ?portfolioId=；不帶＝全部帳戶合併（業務中台在每個帳戶內各自先進先出，再加總）
//   - 寫入（記一筆、匯入、刪一檔、清除全部）一定要帶 portfolioId
// 選的帳戶記在 useState（持股各頁共用，切頁不掉）並同步到網址 ?account=（HoldingsPageShell 負責）。null＝全部帳戶。
// 業務中台不自動建帳戶：沒有任何帳戶時，第一次寫入前先建「我的帳戶」。

export interface Portfolio {
  id: string
  name: string
  brokerCode: string | null
}

// 建立、改名的結果：duplicate＝同名（409，在額度之前）；invalid＝名稱 1～20 字以外（400）；quota＝FREE 3 個（403 quota_exceeded）
type NameResult = { ok: true; portfolio: Portfolio } | { ok: false; reason: 'duplicate' | 'invalid' | 'quota' | 'failed' }

const DEFAULT_NAME = '我的帳戶'

export function useHoldingsPortfolios() {
  const request = useAuthedFetch()
  const currentUser = useCurrentUser()
  const portfolios = useState<Portfolio[]>('holdings-portfolios', () => [])
  // 帳戶清單是誰的、讀過沒：讀到之前不知道 ?account= 指的帳戶在不在，持股各頁先不抓（holdingsScope 是 undefined），免得先抓一次合併的再抓一次單一帳戶
  const loadedFor = useState<string | null>('holdings-portfolios-loaded-for', () => null)
  const loadFailed = useState('holdings-portfolios-failed', () => false)
  const selectedPortfolioId = useState<string | null>('holdings-portfolio', () => null)
  // 找不到（帳戶被刪了、網址打錯）就當全部帳戶
  const selected = computed(() => portfolios.value.find(portfolio => portfolio.id === selectedPortfolioId.value) ?? null)
  const ready = computed(() => !!currentUser.value && loadedFor.value === currentUser.value.uid)
  // 持股各頁的 watch 用這個取代 uid：換帳戶就跟換人一樣重新載入。undefined＝沒登入或帳戶清單還沒讀到
  const holdingsScope = computed(() => (ready.value ? `${currentUser.value!.uid}|${selected.value?.id ?? 'all'}` : undefined))
  // 讀取的 query：全部帳戶就不帶
  const scopeQuery = computed((): Record<string, string> => (selected.value ? { portfolioId: selected.value.id } : {}))
  // 寫入的對象：選了哪個就是哪個；只有一個帳戶時「全部」就是它。全部帳戶又不只一個時是 null（清除全部這種動作就不提供）
  const writeTarget = computed(() => selected.value ?? (portfolios.value.length === 1 ? portfolios.value[0]! : null))

  async function loadPortfolios(): Promise<void> {
    const uid = currentUser.value?.uid
    if (!uid) return
    try {
      const response = await request<{ portfolios: Portfolio[] }>('/portfolios')
      portfolios.value = (response.portfolios ?? []).map(({ id, name, brokerCode }) => ({ id, name, brokerCode: brokerCode ?? null }))
      loadFailed.value = false
    } catch (error) {
      // 讀不到也放行：當成沒有帳戶，持股照樣以「全部帳戶」讀（不帶 portfolioId 的讀取不受影響），寫入前 ensurePortfolio 會再試
      devWarn('holdings', 'GET /portfolios unavailable', error)
      loadFailed.value = true
    }
    loadedFor.value = uid
  }

  function clearPortfolios() {
    portfolios.value = []
    loadedFor.value = null
    selectedPortfolioId.value = null
  }

  // 寫入前要一個帳戶 id：指定的、選中的、唯一的那個；一個都沒有就先建「我的帳戶」。全部帳戶又不只一個時回 null（呼叫端要讓使用者選）
  async function ensurePortfolio(preferred?: string | null): Promise<string | null> {
    if (preferred && portfolios.value.some(portfolio => portfolio.id === preferred)) return preferred
    if (writeTarget.value) return writeTarget.value.id
    if (portfolios.value.length) return null
    const result = await savePortfolio(DEFAULT_NAME)
    if (result.ok) return result.portfolio.id
    // 同名：另一台裝置剛建好
    if (result.reason === 'duplicate') {
      await loadPortfolios()
      return portfolios.value[0]?.id ?? null
    }
    return null
  }

  async function savePortfolio(name: string, id?: string): Promise<NameResult> {
    try {
      const response = id
        ? await request<{ portfolio: Portfolio }>(`/portfolios/${id}`, { method: 'PATCH', body: { name } })
        : await request<{ portfolio: Portfolio }>('/portfolios', { method: 'POST', body: { name } })
      const portfolio = { id: response.portfolio.id, name: response.portfolio.name, brokerCode: response.portfolio.brokerCode ?? null }
      portfolios.value = id ? portfolios.value.map(item => (item.id === id ? portfolio : item)) : [...portfolios.value, portfolio]
      return { ok: true, portfolio }
    } catch (error) {
      const status = businessErrorStatus(error)
      if (status === 409) return { ok: false, reason: 'duplicate' }
      if (status === 400) return { ok: false, reason: 'invalid' }
      if (businessErrorCode(error) === 'quota_exceeded') return { ok: false, reason: 'quota' }
      devWarn('holdings', 'POST/PATCH /portfolios failed', error)
      return { ok: false, reason: 'failed' }
    }
  }

  function reportNameFailure(reason: Exclude<NameResult, { ok: true }>['reason'], name: string) {
    if (reason === 'quota') showQuotaReached('portfolios')
    else showErrorMessage(reason === 'duplicate' ? `已經有一個帳戶叫「${name}」` : reason === 'invalid' ? '名稱要 1 到 20 個字' : '帳戶沒有存到，請稍後再試')
  }

  async function createPortfolio(name: string): Promise<Portfolio | null> {
    const result = await savePortfolio(name)
    if (result.ok) return result.portfolio
    reportNameFailure(result.reason, name)
    return null
  }

  async function renamePortfolio(id: string, name: string) {
    const result = await savePortfolio(name, id)
    if (!result.ok) reportNameFailure(result.reason, name)
  }

  // 刪除帳戶＝連同底下的交易一起刪（業務中台）。ScreenerPresetSelect 已經等過 10 秒的復原才通知，這裡直接送
  // 刪除的 10 秒復原期間先從清單拿掉（2026-10-22，使用者：「已刪除「媽媽的帳戶」和它的所有交易 但是sidebar沒有馬上刪掉。我認為應馬上
  // 刪掉，用戶點選還原再還原」）：側欄的帳戶切換讀的就是這份清單。回傳還原的函式：放回原本的位置，原本選著它就再選回來
  function hidePortfolio(id: string): () => void {
    const index = portfolios.value.findIndex(portfolio => portfolio.id === id)
    if (index < 0) return () => {}
    const portfolio = portfolios.value[index]!
    const wasSelected = selectedPortfolioId.value === id
    portfolios.value = portfolios.value.filter(item => item.id !== id)
    if (wasSelected) selectedPortfolioId.value = null
    return () => {
      if (portfolios.value.some(item => item.id === id)) return
      portfolios.value = [...portfolios.value.slice(0, index), portfolio, ...portfolios.value.slice(index)]
      if (wasSelected) selectedPortfolioId.value = id
    }
  }

  async function deletePortfolio(id: string): Promise<boolean> {
    try {
      await request(`/portfolios/${id}`, { method: 'DELETE' })
    } catch (error) {
      if (businessErrorStatus(error) !== 404) {
        devWarn('holdings', 'DELETE /portfolios/{id} failed', error)
        showErrorMessage('帳戶沒有刪除，請稍後再試')
        return false
      }
    }
    portfolios.value = portfolios.value.filter(portfolio => portfolio.id !== id)
    if (selectedPortfolioId.value === id) selectedPortfolioId.value = null
    return true
  }

  async function reorderPortfolios(ids: string[]) {
    const previous = portfolios.value
    portfolios.value = ids.map(id => previous.find(portfolio => portfolio.id === id)).filter((portfolio): portfolio is Portfolio => !!portfolio)
    try {
      await request('/portfolios/reorder', { method: 'POST', body: { ids } })
    } catch (error) {
      devWarn('holdings', 'POST /portfolios/reorder failed', error)
      portfolios.value = previous
      showErrorMessage('順序沒有存到，請稍後再試')
    }
  }

  return {
    portfolios, selectedPortfolioId, selected, ready, holdingsScope, scopeQuery, writeTarget, loadFailed,
    loadPortfolios, clearPortfolios, ensurePortfolio, createPortfolio, renamePortfolio, hidePortfolio, deletePortfolio, reorderPortfolios
  }
}
