import type { UserWatchlistItem, Watchlist } from '~/composables/watchlist/useUserWatchlist'
import type { TradingHalt } from '~/utils/trading-halt'

// 摘要卡用的最小股票物件。數值可以是 null：業務中台 的 GET /stocks/{symbol} 只有收盤價與估值比率，漲跌由
// useDailyPriceHistory 的兩天資料算，資料不足就是 null，畫面顯示「－」而不是假的 0。
export interface Stock {
  code: string
  name: string
  // 可以是 null（2026-10-01）。原本是必填的 number，而個股頁用「有沒有股價」當「這家公司存不存在」
  // 的判斷，於是**沒有行情的真實公司整頁顯示「找不到這檔股票」**——興櫃 363 家全中（實測 1293、1343），
  // 而 tpex-ts 指出同一個耦合在興櫃之外也會壞：新上市第一天、長期停止買賣、以及任何一天 ingest 失敗。
  //
  // 存不存在改用 profile 判斷（實測 9999／0000 的 profile 回 404，而上市櫃／上櫃／興櫃都回 200 帶名稱），
  // 那本來就是 業務中台 對 404 的定義：只有 /stocks/{symbol} 與 /profile 的 404 代表代號不存在。
  price: number | null
  change: number | null
  changePercent: number | null
  // 停止買賣（摘要卡寫一句話，見 app/utils/trading-halt.ts）；只有個股頁從 GET /stocks/{symbol} 帶得到
  tradingHalt?: TradingHalt | null
}

export type StockColumnKey = Exclude<keyof Stock, 'code' | 'name' | 'tradingHalt'>

// '－' 是全站缺值的寫法（同特別股表格的 __placeholder），不渲染假的 0.00
export function formatStockValue(stock: Stock, key: StockColumnKey) {
  const value = stock[key]
  if (value === null) return '－'
  if (key === 'change' || key === 'changePercent') {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}`
  }
  return value.toFixed(2)
}


// `watchlist` 只存代號（2026-09-14）：以前存整個 Stock 物件，每一筆都來自假資料或退回假資料，數字永遠不更新。真正的每檔數字由
// useWatchlistStocks 在下游 reactive 地解析（watchlist.vue），不是加入當下抓一次就放到過期。addStock／removeStock 只動代號。

export function useStocks() {
  // 只讀、不抓（useNuxtData）：這裡要目錄只是為了提示訊息裡的公司名稱，而 app.vue 的 useWatchlistSync 每一頁都會呼叫
  // useStocks——用 useCompanyIndex() 等於每頁、每個訪客都下載整份股票目錄（2026-10-16 DEV 的 Lighthouse 追到）。
  // 呼叫端知道名稱就自己傳（摘要卡的星號選單傳簡稱）；別處已經抓好目錄時照樣查得到；都沒有就顯示代號
  const { data: companies } = useNuxtData<CompanyIndexEntry[]>('company-index')
  const nameOf = (code: string, name?: string | null) => name || companies.value?.find(company => company.code === code)?.name || code
  const currentUser = useCurrentUser()
  const authResolved = useAuthResolved()
  const { open: openLogin } = useLoginDialog()
  const { quotaOf } = useEntitlement()
  const { fetchWatchlist, addToWatchlist, removeFromWatchlist, updateNote, fetchWatchlists, saveWatchlistName, createWatchlistWithItems, deleteWatchlist, reorderWatchlists } = useUserWatchlist()

  // currentUser 在 Firebase 的 onAuthStateChanged 首次觸發前是 null，而「確定沒登入」也是 null——
  // 只看它的話，已登入的人在頁面剛可互動的那幾百毫秒內按☆會被要求登入。所以先等解析完再判斷。
  // once: true 讓這個 watcher 自己收掉；它建在事件處理裡、不在 setup 的同步區間內，不會被自動回收。
  function whenAuthResolved(): Promise<void> {
    if (authResolved.value) return Promise.resolve()
    return new Promise(resolve => {
      watch(authResolved, resolved => { if (resolved) resolve() }, { once: true })
    })
  }

  // 多組觀察清單（2026-10-19，使用者：「可以有多組 watchlist」；業務中台 e987bb2）。狀態是「清單」與「全部清單的項目」兩份，
  // 同一檔可以在不同清單（各自一筆、各自的 id 與備註），所以不能再用 symbol 當 key。
  // 項目的 id 是後端那一筆的 UUID（刪除與備註都靠它）；樂觀加入、還沒拿到回應的那一筆 id 是空字串。
  const watchlists = useState<Watchlist[]>('stock-watchlists', () => [])
  const watchlistItems = useState<UserWatchlistItem[]>('stock-watchlist-items', () => [])
  // /watchlist 頁正在看的那一組（網址 ?list= 由那一頁同步）；找不到就用第一組
  const activeWatchlistId = useState<string | null>('stock-watchlist-active', () => null)
  const activeWatchlist = computed(() => watchlists.value.find(list => list.id === activeWatchlistId.value) ?? watchlists.value[0] ?? null)

  const itemsOf = (listId: string | null | undefined) => watchlistItems.value.filter(item => item.watchlistId === listId)
  const itemIn = (listId: string | null | undefined, code: string) => watchlistItems.value.find(item => item.watchlistId === listId && item.symbol === code)
  // /watchlist 頁看的那一組：代號、id、備註（頁面原本就是用這三份）
  const watchlistCodes = computed(() => itemsOf(activeWatchlist.value?.id).map(item => item.symbol))
  const watchlistIds = computed<Record<string, string>>(() => Object.fromEntries(itemsOf(activeWatchlist.value?.id).filter(item => item.id).map(item => [item.symbol, item.id])))
  const watchlistNotes = computed<Record<string, string>>(() => Object.fromEntries(itemsOf(activeWatchlist.value?.id).flatMap(item => (item.note ? [[item.symbol, item.note]] : []))))
  // 星號：在任何一組裡就是實心
  const listsContaining = (code: string) => watchlistItems.value.filter(item => item.symbol === code).map(item => item.watchlistId)

  // 把帳號裡那一份直接套用成本地狀態。useWatchlistSync 的登入載入與下面幾條錯誤路徑共用這一支。
  // undefined ＝ 這次沒問到（網路或驗證失敗），保留本地不動；[] ＝ 帳號裡真的是空的，要套用。
  async function applyServerWatchlist(): Promise<boolean> {
    const [lists, items] = await Promise.all([fetchWatchlists(), fetchWatchlist()])
    if (lists === undefined || items === undefined) return false
    watchlists.value = lists
    watchlistItems.value = items
    return true
  }

  function clearWatchlists() {
    watchlists.value = []
    watchlistItems.value = []
    activeWatchlistId.value = null
  }

  // 沒有任何一組時（新使用者；業務中台不自動建）先建「我的觀察清單」。回傳要加進去的那一組 id，失敗回 null
  const DEFAULT_LIST_NAME = '我的觀察清單'
  async function ensureWatchlist(): Promise<string | null> {
    if (activeWatchlist.value) return activeWatchlist.value.id
    const result = await saveWatchlistName(DEFAULT_LIST_NAME)
    if (result.ok) {
      watchlists.value = [...watchlists.value, result.watchlist]
      return result.watchlist.id
    }
    // 同名：另一台裝置剛建好，重抓一次就有了
    if (result.reason === 'duplicate' && (await applyServerWatchlist())) return watchlists.value[0]?.id ?? null
    showErrorMessage('觀察清單暫時無法建立，請稍後再試')
    return null
  }

  // 未登入就引導註冊，不加入（2026-09-29「未登入時不可加入最愛，按下加入最愛時應該彈窗引導註冊」）。守衛放在共同的根上：
  // 呼叫端有兩個（摘要卡的星號選單、觀察清單頁的加入框）。listId 沒給＝目前那一組（沒有任何一組就先建一組）。
  async function addStock(code: string, knownName?: string | null, listId?: string) {
    if (listId && itemIn(listId, code)) return
    await whenAuthResolved()
    if (!currentUser.value) {
      openLogin()
      return
    }
    const targetId = listId ?? (await ensureWatchlist())
    if (!targetId) return
    // await 之後再檢查一次：連點兩下時兩次都會通過開頭的檢查（業務中台提醒這支端點不是冪等的）
    if (itemIn(targetId, code)) {
      if (!listId) ElMessage.warning('已在這個觀察清單中')
      return
    }
    // 額度已知而且滿了：先說，不做樂觀加入。檔數算所有清單的總列數（同一檔在兩組算 2）
    const limit = quotaOf('watchlistItems')
    if (typeof limit === 'number' && watchlistItems.value.length >= limit) {
      showQuotaReached('觀察清單')
      return
    }
    const name = nameOf(code, knownName)
    const listName = watchlists.value.find(list => list.id === targetId)?.name ?? DEFAULT_LIST_NAME
    watchlistItems.value = [...watchlistItems.value, { id: '', watchlistId: targetId, symbol: code, note: null }]
    ElMessage.success(`已把 ${name} 加入「${listName}」`)
    const result = await addToWatchlist(targetId, code)
    if (result.ok) {
      watchlistItems.value = watchlistItems.value.map(item => (item.watchlistId === targetId && item.symbol === code ? result.item : item))
      return
    }
    // unknown：代號不存在（POST 會先查報價），伺服器確定沒有這一筆，收回樂觀加上的那一筆
    if (result.reason === 'unknown') {
      watchlistItems.value = watchlistItems.value.filter(item => !(item.watchlistId === targetId && item.symbol === code))
      showErrorMessage(`找不到代號 ${code}，已取消加入`)
      return
    }
    // duplicate（409：另一台裝置加過，這台沒有 id）與 quota（403：額度 middleware 在 handler 之前，滿額時連重複的請求也回 403）
    // 都不能靠猜，重抓一次帳號裡的清單：伺服器有就留著（順便補上 id），沒有才算真的被額度擋下
    if (result.reason === 'duplicate' || result.reason === 'quota') {
      if ((await applyServerWatchlist()) && result.reason === 'quota' && !itemIn(targetId, code)) showQuotaReached('觀察清單')
    }
    // offline：本地留著，帳號沒存到。不打擾使用者——下一次成功的同步會蓋回去。
  }

  // 移除可以復原（2026-10-06）：先從畫面拿掉，提示關閉後才送 DELETE。listId 沒給＝目前那一組
  function removeStock(code: string, knownName?: string | null, listId?: string) {
    const targetId = listId ?? activeWatchlist.value?.id
    const item = itemIn(targetId, code)
    if (!item) return
    const index = watchlistItems.value.indexOf(item)
    watchlistItems.value = watchlistItems.value.filter(existing => existing !== item)
    const listName = watchlists.value.find(list => list.id === targetId)?.name ?? '觀察清單'
    let undone = false
    undoToast(`已從「${listName}」移除 ${nameOf(code, knownName)}`, () => {
      undone = true
      const next = [...watchlistItems.value]
      next.splice(Math.min(index, next.length), 0, item)
      watchlistItems.value = next
    }, () => {
      if (undone || !currentUser.value || !item.id) return
      void removeFromWatchlist(item.id)
    })
  }

  // 回傳 false ＝ 沒存到（呼叫端要把對話框留著，使用者打的字不能丟）。改的是目前那一組裡的那一筆
  async function saveNote(code: string, note: string): Promise<boolean> {
    const item = itemIn(activeWatchlist.value?.id, code)
    if (!item?.id) return false
    const trimmed = note.trim()
    if (!(await updateNote(item.id, trimmed || null))) return false
    watchlistItems.value = watchlistItems.value.map(existing => (existing === item ? { ...existing, note: trimmed || null } : existing))
    return true
  }

  // ---- 清單本身 ----
  // 新增一組：成功回傳那一組（呼叫端決定要不要切過去）；同名、額度、名稱不合規各自提示
  async function createWatchlist(name: string): Promise<Watchlist | null> {
    const result = await saveWatchlistName(name)
    if (result.ok) {
      watchlists.value = [...watchlists.value, result.watchlist]
      return result.watchlist
    }
    if (result.reason === 'quota') showQuotaReached('觀察清單組數')
    else showErrorMessage(result.reason === 'duplicate' ? `已經有一組叫「${name}」` : result.reason === 'invalid' ? '名稱要 1 到 20 個字' : '清單沒有建立，請稍後再試')
    return null
  }

  // 把一份分享整份存成一組新的觀察清單（2026-10-20，使用者：「分享的持股開放一個誘導註冊的按鈕，這個按鈕功能是把這個分享加到觀察清單」）。
  // 一次複製、之後不跟著分享變（使用者選的；跟著變就接近跟單）。清單名稱跟現有的撞了就加編號（名稱上限 20 字）。整批一次 POST
  // （業務中台 670db40，使用者：「加入觀察清單的 API 不對吧，沒有一次送整批的機制嗎」）：同一個交易、照分享的順序，不會留下半份；
  // 同一條分享存過而且那組還在，回那一組（created false），不會存兩份。額度整批算，放不下就什麼都不建。沒登入回 'signed-out'
  // （等登入狀態確定才判斷，呼叫端去開登入）；其他失敗已經提示過，回 null。
  // ponytail: 超過 200 檔的分享會被 業務中台 擋下（400，提示「清單沒有建立」）；真的有人分享那麼多再分批送
  async function importToWatchlist(name: string, symbols: string[], sourceShareToken: string): Promise<{ list: Watchlist; added: number; skipped: string[]; created: boolean } | 'signed-out' | null> {
    await whenAuthResolved()
    if (!currentUser.value) return 'signed-out'
    if (!(await applyServerWatchlist())) {
      showErrorMessage('觀察清單暫時讀不到，請稍後再試')
      return null
    }
    const taken = new Set(watchlists.value.map(list => list.name))
    let listName = name.slice(0, 20)
    for (let n = 2; taken.has(listName); n++) listName = `${name.slice(0, 19 - String(n).length)} ${n}`
    const result = await createWatchlistWithItems(listName, symbols, sourceShareToken)
    if (!result.ok) {
      if (result.reason === 'items') showQuotaReached('觀察清單', `觀察清單還能再加 ${result.room} 檔，放不下這一份。可以刪掉不需要的，或之後升級專業版。`)
      else if (result.reason === 'lists') showQuotaReached('觀察清單組數')
      else showErrorMessage(result.reason === 'duplicate' ? `已經有一組叫「${listName}」` : '清單沒有建立，請稍後再試')
      return null
    }
    // 已經存過的那一組剛剛已經隨 applyServerWatchlist 讀進來了
    if (result.created) {
      watchlists.value = [...watchlists.value, result.watchlist]
      watchlistItems.value = [...watchlistItems.value, ...result.items]
    }
    return { list: result.watchlist, added: result.items.length, skipped: result.skipped, created: result.created }
  }

  async function renameWatchlist(id: string, name: string) {
    const previous = watchlists.value
    watchlists.value = watchlists.value.map(list => (list.id === id ? { ...list, name } : list))
    const result = await saveWatchlistName(name, id)
    if (result.ok) return
    watchlists.value = previous
    showErrorMessage(result.reason === 'duplicate' ? `已經有一組叫「${name}」` : '改名沒有存到，請稍後再試')
  }

  // ScreenerPresetSelect 的刪除已經等過 10 秒的復原，這裡直接刪（裡面的項目業務中台一起刪）
  // 刪除的 10 秒復原期間先從清單拿掉（2026-10-22，同持股帳戶：側欄讀的就是 watchlists），回傳還原的函式
  function hideWatchlist(id: string): () => void {
    const index = watchlists.value.findIndex(list => list.id === id)
    if (index < 0) return () => {}
    const list = watchlists.value[index]!
    const items = watchlistItems.value.filter(item => item.watchlistId === id)
    watchlists.value = watchlists.value.filter(each => each.id !== id)
    watchlistItems.value = watchlistItems.value.filter(item => item.watchlistId !== id)
    return () => {
      if (watchlists.value.some(each => each.id === id)) return
      watchlists.value = [...watchlists.value.slice(0, index), list, ...watchlists.value.slice(index)]
      watchlistItems.value = [...watchlistItems.value, ...items]
    }
  }

  // 沒刪成回 false（管理頁會把先藏起來的放回去）
  async function deleteWatchlistById(id: string): Promise<boolean> {
    const previous = { lists: watchlists.value, items: watchlistItems.value }
    watchlists.value = watchlists.value.filter(list => list.id !== id)
    watchlistItems.value = watchlistItems.value.filter(item => item.watchlistId !== id)
    if (await deleteWatchlist(id)) return true
    watchlists.value = previous.lists
    watchlistItems.value = previous.items
    showErrorMessage('清單沒有刪除，請稍後再試')
    return false
  }

  async function reorderWatchlistIds(ids: string[]) {
    const previous = watchlists.value
    watchlists.value = ids.map(id => previous.find(list => list.id === id)).filter((list): list is Watchlist => !!list)
    if (await reorderWatchlists(ids)) return
    watchlists.value = previous
    showErrorMessage('順序沒有存到，請稍後再試')
  }

  return {
    watchlists,
    watchlistItems,
    activeWatchlistId,
    activeWatchlist,
    watchlistCodes,
    watchlistIds,
    watchlistNotes,
    listsContaining,
    applyServerWatchlist,
    clearWatchlists,
    addStock,
    removeStock,
    saveNote,
    createWatchlist,
    importToWatchlist,
    renameWatchlist,
    hideWatchlist,
    deleteWatchlist: deleteWatchlistById,
    reorderWatchlists: reorderWatchlistIds
  }
}
