// 「我的篩選」管理彈窗：草稿變成要套用的變更（app/utils/preset-changes.ts）。Run: node scripts/check-preset-changes.mjs
import assert from 'node:assert/strict'
import { presetChanges, presetNameErrors } from '../app/utils/preset-changes.ts'

const row = (id, name, extra = {}) => ({ id, name, original: name, editable: true, removed: false, ...extra })
const ids = ['u', 'a', 'b', 'c']
const draft = [row('u', '價值型（未儲存）', { editable: false }), row('a', '高股息'), row('b', '低本益比'), row('c', '成長')]

// 什麼都沒動：沒有任何變更
assert.deepEqual(presetChanges(ids, draft), { renames: [], removals: [], order: null })

// 改名去掉前後空白；只改空白不算改名；不能改的那一組不送
assert.deepEqual(presetChanges(ids, [draft[0], { ...draft[1], name: ' 存股 ' }, { ...draft[2], name: '低本益比 ' }, draft[3]]).renames, [['a', '存股']])
assert.deepEqual(presetChanges(ids, [{ ...draft[0], name: '改了' }, ...draft.slice(1)]).renames, [])

// 刪除：不改順序就不排序（刪掉的那一組不算順序變了）；刪掉的不送改名
assert.deepEqual(presetChanges(ids, [draft[0], { ...draft[1], removed: true, name: '改了也不送' }, draft[2], draft[3]]), { renames: [], removals: ['a'], order: null })

// 排序：留下來的新順序，不含刪掉的
assert.deepEqual(presetChanges(ids, [draft[0], draft[2], draft[1], draft[3]]).order, ['u', 'b', 'a', 'c'])
assert.deepEqual(presetChanges(ids, [draft[0], draft[3], { ...draft[1], removed: true }, draft[2]]), { renames: [], removals: ['a'], order: ['u', 'c', 'b'] })

// 名稱 1～20 字；刪掉的、不能改的不檢查
assert.deepEqual(presetNameErrors([row('a', '  '), row('b', 'x'.repeat(21)), row('c', 'x'.repeat(20)), row('d', '', { removed: true }), row('e', '', { editable: false })]), { a: '名稱要 1 到 20 個字', b: '名稱要 1 到 20 個字' })

console.log('PASS: preset changes')
