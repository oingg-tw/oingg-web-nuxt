export type ExDividendType = '息' | '權' | '權息'

// Confirmed by bff-ts/analysis-ts 2026-09-04: all 8 numeric fields are plain `number | null` —
// NOT bigint-serialized strings like useCapitalStockHistory.ts's paidInShares/paidInCapital
// turned out to be. This endpoint is simpler in that respect.
//
// Under exType='權', two groups are mutually exclusive (never both set on the same entry):
// - Stock dividend: stockDividendRatio alone.
// - Cash capital increase subscription: subscriptionRatio/subscriptionPricePerShare/
//   sharesOffered/sharesEmpOwner/sharesholderOwner/stockHoldingRatio together.
// exType='息' only ever sets cashDividend; everything else is null.
//
// The four subscription-group field NAMES (sharesOffered/sharesEmpOwner/sharesholderOwner/
// stockHoldingRatio) are analysis-ts's own best-guess translation of twse-ts's raw columns,
// NOT confirmed against twse-ts directly (flagged by bff-ts 2026-09-04) — treat their exact
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
  // announced：還沒除息；realized：已除息、發放日還沒到（這種一定有 paymentDate）。
  status?: 'announced' | 'realized'
  paymentDate?: string | null
  // ETF 的每單位配息；ETF 的 cashDividend 一律是 null。金額讀 `distributionPerUnit ?? cashDividend`——
  // 不靠 securityType 判斷：本機 :4000 的 analysis-ts 缺大部分 sitca ETF 資料，未除息的 ETF 只剩證交所預告那一列、
  // 被標成 COMMON（0056 就是）。DEV 是對的（bff-ts 2026-10-06 逐列核對 335 筆，0 筆錯標）；這個寫法兩邊都對。
  distributionPerUnit?: number | null
}

// GET /stocks/ex-dividend-notices?symbols=<comma-separated, up to 100> — bff-ts forwarding onto
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
// Returns null on a failed request vs. a real (possibly empty) object on a genuine response —
// same reasoning as useCapitalStockHistory.ts: a caller needs to tell "endpoint unreachable,
// show the structural shell" apart from "answered: nothing scheduled for this stock right now."
//
// Fetched through this app's own cached passthrough（/api/bff, server/api/bff/[...path].get.ts）
// since 2026-09-19 — same path and shape, cached an hour on the server per symbol list.
export function useExDividendNotices(symbols: Ref<string[]>) {
  return useAsyncData<Record<string, ExDividendNotice[]> | null>(
    () => `ex-dividend-notices-${symbols.value.join(',') || 'none'}`,
    async () => {
      if (!symbols.value.length) return {}

      try {
        const raw = await $fetch<{ notices: Record<string, ExDividendNotice[]> }>('/stocks/ex-dividend-notices', {
          baseURL: '/api/bff',
          retry: 0,
          query: { symbols: symbols.value.join(',') }
        })
        // 只留還沒除息的（status 不是 realized）。2026-10-06 起上游也回「已除息、還沒發放」的那幾筆，但這支
        // composable 的每一個呼叫端（股利頁的「下一次除權息」、摘要句、除權息卡、儀表板）問的都是「下一次
        // 除權息是哪天」——把已除息的當成下一次，會顯示一個已經過去的日期（bff-ts 提醒）。修在這裡一次，
        // 不在四個呼叫端各濾一次。要發放日的觀察清單自己另外打這支、讀 realized 那幾筆。
        return Object.fromEntries(Object.entries(raw.notices).map(([symbol, list]) => [symbol, list.filter(notice => notice.status !== 'realized')]).filter(([, list]) => list!.length > 0))
      } catch (error) {
        devWarn('ex-dividend-notices', `GET /api/bff/stocks/ex-dividend-notices?symbols=${symbols.value.join(',')} unavailable`, error)
        return null
      }
    },
    { watch: [symbols], default: () => null }
  )
}
