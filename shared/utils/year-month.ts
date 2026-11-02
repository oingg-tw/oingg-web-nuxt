// 年月一律寫 "YYYY-MM"（全生態系的資料格式標準，2026-11-03）。ETF 基金月報的 yearMonth 上游原本送 "202609"，要改成 "2026-09"，
// 切換期間兩種都收；認不得的回 null（不猜）。零 import，scripts/check-number-format.mjs 直接驗
export function normalizeYearMonth(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const match = /^(\d{4})-?(0[1-9]|1[0-2])$/.exec(raw)
  return match ? `${match[1]}-${match[2]}` : null
}
