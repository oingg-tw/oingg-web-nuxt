// 近N年照日曆往回算（app/utils/lookback-window.ts 的 periodIndex／calendarIndexes／calendarWindowStart，2026-11-24）：半年報的年份一年兩點，
// 照期數切會多出好幾年；讀不出期別的 key 退回照期數切
// Run: node scripts/check-lookback-window.mjs
import assert from 'node:assert/strict'
import { calendarIndexes, calendarWindowStart, fitLookbackWindow, insufficientLookbackYears, periodIndex } from '../app/utils/lookback-window.ts'

assert.equal(periodIndex('2024Q1', 4), 2024 * 4)
assert.equal(periodIndex('2024 Q4', 4), 2024 * 4 + 3)
assert.equal(periodIndex('2024-03', 12), 2024 * 12 + 2)
assert.equal(periodIndex('2024', 1), 2024)
assert.equal(periodIndex('2024', 4), null, '季圖裡讀不出季')
assert.equal(periodIndex('2024-03-15', 52), null, '週資料照期數')

// 6498 的淨值組成：2018Q4～2023Q2 只有 Q2、Q4，之後每季
const keys = []
for (let year = 2018; year <= 2026; year++) {
  for (const quarter of [1, 2, 3, 4]) {
    const key = `${year} Q${quarter}`
    if (key < '2018 Q4' || key > '2026 Q3') continue
    if (key < '2023 Q3' && quarter % 2 === 1) continue
    keys.push(key)
  }
}
const indexes = calendarIndexes(keys, 4)
assert.equal(keys.length, 23)
// 跨度 32 季＝8 年：照日曆算近5年填得滿（照期數只有 23 期，近5年也是灰的）；近10年要 40 季，選了收斂成近5年
const span = indexes.at(-1) - indexes[0] + 1
assert.equal(span, 32)
assert.deepEqual(insufficientLookbackYears(span, 4), [10])
assert.equal(fitLookbackWindow('近10年', span, 4), '近5年')
assert.equal(fitLookbackWindow('近10年', 40, 4), '近10年', '40 季剛好是近10年')
// 近5年從 2021 Q4 開始（照期數的最後 20 期是從 2020 Q2）；近3年從 2023 Q4
assert.equal(keys[calendarWindowStart(indexes, '近5年', 4)], '2021 Q4')
assert.equal(keys[calendarWindowStart(indexes, '近3年', 4)], '2023 Q4')
assert.equal(calendarWindowStart(indexes, null, 4), 0)
// 每季都有的公司跟照期數一樣：近5年＝最後 20 期
const quarterly = Array.from({ length: 40 }, (_, i) => `${2016 + Math.floor((i + 3) / 4)}Q${((i + 3) % 4) + 1}`)
assert.equal(quarterly.length - calendarWindowStart(calendarIndexes(quarterly, 4), '近5年', 4), 20)
// 有一期讀不出來就整串退回照期數
assert.equal(calendarIndexes(['2024Q1', '其他'], 4), null)
assert.equal(calendarIndexes([], 4), null)
console.log('PASS: lookback window')
