import type { MetricsHistorySeries } from './metrics-history'

// server/api/stock/[code]/solvency.get.ts — everything /stock/:code/solvency（安全韌性的組成,
// 2026-09-21）needs in one same-origin round trip.
//
// The second page built on the /margins shape（a group's own relationship page, first child of its
// nav group）and for the same reason: single-metric pages each show ONE ratio over time, and what a
// reader actually wants to know is how the ratios relate（「只有單一一個指標呈現好像沒甚麼意思」）.
//
// It qualifies for that treatment because its two chains are ARITHMETIC, not correlational — the
// same bar /margins had to clear. Both verified live across 2330/1101/1216/2454/2317 before this
// page was designed:
//
//   流動比率 − 速動比率 = 存貨 ÷ 流動負債          （exact: quickRatio's own numerator is
//   速動比率 − 現金比率 = 其他速動資產 ÷ 流動負債     CurrentAssets − Inventory）
//   負債比率 + 股東權益比率 = 100%                （measured exactly 100.00 on all five）
//
// A pairing that is merely CORRELATED — 營收成長年增率 against 股價, say — is deliberately not
// what this page does: describing a chain of subtractions needs no claim about a company, while
// putting a fundamental next to price implies one.
export interface StockSolvencyPageResponse {
  symbol: string
  // Ascending (oldest first), with every code in SOLVENCY_METRIC_CODES in each period's `values`.
  // `null` when the history endpoint failed — the page degrades and goes noindex rather than
  // erroring, same rule as the metric and margins pages.
  series: MetricsHistorySeries | null
}

// 短期償債的三道門檻, in strictness order: each one's numerator is a subset of the one before it,
// over the same 流動負債 denominator. That nesting IS the chain the waterfall spends.
export const SOLVENCY_LIQUIDITY_CODES = ['currentRatio', 'quickRatio', 'cashRatio'] as const

// 資本結構 — these two sum to 100% by definition (總負債 + 股東權益 = 總資產).
export const SOLVENCY_STRUCTURE_CODES = ['debtRatio', 'equityRatio'] as const

export const SOLVENCY_METRIC_CODES: string[] = [...SOLVENCY_LIQUIDITY_CODES, ...SOLVENCY_STRUCTURE_CODES]
