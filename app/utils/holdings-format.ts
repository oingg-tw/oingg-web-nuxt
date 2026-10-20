// 持股頁的金額寫法，兩頁共用（持股總覽、績效）。名字帶 holdings 前綴：app/utils 的 export 會自動匯入到
// 整個 app，通名（money、signedMoney）遲早被某個檔案的同名區域函式靜默遮蔽。

export function holdingsMoney(value: number): string {
  return groupThousands(Math.round(value))
}

// 損益同時用正負號與 ▲／▼ 表示，不只靠顏色；0 不加箭頭（平盤不是漲也不是跌）。
export function holdingsSignedMoney(value: number | null): string {
  if (value === null) return '－'
  const rounded = Math.round(value)
  if (rounded === 0) return '0 元'
  return `${rounded > 0 ? '▲ +' : '▼ '}${groupThousands(rounded)} 元`
}

// 報酬率（小數，例如 0.123456）→「+12.35%」。0 不加正號；null 是「－」。
export function holdingsSignedPct(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '－'
  const fixed = (ratio * 100).toFixed(2)
  if (Number(fixed) === 0) return '0.00%'
  return `${ratio > 0 ? '+' : ''}${fixed}%`
}

// ---- 持股頁的期間選擇（交易績效、風險共用） ----

// 交易日期以台北時間為準：使用者在國外、或伺服器跑 UTC 時，每天前 8 小時會差一天。
export function holdingsTaipeiDate(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
}

// 台北日期字串往前推 N 個月（月底對不上時落在該月最後一天，例如 05-31 往前三個月是 02-28）
export function holdingsMonthsBefore(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const target = new Date(Date.UTC(year, month - 1 - months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

// 「近一年」：持股各頁的預設期間（使用者 2026-10-05 指定、2026-10-19 再說一次「期間要預設為近一年」）、期間選單的「近一年」都用
// 這一支（持股分析的有效產業數 2026-10-20 起改在頁面上算，不再借風險頁）。原本預設用「年份減一」、選單用「往前推 12 個月」，2 月 29 日兩者差一天，
// 選單就會顯示「自訂區間…」而不是「近一年」
export function holdingsLastYear(): [string, string] {
  const today = holdingsTaipeiDate()
  return [holdingsMonthsBefore(today, 12), today]
}
