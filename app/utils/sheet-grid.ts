// 試算表手感的純邏輯（2026-10-17，SharedSheetGrid 用）。使用者：照 conductor 的研究文件「將 Excel 桌面級操作手感遷移至 Web 端」
// 做一個元件，先套在 /holdings/columns 與 /watchlist；RevoGrid 試驗沒過（無障礙違規、框選跨不過凍結欄）之後選了自己做。
// 這裡放跟畫面無關、可以單獨驗的部分：框選範圍、方向鍵與 Ctrl 跳邊界、複製成 Excel 讀得懂的格式、數字放不下的 ###。
//
// 零 import：scripts/check-sheet-grid.mjs 直接載入。

export interface SheetCell { r: number; c: number }
export interface SheetRange { top: number; left: number; bottom: number; right: number }
export type SheetDirection = 'up' | 'down' | 'left' | 'right'
export type SheetCopyValue = string | number | null

export function rangeOf(a: SheetCell, b: SheetCell): SheetRange {
  return { top: Math.min(a.r, b.r), left: Math.min(a.c, b.c), bottom: Math.max(a.r, b.r), right: Math.max(a.c, b.c) }
}

export function inRange(range: SheetRange, r: number, c: number): boolean {
  return r >= range.top && r <= range.bottom && c >= range.left && c <= range.right
}

const STEP: Record<SheetDirection, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }

// 一般是移一格，到邊就不動。jump（Ctrl＋方向鍵）照 Excel：這一格和下一格都有值，就走到這段連續有值的最後一格；否則跳到
// 下一個有值的格子，一路都沒有就停在邊上
export function moveCell(cell: SheetCell, direction: SheetDirection, rows: number, cols: number, jump = false, isEmpty: (cell: SheetCell) => boolean = () => false): SheetCell {
  const [dr, dc] = STEP[direction]
  const inside = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols
  if (!inside(cell.r + dr, cell.c + dc)) return cell
  if (!jump) return { r: cell.r + dr, c: cell.c + dc }
  let r = cell.r
  let c = cell.c
  if (!isEmpty(cell) && !isEmpty({ r: r + dr, c: c + dc })) {
    while (inside(r + dr, c + dc) && !isEmpty({ r: r + dr, c: c + dc })) {
      r += dr
      c += dc
    }
    return { r, c }
  }
  r += dr
  c += dc
  while (isEmpty({ r, c }) && inside(r + dr, c + dc)) {
    r += dr
    c += dc
  }
  return { r, c }
}

// Tab 分隔、\r\n 換列（Excel 自己複製出來就是這樣）。有 Tab、換行或雙引號的字串照 RFC 4180 用雙引號包起來、裡面的雙引號寫
// 兩次，貼進 Excel 才不會被拆成好幾格
export function toTsv(matrix: SheetCopyValue[][]): string {
  const cell = (value: SheetCopyValue) => {
    if (value === null) return ''
    const text = String(value)
    return /[\t\n\r"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return matrix.map(row => row.map(cell).join('\t')).join('\r\n')
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)

// 同一份資料的 HTML 版本，給 Excel／Google 試算表：數字格帶 mso-number-format（例如 '0.00%'），貼上後是數字、格式也留著；
// 純文字版本只有數字沒有格式
export function toHtmlTable(matrix: SheetCopyValue[][], formats: readonly (string | undefined)[], header?: readonly string[]): string {
  const head = header ? `<tr>${header.map(text => `<th>${escapeHtml(text)}</th>`).join('')}</tr>` : ''
  const body = matrix.map(row => `<tr>${row.map((value, c) => {
    if (value === null) return '<td></td>'
    const format = typeof value === 'number' && formats[c] ? ` style="mso-number-format:'${formats[c]}'"` : ''
    return `<td${format}>${escapeHtml(String(value))}</td>`
  }).join('')}</tr>`).join('')
  return `<table>${head}${body}</table>`
}

// 數字放不下就整格換成 #（研究文件的「數值防呆」：1,500,000 被截成 1,500 會被讀錯，寧可看不到）。放得下回 null
export function maskedText(textWidth: number, available: number, hashWidth: number): string | null {
  if (textWidth <= available) return null
  return '#'.repeat(Math.max(1, Math.floor(available / hashWidth)))
}

// 公式參照的配色，照 Excel 的順序（藍、紅、紫、綠、橘、青），第 n 個不同的參照用第 n % 6 色。研究文件的 #5B97FF 對白底只有
// 約 3:1，當文字不夠 4.5:1，所以亮色用深一階、暗色用淺一階；scripts/check-sheet-grid.mjs 驗每一色對輸入框底色都至少 4.5:1
export const SHEET_REFERENCE_COLORS = {
  LIGHT: ['#1d4ed8', '#b91c1c', '#7e22ce', '#15803d', '#b45309', '#0f766e'],
  DARK: ['#93c5fd', '#fca5a5', '#d8b4fe', '#86efac', '#fdba74', '#5eead4']
} as const

// 沒有量字的環境（伺服器端、還沒掛載）用的估算：全形字 16px、其他 10px。Segoe UI 實測數字 8.6px，估寬一點不會切到字；
// 伺服器和瀏覽器算出同一個數，不會因為欄寬不同而 hydration 不一致
export function estimateTextWidth(text: string): number {
  let width = 0
  for (const ch of text) width += ch.charCodeAt(0) >= 0x2e80 ? 16 : 10
  return width
}

// 依一欄排序：試算表的表頭排序與 /holdings/columns 的排序工具列共用。沒有值（null）一律排最後、
// 同值照原本的順序；數字比大小，其他照中文排序
export function sortRowsBy<R>(rows: readonly R[], value: (row: R) => number | string | null, order: 'ascending' | 'descending'): R[] {
  const direction = order === 'ascending' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index, value: value(row) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) return a.value === b.value ? a.index - b.index : a.value === null ? 1 : -1
      const diff = typeof a.value === 'number' && typeof b.value === 'number' ? a.value - b.value : String(a.value).localeCompare(String(b.value), 'zh-Hant')
      return diff === 0 ? a.index - b.index : diff * direction
    })
    .map(item => item.row)
}
