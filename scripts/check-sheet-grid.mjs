// The one runnable check for the spreadsheet logic (app/utils/sheet-grid.ts) and the formula-bar reference coloring
// (formulaReferences in app/utils/holdings-formula.ts). Pure, no network, no browser.
//
// Run: node scripts/check-sheet-grid.mjs
import { estimateTextWidth, maskedText, moveCell, rangeOf, SHEET_REFERENCE_COLORS, toHtmlTable, toTsv } from '../app/utils/sheet-grid.ts'
import { formulaReferences } from '../app/utils/holdings-formula.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('框選範圍')
assert(same(rangeOf({ r: 3, c: 1 }, { r: 0, c: 4 }), { top: 0, left: 1, bottom: 3, right: 4 }), '兩端反向也是同一個矩形')

console.log('方向鍵與 Ctrl＋方向鍵（5 列 × 4 欄，第 2 欄的第 2、3 列是空的）')
const empty = new Set(['2:2', '3:2'])
const isEmpty = cell => empty.has(`${cell.r}:${cell.c}`)
assert(same(moveCell({ r: 0, c: 0 }, 'up', 5, 4), { r: 0, c: 0 }), '到邊就不動')
assert(same(moveCell({ r: 0, c: 0 }, 'right', 5, 4), { r: 0, c: 1 }), '一般移一格')
assert(same(moveCell({ r: 0, c: 2 }, 'down', 5, 4, true, isEmpty), { r: 1, c: 2 }), 'Ctrl↓：停在這段連續有值的最後一格')
assert(same(moveCell({ r: 1, c: 2 }, 'down', 5, 4, true, isEmpty), { r: 4, c: 2 }), 'Ctrl↓：下一格是空的，跳到下一個有值的格子')
assert(same(moveCell({ r: 0, c: 0 }, 'right', 5, 4, true, isEmpty), { r: 0, c: 3 }), 'Ctrl→：整列有值，走到最後一欄')
assert(same(moveCell({ r: 2, c: 1 }, 'right', 5, 4, true, cell => cell.c >= 2), { r: 2, c: 3 }), 'Ctrl→：後面都是空的，停在邊上')

console.log('複製成 Excel 讀得懂的格式')
const tsv = toTsv([[1085, 'a\tb', null], [0.487, 'say "hi"', 'x\ny']])
assert(tsv === '1085\t"a\tb"\t\r\n0.487\t"say ""hi"""\t"x\ny"', 'Tab 分隔、\\r\\n 換列；有 Tab、換行、雙引號的照 RFC 4180 包起來')
const html = toHtmlTable([[0.487, '<b>']], ['0.00%', undefined], ['殖利率', '名稱'])
assert(html === `<table><tr><th>殖利率</th><th>名稱</th></tr><tr><td style="mso-number-format:'0.00%'">0.487</td><td>&lt;b&gt;</td></tr></table>`, 'HTML 版本：數字帶 mso-number-format、文字有跳脫、可加表頭')

console.log('數字放不下就整格顯示 #')
assert(maskedText(50, 60, 9) === null, '放得下：照常顯示')
assert(maskedText(70, 60, 9) === '######', '放不下：用 # 填滿欄寬（60 ÷ 9 → 6 個）')
assert(maskedText(70, 4, 9) === '#', '再窄也至少一個 #')
assert(estimateTextWidth('殖利率 1.23%') === 3 * 16 + 6 * 10, '估算字寬：全形 16px、其他 10px')

console.log('公式參照的位置（公式列上色）')
assert(same(formulaReferences('=D/(A*B)'), [{ letter: 'D', start: 1, end: 2 }, { letter: 'A', start: 4, end: 5 }, { letter: 'B', start: 6, end: 7 }]), '欄位字母與在原字串的位置')
assert(same(formulaReferences('  =d/SUM(d:d)'), [{ letter: 'D', start: 3, end: 4 }, { letter: 'D', start: 9, end: 12 }]), '開頭的空白與 =、小寫、整欄範圍、函數名稱不算參照')
assert(same(formulaReferences('=D/(A*'), [{ letter: 'D', start: 1, end: 2 }, { letter: 'A', start: 4, end: 5 }]), '打到一半的公式照樣上色')
assert(same(formulaReferences('=D&A'), []), '有看不懂的字元就不上色')

console.log('參照配色對輸入框底色至少 4.5:1')
const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
// 亮色：輸入框白底與頁面的米白底；暗色：輸入框（#141414）、頁面（#1d1e1f）、卡片（#2a2a2a，2026-10-14 量過的 el-card 底）
const backgrounds = { LIGHT: ['#ffffff', '#faf9f6'], DARK: ['#141414', '#1d1e1f', '#2a2a2a'] }
for (const mode of ['LIGHT', 'DARK']) {
  const worst = Math.min(...SHEET_REFERENCE_COLORS[mode].flatMap(color => backgrounds[mode].map(bg => contrast(color, bg))))
  assert(worst >= 4.5, `${mode} 最低 ${worst.toFixed(2)}:1`)
}

console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exit(failures ? 1 : 0)
