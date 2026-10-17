// The one runnable check for getSeriesColors (app/utils/chart-palette.ts): the multi-line charts' colours (杜邦、三率、償債比率、類股三率).
// For every theme accent in both modes: the accent leads, no other line shares its hue, no two lines repeat a colour, every line is
// ≥ 3:1 against the card surface (WCAG 1.4.11). Pure, no network, no browser.
//
// Run: node scripts/check-chart-palette.mjs
import { CARD_SURFACE, ensureContrast, getAccentColor, getSeriesColors } from '../app/utils/chart-palette.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const channels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
const luminance = hex => channels(hex).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const hue = (hex) => {
  const [r, g, b] = channels(hex)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return h * 60
}
const hueGap = (a, b) => { const gap = Math.abs(hue(a) - hue(b)); return Math.min(gap, 360 - gap) }

console.log('預設主題（金）亮色四條線：金領頭，接靛藍、青綠、紫')
assert(JSON.stringify(getSeriesColors('LIGHT', 'GOLD', 4)) === JSON.stringify(['#8a6823', '#3f51b5', '#00695c', '#6a1b9a']), getSeriesColors('LIGHT', 'GOLD', 4).join(' '))

console.log('主題是藍：色相太近的靛藍、青讓開')
const blue = getSeriesColors('LIGHT', 'BLUE', 4)
assert(!blue.includes('#3f51b5') && !blue.includes('#0e7490'), blue.join(' '))

for (const mode of ['LIGHT', 'DARK']) {
  // 四條：目前最多的是杜邦（見 getSeriesColors 的 ponytail 註解）
  console.log(`\n${mode}：七種主題色 × 四條線`)
  for (const accentName of ['GOLD', 'BLUE', 'GREEN', 'PURPLE', 'ORANGE', 'RED', 'TEAL']) {
    const colors = getSeriesColors(mode, accentName, 4)
    const accent = ensureContrast(getAccentColor(mode, accentName), mode)
    const worst = Math.min(...colors.map(color => contrast(color, CARD_SURFACE[mode])))
    const nearest = Math.min(...colors.slice(1).map(color => hueGap(color, accent)))
    assert(colors[0] === accent && new Set(colors).size === 4 && worst >= 3 && nearest >= 40,
      `${accentName}：主題色領頭、四色不重複、對卡片最低 ${worst.toFixed(2)}:1、其餘離主題色相最近 ${nearest.toFixed(0)}°（${colors.join(' ')}）`)
  }
}

console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exit(failures ? 1 : 0)
