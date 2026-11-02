// 散佈圖的手機版：四個象限各一組（2026-11-02，使用者選「要比很多項目的圖，手機改成清單」）。零 import，scripts/check-quadrants.mjs 直接驗。
// titles 依序是 y 高 x 高、y 高 x 低、y 低 x 高、y 低 x 低；剛好在門檻上算高（成長率 0 算「沒有減少」）。沒有座標的列不分組。
// 列的順序照傳進來的：產業頁照代號，不照數字排（不做排行）
export function quadrantGroups<Row>(
  rows: readonly Row[],
  point: (row: Row) => readonly [number, number] | null,
  split: readonly [number, number],
  titles: readonly [string, string, string, string]
): { title: string; rows: Row[] }[] {
  const groups = titles.map(title => ({ title, rows: [] as Row[] }))
  for (const row of rows) {
    const xy = point(row)
    if (xy) groups[(xy[1] >= split[1] ? 0 : 2) + (xy[0] >= split[0] ? 0 : 1)]!.rows.push(row)
  }
  return groups
}

// 中位數，偶數個取中間兩個的平均；沒有值回 null
export function medianOf(values: readonly number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}
