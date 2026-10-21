import type { ExDividendMonthsPageData } from '#shared/types/hub'

// GET /api/hub/ex-dividend-months?month=YYYY-MM — 除權息月覽（2026-10-21）：今年 12 個月的檔數（還沒到的月份用去年同月試算）＋選定月份的清單。
// 「這個月」以台北時間為準；month 不是今年的月份就用這個月
export default defineEventHandler(async (event): Promise<ExDividendMonthsPageData> => {
  const current = new Date(Date.now() + 8 * HOUR * 1000).toISOString().slice(0, 7)
  const cells = await getExDividendMonthCells(current)
  const query = getQuery(event).month
  const cell = cells.find(item => item.month === query) ?? cells.find(item => item.month === current)!
  return { year: Number(current.slice(0, 4)), current, cells, month: cell.month, rows: await getExDividendMonth(cell.source) }
})
