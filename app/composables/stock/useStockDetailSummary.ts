import type { Stock } from '~/composables/stock/useStocks'

// Extracted 2026-09-17 out of stock/[code].vue's own top-of-file logic (unchanged, just moved),
// per direct request ("整頁滑動的概念完全捨棄...只有Header部分會長相一樣") — 股利怎麼來/財務報表
// moved out to their own real routes (dividend-source.vue/financial-statements.vue), each needing
// the exact same StockSummaryCard header stock/[code].vue itself renders, so this is the shared
// slice both the main page and those new pages call instead of stock/[code].vue duplicating its
// own fetch/computed logic twice more. See stock/[code].vue's own git history for this logic's
// original comments (real bugs fixed: dividendYield mismatch 2026-09-14, /api/stocks 404 2026-09-14,
// change/volume 404 2026-09-14) — none of that reasoning changed, only its location.
export function useStockDetailSummary(code: Ref<string>) {
  const { data: summary } = useStockSummary(code)
  const { data: profile, pending: profilePending } = useCompanyProfile(code)
  const { data: priceHistory } = useDailyPriceHistory(code, ref(2))

  const priceChange = computed<{ amount: number; percent: number } | null>(() => {
    const entries = priceHistory.value
    if (!entries || entries.length < 2) return null
    const latest = entries[entries.length - 1]!
    const previous = entries[entries.length - 2]!
    if (previous.close === 0) return null
    const amount = latest.close - previous.close
    return { amount, percent: (amount / previous.close) * 100 }
  })

  // 「這家公司存不存在」= profile 查得到，**不是**「有沒有股價」（2026-10-01）。
  //
  // 原本的判斷是 `if (!price) return undefined`，而 13 個個股子頁面用 `!stock` 當作「找不到這檔股票」
  // 的條件，所以**一家沒有行情的真實公司整頁都看不到**。實測：興櫃 1293 利統、1343 旭東環保 失敗，
  // 而它們的基本面其實齊全（1293 的 roe 有 13 期、溯源表也有）。興櫃共 363 家、全部四碼、全部中。
  //
  // tpex-ts 2026-10-01 指出這個耦合在興櫃之外也會壞，而他們是對的：新上市第一天、長期停止買賣、
  // 以及任何一天行情 ingest 失敗，都會讓真實存在的公司看起來不存在。興櫃只是讓它變明顯。
  // 他們同時建議不要等興櫃行情才修——因為就算行情供了，實測當天 361 檔裡有 20 檔零成交，
  // 那些公司在舊判斷下仍然可能出不來。
  //
  // profile 是正確的判準，而且是實測的：9999／0000 的 profile 回 404，上市（2330）、上櫃（8050）、
  // 興櫃（1293／1343）都回 200 帶名稱。那也正是 bff-ts 自己的狀態碼契約——只有 /stocks/{symbol}
  // 與 /profile 的 404 代表代號不存在。
  const stock = computed<Stock | undefined>(() => {
    if (!profile.value) return undefined
    const price = summary.value?.price ?? null
    return {
      code: code.value,
      name: profile.value?.name ?? code.value,
      price: price?.close ?? null,
      change: priceChange.value?.amount ?? null,
      changePercent: priceChange.value?.percent ?? null
    }
  })

  const stockShortName = computed(() => profile.value?.shortName ?? stock.value?.name ?? code.value)
  // 只看 profile：`stock` 現在只取決於它。再等 summary 會讓沒有行情的公司永遠卡在載入中。
  const stockPending = computed(() => !stock.value && profilePending.value)

  const { watchlistCodes, addStock, removeStock } = useStocks()
  const isFavorite = computed(() => !!stock.value && watchlistCodes.value.includes(stock.value.code))

  function toggleFavorite() {
    if (!stock.value) return
    if (isFavorite.value) {
      removeStock(stock.value.code)
    } else {
      addStock(stock.value.code)
    }
  }

  return { summary, profile, stock, stockShortName, stockPending, isFavorite, toggleFavorite }
}
