// 圖上的空白期別（app/utils/metric-null-reason.ts 的 semiannualWindowNote、app/utils/metric-history-points.ts 的 trimEmptyEnds）：
// 近四季跨到只申報半年報那一年時提示框寫的原因，與頭尾修掉、中間留著
// Run: node scripts/check-null-reason.mjs
import assert from 'node:assert/strict'
import { NULL_REASON_LABELS, nullReasonShortText, semiannualWindowNote, windowShortfallText } from '../app/utils/metric-null-reason.ts'
import { trimEmptyEnds } from '../app/utils/metric-history-points.ts'

const codes = ['roe', 'netProfitMargin']
const entry = (fiscalYear, fiscalQuarter, value, nullReason = null) => ({ fiscalYear, fiscalQuarter, values: Object.fromEntries(codes.map(code => [code, { value, nullReason }])) })
// 3158：2023 年只申報半年報（單季序列的 Q2、Q4 標 semiannual_only），2024 年起季報
const quarterly = [entry(2023, 2, null, 'semiannual_only'), entry(2023, 4, null, 'semiannual_only'), entry(2024, 1, 3.58), entry(2024, 2, 12), entry(2024, 3, 7.36)]
const gap = (year, quarter, reason = 'insufficient_history') => entry(year, quarter, null, reason)
assert.equal(semiannualWindowNote(gap(2024, 1), quarterly, codes), '2023 年只申報半年報，這一季的近四季算不出來（單季看得到）')
assert.equal(semiannualWindowNote(gap(2024, 3), quarterly, codes), '2023 年只申報半年報，這一季的近四季算不出來（單季看得到）')
// 單季也沒有就不說看得到
assert.equal(semiannualWindowNote(gap(2024, 1), quarterly.slice(0, 2), codes), '2023 年只申報半年報，這一季的近四季算不出來')
// 有值、別的原因、第二四季（半年報算得出來）、前一年是季報、只空一項：都不寫
assert.equal(semiannualWindowNote(entry(2024, 2, 31.87), quarterly, codes), undefined)
assert.equal(semiannualWindowNote(gap(2024, 1, 'zero_or_negative_denominator'), quarterly, codes), undefined)
assert.equal(semiannualWindowNote(gap(2024, 2), quarterly, codes), undefined)
assert.equal(semiannualWindowNote(gap(2025, 1), quarterly, codes), undefined)
assert.equal(semiannualWindowNote({ ...gap(2024, 1), values: { ...gap(2024, 1).values, roe: { value: 25, nullReason: null } } }, quarterly, codes), undefined)

// 數據中台的原因碼 semiannual_window（11-12 起）：同一句；11/21 重算前跟 insufficient_history 混著也一樣
assert.equal(semiannualWindowNote(gap(2024, 1, 'semiannual_window'), quarterly, codes), '2023 年只申報半年報，這一季的近四季算不出來（單季看得到）')
assert.equal(semiannualWindowNote({ ...gap(2024, 3), values: { ...gap(2024, 3).values, roe: { value: null, nullReason: 'semiannual_window' } } }, quarterly, codes), '2023 年只申報半年報，這一季的近四季算不出來（單季看得到）')
// 有一支是新原因碼、另一支是別的原因（例如只看資產負債表的那支）：整期都沒值，照樣寫；全是別的原因就不寫
assert.equal(semiannualWindowNote({ ...gap(2024, 1, 'semiannual_window'), values: { ...gap(2024, 1, 'semiannual_window').values, netProfitMargin: { value: null, nullReason: 'missing_input' } } }, quarterly, codes), '2023 年只申報半年報，這一季的近四季算不出來（單季看得到）')
assert.equal(semiannualWindowNote(gap(2024, 1, 'missing_input'), quarterly, codes), undefined)
// 單季序列只有一支標了（另一支是資產負債表類、照樣有值）也認得出年份
const oneMarked = [{ fiscalYear: 2023, fiscalQuarter: 2, values: { roe: { value: null, nullReason: 'semiannual_only' }, netProfitMargin: { value: 1.4, nullReason: null } } }, { fiscalYear: 2023, fiscalQuarter: 4, values: { roe: { value: null, nullReason: 'semiannual_only' }, netProfitMargin: { value: 1.5, nullReason: null } } }]
assert.equal(semiannualWindowNote(gap(2024, 1), oneMarked, codes), '2023 年只申報半年報，這一季的近四季算不出來')
// 單季序列看不到前一年（例如序列太短）：原因碼照樣寫，只是沒有年份
assert.equal(semiannualWindowNote(gap(2024, 1, 'semiannual_window'), [], codes), NULL_REASON_LABELS.semiannual_window)
assert.equal(semiannualWindowNote(gap(2024, 1), [], codes), undefined)
// 年中掛牌：2023 只有上半年是半年報（第三季起季報）→ 第一季寫上半年；第三季的近四季只用到下半年，不是這個原因
const midYear = [entry(2023, 2, null, 'semiannual_only'), entry(2023, 3, 5), entry(2023, 4, 6), entry(2024, 1, 4), entry(2024, 3, 7)]
assert.equal(semiannualWindowNote(gap(2024, 1, 'semiannual_window'), midYear, codes), '2023 年上半年只申報半年報，這一季的近四季算不出來（單季看得到）')
assert.equal(semiannualWindowNote(gap(2024, 3), midYear, codes), undefined)
// 這一期算不出來，不是不適用（semiannual_only 才是不適用）
assert.equal(nullReasonShortText('semiannual_window'), '無法計算')
assert.equal(nullReasonShortText('semiannual_only'), '不適用')

const has = value => value !== null
assert.deepEqual(trimEmptyEnds([null, 1, null, 2, null], has), [1, null, 2])
assert.deepEqual(trimEmptyEnds([null, null], has), [])
// 篩選結果的格子：幾年期的指標歷史不夠長寫「未滿 N 年」，年數從期別開頭或指標代碼結尾讀；其他原因、讀不出年數的不改（照舊「－」）
assert.equal(windowShortfallText('roeWeighted5y.FY', 'insufficient_history'), '未滿 5 年')
assert.equal(windowShortfallText('beta.5Y_1M', 'insufficient_history'), '未滿 5 年')
assert.equal(windowShortfallText('peRatioRiverBand.3Y_1D', 'insufficient_history'), '未滿 3 年')
assert.equal(windowShortfallText('holdingDividendGrowthRate3y.EOD', 'insufficient_history'), '未滿 3 年')
assert.equal(windowShortfallText('epsCagr5y.FY', 'zero_or_negative_denominator'), null)
assert.equal(windowShortfallText('roe.TTM', 'insufficient_history'), null)
console.log('check-null-reason: ok')
