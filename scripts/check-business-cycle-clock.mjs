// 景氣時鐘的區域判斷（shared/utils/business-cycle-clock.ts）：用 2026-10-11 實測的領先指標去趨勢值當測資，
// 四個轉折月各一筆，加上兩條邊界規則。再打一次頁面的資料路由，確認回 25 個月、兩個指標都有值。
// 用法：node scripts/check-business-cycle-clock.mjs（資料那一段需要 dev server；沒開就只跑純函式）
import assert from 'node:assert/strict'
import { clockZone } from '../shared/utils/business-cycle-clock.ts'

// 實測（業務中台 /macro/business-cycle-indicator，2026-10-11）：level＝當月去趨勢值，change＝比上個月
const cases = [
  ['2025-02', 100.5321, -0.462, 'slowdown'],
  ['2025-03', 99.8635, -0.669, 'contraction'],
  ['2025-08', 98.7889, 0.236, 'recovery'],
  ['2025-11', 100.2764, 0.546, 'expansion']
]
for (const [period, level, change, expected] of cases) assert.equal(clockZone(level, change), expected, period)
assert.equal(clockZone(100, -0.1), 'slowdown', '剛好 100 算高於趨勢')
assert.equal(clockZone(99.9, 0), 'recovery', '月變動 0 算上升')
console.log(`ok clockZone ${cases.length + 2} cases`)

const APP = process.env.APP_URL ?? 'http://localhost:3000'
const response = await fetch(`${APP}/api/hub/macro-business-cycle-clock`).catch(() => null)
if (!response) {
  console.log('skip data check (dev server not running)')
} else {
  assert.ok(response.ok, `route → ${response.status}`)
  const points = await response.json()
  assert.equal(points.length, 25, 'route returns 25 months')
  assert.ok(points.every(point => typeof point.leading === 'number' && typeof point.coincident === 'number'), 'both indicators present')
  console.log(`ok route ${points[0].period}–${points.at(-1).period}`)
}
