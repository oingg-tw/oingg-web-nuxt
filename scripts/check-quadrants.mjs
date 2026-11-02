// 散佈圖手機版的四組分法（shared/utils/quadrants.ts）：門檻上算高、沒有座標的不分組、順序照原樣；中位數
// Run: node scripts/check-quadrants.mjs
import assert from 'node:assert/strict'
import { quadrantGroups, medianOf } from '../shared/utils/quadrants.ts'

const rows = [['a', 1, 1], ['b', -1, 1], ['c', 1, -1], ['d', -1, -1], ['e', 0, 0], ['f', null, null], ['g', 2, 5]]
const groups = quadrantGroups(rows, ([, x, y]) => (x === null ? null : [x, y]), [0, 0], ['高高', '高低', '低高', '低低'])
assert.deepEqual(groups.map(group => group.rows.map(([name]) => name)), [['a', 'e', 'g'], ['b'], ['c'], ['d']])
assert.deepEqual(groups.map(group => group.title), ['高高', '高低', '低高', '低低'])
console.log('  PASS  門檻上算高、沒有座標的不分組、組內順序照傳進來的')

assert.equal(medianOf([3, 1, 2]), 2)
assert.equal(medianOf([4, 1, 3, 2]), 2.5)
assert.equal(medianOf([]), null)
console.log('  PASS  中位數：奇數取中間、偶數取中間兩個的平均、沒有值是 null')
