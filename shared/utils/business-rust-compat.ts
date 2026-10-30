// 業務中台換成 Rust 版（oingg-business-rust）的並存期（2026-10-29 使用者「做」）：Rust 照詞彙表第二輪改了回應的鍵（oingg-business-rust 的
// docs/contract-delta.md，C1–C6），Go 版還是舊鍵。這裡把 Rust 的形狀換回站內一直在用的形狀，兩邊都讀得懂。只改名、讀取處只有一兩個的
// （C4 ETF 簡稱、C5 除權息月份）直接在讀取處寫 `新 ?? 舊`，搜尋「Rust 換版並存」找得到全部。被 scripts/check-business-rust-compat.mjs 直接
// import，所以零 import。
// shortcut: 站內照舊用 Go 的鍵名，Go 退場後拿掉這個檔與那些 `?? 舊`，改成直接讀新鍵

type Loose = Record<string, unknown>

// 有新鍵的列補上舊鍵（值照抄）；沒有新鍵就原樣
function withOldKeys(row: Loose, pairs: [next: string, old: string][]): Loose {
  const out = { ...row }
  for (const [next, old] of pairs) if (next in row) out[old] = row[next]
  return out
}

// C1：GET /holdings/performance 的月份座標 period → yearMonth、latestPeriod → latestYearMonth、sourcePeriod → sourceYearMonth。
// 逐年報酬的 period 是年份，不改。C2（10/30 生效）：series[].date → tradeDate（rolling.series 也改了，站內沒讀）
export function performanceFromRust<T extends object>(raw: T): T {
  const report = raw as Loose & { series?: Loose[]; riskFree?: (Loose & { rates?: Loose[] }) | null; periodReturns?: Loose & { monthly?: Loose[] } }
  const series = report.series?.map(point => withOldKeys(point, [['tradeDate', 'date']]))
  const riskFree = report.riskFree && {
    ...withOldKeys(report.riskFree, [['latestYearMonth', 'latestPeriod']]),
    rates: report.riskFree.rates?.map(rate => withOldKeys(rate, [['yearMonth', 'period'], ['sourceYearMonth', 'sourcePeriod']]))
  }
  const periodReturns = report.periodReturns && {
    ...report.periodReturns,
    monthly: report.periodReturns.monthly?.map(row => withOldKeys(row, [['yearMonth', 'period']]))
  }
  return { ...raw, ...(series ? { series } : {}), ...('riskFree' in report ? { riskFree } : {}), ...(periodReturns ? { periodReturns } : {}) }
}

// C6：GET /public/shares/{token} 持股的報酬率。Rust 換鍵也換單位：returnPct 是百分比字串（"12.3456"＝12.3456%），Go 的 pnlPct 是 0～1 的比值字串（"0.123456"）。
// 回傳站內一直用的 0～1 比值；兩個都沒有是 null
export function shareReturnRatio(holding: { returnPct?: number | string | null; pnlPct?: number | string | null }): number | null {
  if (holding.returnPct != null) return Number(holding.returnPct) / 100
  return holding.pnlPct == null ? null : Number(holding.pnlPct)
}
