// 摘要卡用的最小股票物件。數值可以是 null：bff 的 GET /stocks/{symbol} 只有收盤價與估值比率，漲跌由
// useDailyPriceHistory 的兩天資料算，資料不足就是 null，畫面顯示「－」而不是假的 0。
export interface Stock {
  code: string
  name: string
  // 可以是 null（2026-10-01）。原本是必填的 number，而個股頁用「有沒有股價」當「這家公司存不存在」
  // 的判斷，於是**沒有行情的真實公司整頁顯示「找不到這檔股票」**——興櫃 363 家全中（實測 1293、1343），
  // 而 tpex-ts 指出同一個耦合在興櫃之外也會壞：新上市第一天、長期停止買賣、以及任何一天 ingest 失敗。
  //
  // 存不存在改用 profile 判斷（實測 9999／0000 的 profile 回 404，而上市櫃／上櫃／興櫃都回 200 帶名稱），
  // 那本來就是 bff-ts 對 404 的定義：只有 /stocks/{symbol} 與 /profile 的 404 代表代號不存在。
  price: number | null
  change: number | null
  changePercent: number | null
}

export type StockColumnKey = Exclude<keyof Stock, 'code' | 'name'>

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

// MOCK_STOCK_UNIVERSE itself is GONE as of 2026-09-22, with useStockUniverse() and
// searchUniverse() — the last of the 2026-09-14 mock-data survey's findings to be cleared. It was
// a ~20-company hardcoded list behind a fetch of `GET /api/stocks`, an endpoint that never existed
//（the real collection is `/stocks`）, so that call 404'd on every render and fell back to the
// fabrication. Both consumers had already moved off it — StockHealthCheckCard to useStockSearch on
// 2026-09-14, the watchlist to codes-only — leaving code a reader could still mistake for a live
// fallback. Zero readers confirmed before deleting: every remaining `searchUniverse` in the app is
// useStockSearch's own, which runs against the real market-wide company index.
//
// Default seed is just 8 real, valid stock codes (the same 8 that used to lead
// MOCK_STOCK_UNIVERSE) — not the fabricated numbers that used to come attached to them. A brand
// new watchlist still starts with a few recognizable large-cap names instead of a blank table,
// but every number shown for them now comes from useWatchlistStocks' own real per-symbol fetch.
// 2026-09-26：預設清單清空（「用戶現在都沒有登入 所以 summary 右上角不可能是 已加最愛 這是個 BUG」）。
// 原本這裡寫死八檔（2330 2317 2454 2412 2882 2881 2308 1301），不管有沒有登入都先塞進狀態，於是任何人
// 第一次逛 /stock/2330 就看到「已加最愛」——那是這個 state 在替使用者宣稱一件他沒做過的事。
//
// 修在這裡而不是修那張卡片：isFavorite 只是讀這個陣列，/watchlist 整頁和儀表板的自選除息卡也讀它，
// 三個地方看到的是同一個謊。/watchlist 本來就有「尚未加入任何股票」的空狀態，清空之後那一頁讀起來是
// 對的。
//
// 更大的問題在這一行之外，修不掉：**這份自選股完全沒有持久化**——沒有 localStorage、沒有 cookie、沒有
// 後端同步、也沒有任何 watcher（全 repo grep 過）。加進去的股票重新整理就消失，登入與否都一樣。要真的
// 能用，需要一支像 pinnedMetricSlugs 那樣的使用者設定端點。清空預設值讓畫面不再說謊，但沒有讓這個功能
// 變得能用。
const DEFAULT_WATCHLIST_CODES: string[] = []

// Real bug fixed 2026-09-14 (mock-data survey) — `watchlist` used to store full Stock OBJECTS,
// every one of them either sourced from or falling back to MOCK_STOCK_UNIVERSE, so the whole
// table (including the default 8) showed fabricated price/PER/PBR/殖利率 forever, never updating.
// Now stores just CODES — the real per-symbol numbers are resolved reactively downstream by
// useWatchlistStocks.ts (watchlist.vue/DashboardWatchlistExDividendCard.vue's own concern), not
// captured once at add-time and left stale. addStock/removeStock operate on codes only now; a
// caller wanting the real Stock objects should call useWatchlistStocks(watchlistCodes) itself.
// 模組層級：useStocks() 每個呼叫端各建一份閉包，計時器要跨呼叫端共用才擋得住連按
let reorderTimer: ReturnType<typeof setTimeout> | undefined

export function useStocks() {
  const { data: companies } = useCompanyIndex()
  const currentUser = useCurrentUser()
  const authResolved = useAuthResolved()
  const { open: openLogin } = useLoginDialog()
  const { quotaOf } = useEntitlement()
  const { fetchWatchlist, addToWatchlist, removeFromWatchlist, updateNote, reorderWatchlist } = useUserWatchlist()

  // currentUser 在 Firebase 的 onAuthStateChanged 首次觸發前是 null，而「確定沒登入」也是 null——
  // 只看它的話，已登入的人在頁面剛可互動的那幾百毫秒內按☆會被要求登入。所以先等解析完再判斷。
  // once: true 讓這個 watcher 自己收掉；它建在事件處理裡、不在 setup 的同步區間內，不會被自動回收。
  function whenAuthResolved(): Promise<void> {
    if (authResolved.value) return Promise.resolve()
    return new Promise(resolve => {
      watch(authResolved, resolved => { if (resolved) resolve() }, { once: true })
    })
  }

  const watchlistCodes = useState<string[]>('stock-watchlist-codes', () => [...DEFAULT_WATCHLIST_CODES])
  // symbol → 後端那一筆的 UUID。刪除端點吃的是 id 不是 symbol，所以少了這張表就刪不掉東西
  // （契約見 useUserWatchlist.ts）。未登入時它一直是空的，清單也就只活在這個分頁裡，跟以前一樣。
  const watchlistIds = useState<Record<string, string>>('stock-watchlist-ids', () => ({}))
  // symbol → 使用者自己的備註（2026-10-06）。後端每一筆本來就有 note 欄位，只是之前沒有人讀。
  const watchlistNotes = useState<Record<string, string>>('stock-watchlist-notes', () => ({}))

  // 把帳號裡那一份直接套用成本地狀態。useWatchlistSync 的登入載入與下面幾條錯誤路徑共用這一支，
  // 免得「怎麼把伺服器清單變成本地狀態」有兩份寫法。undefined ＝ 這次沒問到（網路或驗證失敗），
  // 保留本地不動；[] ＝ 帳號裡真的是空的，要套用。
  async function applyServerWatchlist(): Promise<boolean> {
    const items = await fetchWatchlist()
    if (items === undefined) return false
    watchlistCodes.value = items.map(item => item.symbol)
    watchlistIds.value = Object.fromEntries(items.map(item => [item.symbol, item.id]))
    watchlistNotes.value = Object.fromEntries(items.flatMap(item => (item.note ? [[item.symbol, item.note]] : [])))
    return true
  }

  // 未登入就引導註冊，不加入（2026-09-29「未登入時不可加入最愛，按下加入最愛時應該彈窗引導註冊」）。
  // 守衛放在這裡而不是☆的處理函式：呼叫端有兩個（個股頁的☆、觀察清單頁的加入框），而它們做的是
  // 同一件事，理由也同一個——未登入時清單不會存到任何地方，加了只是騙人。放在共同的根上，之後多一個
  // 呼叫端也不會漏掉。
  //
  // 只擋加入不擋移除：未登入的人本來就沒有東西可以移除（清單只可能是空的）。
  //
  // 沿用既有的 useLoginDialog——screener 的「＋」新分頁與新欄位預設早就是同一個形狀（見
  // useScreenerTabs 的 addTab／addColumnPresetOption）：可以按得到，按下去就是註冊的時機。
  async function addStock(code: string) {
    if (watchlistCodes.value.includes(code)) {
      ElMessage.warning('已在觀察清單中')
      return
    }
    await whenAuthResolved()
    if (!currentUser.value) {
      openLogin()
      return
    }
    // 上面那個 await 之後要再檢查一次。addStock 2026-09-29 從同步改成非同步（要等登入狀態解析），
    // 而樂觀加入發生在 await 之後——連點兩下的話兩次都會通過函式開頭的重複檢查，然後各自把同一個
    // 代號推進陣列，畫面上那檔股票會出現兩次，後端也會收到兩次 POST（第二次回 409）。
    // 這不是理論上的競態：bff-ts 2026-09-29 特別提醒那支端點不是冪等的。
    if (watchlistCodes.value.includes(code)) return
    // 額度已知而且滿了：先說，不做樂觀加入（2026-10-06）。不然畫面會先跳「已加入」、再被 403 收回去。
    // 不知道額度（entitlement 沒問到）就照舊交給伺服器的 403。
    const limit = quotaOf('watchlistItems')
    if (typeof limit === 'number' && watchlistCodes.value.length >= limit) {
      showQuotaReached('觀察清單')
      return
    }
    const name = companies.value.find(company => company.code === code)?.name ?? code
    watchlistCodes.value = [...watchlistCodes.value, code]
    ElMessage.success(`已加入 ${name}`)
    void addToWatchlist(code).then(result => {
      if (result.ok) {
        watchlistIds.value = { ...watchlistIds.value, [code]: result.item.id }
        return
      }
      // unknown：代號不存在（POST 會先查報價）。伺服器確定沒有這一筆，所以直接把樂觀加上去的那一筆
      // 收回來——留著的話畫面上會有一檔永遠抓不到報價的股票，而且它在 useWatchlistStocks 那邊只會被
      // 靜默丟進 droppedCount，看起來像暫時的載入問題。
      if (result.reason === 'unknown') {
        watchlistCodes.value = watchlistCodes.value.filter(existing => existing !== code)
        ElMessage.error(`找不到代號 ${code}，已取消加入`)
        return
      }
      // duplicate（409）與 quota（403）都不能靠猜，要重新抓一次帳號裡的清單。
      //
      // 409：後端本來就有這一筆，但我們沒有它的 id（在另一台裝置加的、這台還沒同步）。沒有 id 就刪不掉，
      // 所以重抓順便把 id 補上，而不是等下一次登入。
      //
      // 403：**不一定代表額度滿**。bff-ts 2026-09-29 實測，`enforceQuota` 是跑在 handler 之前的
      // middleware，所以在 10/10 的狀態下它會拒絕**所有** POST——包括一筆根本不會新增任何列的重複請求。
      // 也就是說「滿額時對已在清單裡的股票再按一次」會拿到 403 而不是 409。無條件回滾的話，會從畫面上
      // 移掉一個實際存在於帳號裡的項目。
      //
      // 他們建議的防護是「403 時若 symbol 已在本地清單就當成 409」，但那個判斷在這裡恆為真——樂觀加入
      // 已經把它放進去了。所以改成重抓：伺服器有就留著、沒有才算真的被拒。
      if (result.reason === 'duplicate' || result.reason === 'quota') {
        void applyServerWatchlist().then(applied => {
          if (!applied) return
          // 重抓之後還是不在，才是真的被額度擋下來。
          if (result.reason === 'quota' && !watchlistCodes.value.includes(code)) {
            showQuotaReached('觀察清單')
          }
        })
        return
      }
      // offline：本地留著，帳號沒存到。不打擾使用者——下一次成功的同步會蓋回去。
    })
  }

  // 移除可以復原（2026-10-06）：先從畫面拿掉，提示關閉後才送 DELETE。跟持股頁同一個安全方向——按了
  // 復原就什麼都沒送，最壞的情況（關掉分頁）是那一檔還在，不會是誤刪。不跳確認對話框：可以復原的動作
  // 不需要事先確認（conductor 知識庫「犯錯恐懼與容錯架構」）。
  // ☆（個股頁）取消最愛也走這裡：同一件事，同一個復原機會。
  function removeStock(code: string) {
    const index = watchlistCodes.value.indexOf(code)
    if (index < 0) return
    watchlistCodes.value = watchlistCodes.value.filter(existing => existing !== code)
    const name = companies.value.find(company => company.code === code)?.name ?? code
    let undone = false
    undoToast(`已從觀察清單移除 ${name}`, () => {
      undone = true
      const next = [...watchlistCodes.value]
      next.splice(Math.min(index, next.length), 0, code)
      watchlistCodes.value = next
    }, () => {
      if (undone) return
      const id = watchlistIds.value[code]
      if (!currentUser.value || !id) return
      const { [code]: _removed, ...rest } = watchlistIds.value
      watchlistIds.value = rest
      void removeFromWatchlist(id)
    })
  }

  // 排序（2026-10-06「自訂排序」）。畫面立刻換，後端等最後一次按完 800ms 才送整份順序：連按好幾下上移
  // 只送一次，也就不會有幾個請求亂序抵達、最後存成中間某一步的問題。
  // 還有沒拿到 id 的那一檔（剛加入、POST 還沒回來）就先不送：缺一筆一定是 400。下一次移動會補上。
  function moveStock(code: string, offset: -1 | 1) {
    const from = watchlistCodes.value.indexOf(code)
    const to = from + offset
    if (from < 0 || to < 0 || to >= watchlistCodes.value.length) return
    const next = [...watchlistCodes.value]
    ;[next[from], next[to]] = [next[to]!, next[from]!]
    watchlistCodes.value = next
    if (!currentUser.value) return
    clearTimeout(reorderTimer)
    reorderTimer = setTimeout(async () => {
      const ids = watchlistCodes.value.map(symbol => watchlistIds.value[symbol])
      if (ids.some(id => !id)) return
      const result = await reorderWatchlist(ids as string[])
      // 400：帳號裡的清單跟這裡不一樣（另一台裝置改過）。以帳號為準重抓，不猜。
      if (result === 'mismatch') void applyServerWatchlist()
      if (result === 'failed') ElMessage.error('順序沒有存到，重新整理後會回到原本的順序')
    }, 800)
  }

  // 回傳 false ＝ 沒存到（呼叫端要把對話框留著，使用者打的字不能丟）
  async function saveNote(code: string, note: string): Promise<boolean> {
    const id = watchlistIds.value[code]
    if (!id) return false
    const trimmed = note.trim()
    if (!(await updateNote(id, trimmed || null))) return false
    const { [code]: _old, ...rest } = watchlistNotes.value
    watchlistNotes.value = trimmed ? { ...rest, [code]: trimmed } : rest
    return true
  }

  return {
    watchlistCodes,
    watchlistIds,
    watchlistNotes,
    applyServerWatchlist,
    addStock,
    removeStock,
    moveStock,
    saveNote
  }
}
