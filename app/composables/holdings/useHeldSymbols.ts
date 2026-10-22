// 篩選器「已經持有」要的帳戶與代號（2026-10-22，見 screener-tab-model.ts 的 HELD_FIELD_ID）：GET /holdings/symbols（業務中台 5034637，要登入）
// → 每個帳戶持有哪些代號，帳戶照使用者的排序、沒持股的也列。三組篩選的條件選項（帳戶）都讀這一份；特別股在瀏覽器裡篩，條件與欄位也用它算。
// portfolios 是 null：訪客，或還沒讀到。每次進篩選頁重讀一次（帳戶可能剛改名）
export interface HeldPortfolio {
  portfolioId: string
  name: string
  symbols: string[]
}

let inFlight: Promise<HeldPortfolio[] | null> | null = null

export function useHeldSymbols() {
  const currentUser = useCurrentUser()
  const authedFetch = useAuthedFetch()
  const portfolios = useState<HeldPortfolio[] | null>('held-symbols', () => null)

  // 讀不到就留著上一份（第一次就失敗是 null：條件選項是空的，膠囊寫「…」），不擋篩選本身
  function load(): Promise<HeldPortfolio[] | null> {
    if (!currentUser.value) return Promise.resolve((portfolios.value = null))
    inFlight ??= authedFetch<{ portfolios: HeldPortfolio[] }>('/holdings/symbols')
      .then(response => (portfolios.value = response.portfolios))
      .catch((error) => {
        devWarn('held-symbols', `GET ${BUSINESS_BASE}/holdings/symbols unavailable`, error)
        return portfolios.value
      })
      .finally(() => { inFlight = null })
    return inFlight
  }

  if (import.meta.client) {
    watch(currentUser, user => {
      if (user) load()
      else portfolios.value = null
    }, { immediate: true })
  }

  return { portfolios, load }
}
