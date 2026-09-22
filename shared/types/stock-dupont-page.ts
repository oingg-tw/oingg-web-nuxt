import type { MetricsHistorySeries } from './metrics-history'

// server/api/stock/[code]/dupont.get.ts — everything /stock/:code/dupont（杜邦分析, 2026-09-22）
// needs in one same-origin round trip.
//
// The third page built on the /margins shape（a nav group's own relationship page）and it clears
// the same bar the other two had to: the chain is ARITHMETIC, not correlational. Measured before
// any of this was designed, across 10–12 symbols:
//
//   ROE = 稅務負擔 × 利息負擔 × EBIT利潤率 × 資產週轉 × 權益乘數     Q 68/68, TTM 16/16 within ±0.05pp
//   稅務負擔 × 利息負擔 × EBIT利潤率 = 淨利率                        92/92 within ±0.05pp
//
// That second line is why this page is worth more than the three-factor version: the five-step
// identity nests inside the three-step one, so the page can say「ROE = 淨利率 × 資產週轉 × 權益
// 乘數，而淨利率又拆成稅、利息、本業」without asserting anything. ROE falling because of tax, because
// of financing cost, or because the business itself weakened are three different conclusions, and
// the three-factor version collapses all of them into「淨利率」.
//
// HISTORY WORTH KEEPING: this page was written off twice on measurements that were wrong.
//   * 「五步杜邦做不了」— taxBurden/interestBurden/ebitMargin are not in the catalog, but
//     dupontTaxBurden/dupontInterestBurden/dupontEbitMargin are. I searched the wrong names and
//     concluded the metrics did not exist. bff-ts pointed out the prefix.
//   * 「只能做單季」— equityMultiplier had no TTM basis, so a TTM identity looked impossible. It
//     gained one in analysis-ts's average-denominator change (7df73c14), because an average of five
//     quarter-ends IS a period quantity. Asking for「a TTM version of a point-in-time ratio」had
//     been the wrong request; the right one was already being built.
//
// BOTH bases（2026-09-22,「杜邦分析 圖表要可以選單季 與近四季」）, TTM first.
//
// This page was TTM-only, and the reason recorded here was a real one rather than a default: a
// single quarter's ROE is a QUARTERLY return, so「ROE 9.71%」read as an annual figure overstates it
// roughly fourfold, and the audience this app is built for is exactly the one that would read it
// that way. 資產週轉率 carries the same trap more quietly — 0.14 次 is a quarter's turnover, and
// the page's own plain-language gloss for it said「一年」.
//
// The answer to that is labelling, not withholding: every basis-dependent string on the page now
// follows the toggle（the period label in each sentence and caption, and 資產週轉率's gloss）, so a
// 單季 number is never presented in 近四季 words. TTM stays the default for the same reason it was
// the only option.
//
// Q is not merely permissible here, it is better covered: measured across a 15-symbol sample, the
// three-factor identity holds 115/115 on Q against 109/109 on TTM, with full coverage on 15/15
// symbols against 13/15. The symbols TTM drops are the ones a 單季 reader can still see.
export interface StockDupontPageResponse {
  symbol: string
  // Ascending (oldest first), with every code in DUPONT_METRIC_CODES in each period's `values`.
  // `null` when the history endpoint failed — the page degrades and goes noindex rather than
  // erroring, same rule as every other page in this family.
  series: MetricsHistorySeries | null
  // The same codes and depth on the 單季 basis. Fetched alongside rather than on toggle so the
  // switch is instant and needs no loading state — two cached calls, one page.
  quarterlySeries: MetricsHistorySeries | null
}

// The five factors, in the order they multiply. 稅務負擔 and 利息負擔 are ratios OF profit at
// successive stages（淨利/稅前、稅前/EBIT）, so a healthy company runs both near 100% and a heavily
// taxed or heavily indebted one runs lower.
export const DUPONT_FACTOR_CODES = [
  'dupontTaxBurden',
  'dupontInterestBurden',
  'dupontEbitMargin',
  'assetTurnover',
  'equityMultiplier'
] as const

// The three that multiply to 淨利率 — the part the five-step decomposition adds over the three-step
// one, and the three that share a unit (%), which is what lets them go on one chart.
export const DUPONT_PROFIT_CODES = ['dupontTaxBurden', 'dupontInterestBurden', 'dupontEbitMargin'] as const

// 7 codes, inside the 10 metrics-history allows in one request, so the whole page is one cached
// round trip. netProfitMargin is fetched as the published figure rather than multiplied out here:
// the page's claim is that the backend's own numbers agree, and computing one side of that claim
// in the frontend would make it circular.
export const DUPONT_METRIC_CODES: string[] = ['roe', 'netProfitMargin', ...DUPONT_FACTOR_CODES]
