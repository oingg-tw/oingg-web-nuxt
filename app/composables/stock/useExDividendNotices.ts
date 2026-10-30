export type ExDividendType = '息' | '權' | '權息'

// Confirmed by 業務中台/analysis-ts 2026-09-04: all 8 numeric fields are plain `number | null`, not bigint-serialized strings.
//
// Under exType='權', two groups are mutually exclusive (never both set on the same entry):
// - Stock dividend: stockDividendRatio alone.
// - Cash capital increase subscription: subscriptionRatio/subscriptionPricePerShare/
//   sharesOffered/sharesEmpOwner/sharesholderOwner/stockHoldingRatio together.
// exType='息' only ever sets cashDividend; everything else is null.
//
// The four subscription-group field NAMES (sharesOffered/sharesEmpOwner/sharesholderOwner/
// stockHoldingRatio) are analysis-ts's own best-guess translation of twse-ts's raw columns,
// NOT confirmed against twse-ts directly (flagged by 業務中台 2026-09-04) — treat their exact
// meaning as unconfirmed. Don't write confident Chinese copy claiming to know precisely what
// each one represents; show them plainly (raw label + value) until that's verified, same
// caution as this app already applies to any field whose real-world meaning isn't nailed down.
export interface ExDividendNotice {
  exDate: string
  exType: ExDividendType
  stockDividendRatio: number | null
  subscriptionRatio: number | null
  subscriptionPricePerShare: number | null
  cashDividend: number | null
  sharesOffered: number | null
  sharesEmpOwner: number | null
  sharesholderOwner: number | null
  stockHoldingRatio: number | null
  // 2026-10-06 analysis-ts 改了這支（使用者核准），每一筆變成跟 ex-dividend-calendar 同形狀，多了下面這些。
  // PRD 上游還沒換之前可能沒有，所以都是選填。
  // announced：還沒除息；realized：已除息、現金或配股至少一個還沒發放（2026-10-20 起，業務中台 1070910；原本只看現金）。
  // paymentDate 只代表現金，只配股的列是 null；配股的發放日在 stockDividendDistributionDate（只有個股的 realized 列可能有值，
  // mops 從 10/20 才收、不回補）
  status?: 'announced' | 'realized'
  paymentDate?: string | null
  stockDividendDistributionDate?: string | null
  // ETF 的每單位配息。金額一律讀 `distributionPerUnit ?? cashDividend`，**不要兩個相加**：未除息的 ETF 列可能兩個都有
  // （證交所預告的 cashDividend，analysis-ts 在 sitca 還沒有金額時拿它填 distributionPerUnit；DEV 量到 5 筆兩者相等，
  // 業務中台 2026-10-06）。securityType 已由 analysis-ts 從證券本身判定（fde1e48c），可以信，但這裡用不到它。
  distributionPerUnit?: number | null
}

// GET /stocks/ex-dividend-notices?symbols=<comma-separated, up to 100> — 業務中台 forwarding onto
// analysis-ts, confirmed live 2026-09-04 (real data tested against 6533/1466). Covers both the
// single-symbol case (stock detail page) and the multi-symbol case (dashboard's watchlist
// card) with the same endpoint.
//
// Returns only not-yet-ex events to callers — since 2026-10-06 the upstream also sends ex-but-unpaid
// ones, filtered out below (see the comment at the return).
// A symbol with nothing upcoming is simply ABSENT from the response's `notices` map, not an
// empty array — this passes that through as-is rather than normalizing missing keys to `[]`,
// so callers can't accidentally treat "no key" and "empty array" as different states when the
// real API never distinguishes them.
//
// A failed request throws (error set, reported to the global load-failure dialog); a genuine response is a real
// (possibly empty) object — "answered: nothing scheduled for this stock right now."
//
// Fetched through this app's own cached passthrough（/api/cached, server/api/cached/[...path].get.ts）
// since 2026-09-19 — same path and shape, cached an hour on the server per symbol list.
export function useExDividendNotices(symbols: Ref<string[]>) {
  const result = useAsyncData<Record<string, ExDividendNotice[]> | null>(
    () => `ex-dividend-notices-${symbols.value.join(',') || 'none'}`,
    async () => {
      if (!symbols.value.length) return {}

      try {
        const raw = await apiFetch<{ notices: Record<string, ExDividendNotice[]> }>('/stocks/ex-dividend-notices', { baseURL: BUSINESS_CACHED_BASE, query: { symbols: symbols.value.join(',') } })
        // 只留還沒除息的（status 不是 realized）。2026-10-06 起上游也回「已除息、還沒發放」的那幾筆，但這支
        // composable 的每一個呼叫端（股利頁的「下一次除權息」、摘要句、除權息卡、儀表板）問的都是「下一次
        // 除權息是哪天」——把已除息的當成下一次，會顯示一個已經過去的日期（業務中台 提醒）。修在這裡一次，
        // 不在四個呼叫端各濾一次。要發放日的觀察清單自己另外打這支、讀 realized 那幾筆。
        // 除息日／除權日合成站內的 exDate＋exType（business-shapes.ts）
        return Object.fromEntries(Object.entries(raw.notices).map(([symbol, list]) => [symbol, list.filter(notice => notice.status !== 'realized').map(withExType)]).filter(([, list]) => list!.length > 0))
      } catch (error) {
        devWarn('ex-dividend-notices', `GET /api/cached/stocks/ex-dividend-notices?symbols=${symbols.value.join(',')} unavailable`, error)
        throw error
      }
    },
    { watch: [symbols], default: () => null }
  )
  // 讀取失敗交給全站彈窗（2026-10-11）：原本回 null，跟「還在載入」長得一樣，股利頁的除權息卡會永遠顯示「資料載入中」
  watchLoadFailure(() => `ex-dividend-notices:${symbols.value.join(',')}`, () => result.error.value, () => result.refresh(), { scope: 'section' })
  return result
}
