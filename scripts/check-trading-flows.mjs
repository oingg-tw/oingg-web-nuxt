// 信用交易與三大法人：每天併成每月（shared/utils/trading-flows.ts）與答句（app/utils/trading-flows-text.ts）
// Run: node scripts/check-trading-flows.mjs
import assert from 'node:assert/strict'
import { groupThousands } from '../shared/utils/number-format.ts'
import { institutionalMonths, marginMonths } from '../shared/utils/trading-flows.ts'

Object.assign(globalThis, { groupThousands })
const { institutionalAnswer, marginAnswer, marginStatusText, netBuyText, shortAnswer, signedLots } = await import('../app/utils/trading-flows-text.ts')

// 每月一列是月底那一天；順序亂的也照日期排
const day = (tradeDate, marginBalanceLots, marginUtilizationRate) => ({ tradeDate, marginBalanceLots, marginLimitLots: 100000, marginUtilizationRate, shortBalanceLots: 50, shortToMarginRatio: 0.17, sblShortBalanceLots: null })
const months = marginMonths([day('2026-11-23', 30970, 0.48), day('2026-10-31', 28000, 0.43), day('2026-10-02', 25000, 0.39), day('2026-11-03', 29000, 0.45)])
assert.deepEqual(months.map(month => `${month.month} ${month.tradeDate} ${month.marginBalanceLots}`), ['2026-10 2026-10-31 28000', '2026-11 2026-11-23 30970'])

const ok = { latest: { tradeDate: '2026-11-23', isMarginSuspended: false, isShortSuspended: false } }
assert.equal(marginAnswer(months.at(-1), ok, '台積電'), '2026-11-23 融資餘額 30,970 張，融資使用率 0.48%。')
assert.equal(shortAnswer(months.at(-1), '台積電'), '2026-11-23 融券餘額 50 張，券資比 0.17%。')
// 不在名單上（興櫃、或被取消信用交易）；暫停融券
assert.equal(marginAnswer(undefined, { latest: null }, '甲'), '甲目前不能信用交易（不在融資融券的名單上）。')
assert.equal(marginStatusText({ latest: { ...ok.latest, isShortSuspended: true } }, '甲'), '甲目前暫停融券（2026-11-23）。')
assert.equal(marginAnswer({ ...months.at(-1), marginUtilizationRate: null }, { latest: { ...ok.latest, isMarginSuspended: true, isShortSuspended: true } }, '甲'), '2026-11-23 融資餘額 30,970 張。甲目前暫停融資與融券（2026-11-23）。')

// 三大法人：每月加總，整個月沒有值是 null；張四捨五入、負數寫賣超
const trade = (tradeDate, foreign, trust, dealer) => ({ tradeDate, foreignNetBuyLots: foreign, investmentTrustNetBuyLots: trust, dealerNetBuyLots: dealer, totalNetBuyLots: foreign === null ? null : foreign + trust + dealer })
const flows = institutionalMonths([trade('2026-11-23', 371.137, -324.4, -959.867), trade('2026-11-20', 0.1, 0.2, null), trade('2026-10-30', null, 1, 2)])
assert.deepEqual(flows.map(month => [month.month, month.foreignNetBuyLots, month.investmentTrustNetBuyLots, month.dealerNetBuyLots]), [['2026-10', null, 1, 2], ['2026-11', 371.237, -324.2, -959.867]])
assert.equal(institutionalAnswer(trade('2026-11-23', 371.137, -324.4, -959.867), '凌通'), '2026-11-23 三大法人合計賣超 913 張：外資買超 371 張、投信賣超 324 張、自營商賣超 960 張。')
assert.equal(netBuyText(0.4), '買賣相抵')
assert.equal(netBuyText(null), '沒有資料')
assert.equal(netBuyText(-1234.5), '賣超 1,235 張')
assert.equal(institutionalAnswer(undefined, '凌通'), '目前沒有凌通的三大法人買賣超資料。')
assert.equal(signedLots(-959.867), '−960')
assert.equal(signedLots(371.137), '+371')
assert.equal(signedLots(-0.4), '0')
assert.equal(signedLots(null), '－')
console.log('PASS: trading flows')
