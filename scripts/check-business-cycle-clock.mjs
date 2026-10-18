// 景氣時鐘的區域判斷（shared/utils/business-cycle-clock.ts）：用 2026-10-11 實測的領先指標去趨勢值當測資，
// 四個轉折月各一筆，加上兩條邊界規則；clockMonths（一次循環要畫的月份）兩筆。再打一次頁面的資料路由，確認是 1982 年起的完整歷史、
// 兩個指標都有值，循環表最後一次還在進行。
// 用法：node scripts/check-business-cycle-clock.mjs（資料那一段需要 dev server；沒開就只跑純函式）
import assert from 'node:assert/strict'
import { clockMonths, clockZone } from '../shared/utils/business-cycle-clock.ts'

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

// clockMonths：起點的前一個月到終點（起點那個月才算得出月變動）；終點 null 一路到最後；起點不在資料裡回空陣列
const months = ['2015-12', '2016-01', '2016-02', '2016-03', '2016-04', '2016-05'].map(period => ({ period }))
assert.deepEqual(clockMonths(months, '2016-02', '2016-04').map(point => point.period), ['2016-01', '2016-02', '2016-03', '2016-04'], '完整循環')
assert.deepEqual(clockMonths(months, '2016-04', null).map(point => point.period), ['2016-03', '2016-04', '2016-05'], '進行中的循環')
assert.deepEqual(clockMonths(months, '1975-02', '1983-02'), [], '資料以前的循環')
console.log('ok clockMonths 3 cases')

const APP = process.env.APP_URL ?? 'http://localhost:3000'
const response = await fetch(`${APP}/api/hub/macro-business-cycle-clock`).catch(() => null)
if (!response) {
  console.log('skip data check (dev server not running)')
} else {
  assert.ok(response.ok, `route → ${response.status}`)
  const { points, cycles } = await response.json()
  assert.equal(points[0].period, '1982-01', 'full history from 1982-01')
  assert.ok(points.slice(-25).every(point => typeof point.leading === 'number' && typeof point.coincident === 'number'), 'both indicators present')
  assert.ok(cycles.length >= 16 && cycles.at(-1).troughEnd === null, 'reference dates: the latest cycle is still open')
  console.log(`ok route ${points[0].period}–${points.at(-1).period}, ${cycles.length} cycles`)
}
