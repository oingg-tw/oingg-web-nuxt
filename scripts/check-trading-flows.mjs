// 信用交易與三大法人：每天併成每月（shared/utils/trading-flows.ts）與答句（app/utils/trading-flows-text.ts）
// Run: node scripts/check-trading-flows.mjs
import assert from 'node:assert/strict'
import { groupThousands } from '../shared/utils/number-format.ts'
import { institutionalMonths, liveSuspensions, marginMonths } from '../shared/utils/trading-flows.ts'
import { monthDay } from '../app/utils/dividend-event.ts'

Object.assign(globalThis, { groupThousands, liveSuspensions, monthDay })
const { institutionalAnswer, marginAnswer, marginStatusText, netBuyText, sblLimitAnswer, shortAnswer, signedLots, suspensionNoticeText } = await import('../app/utils/trading-flows-text.ts')

// 每月一列是月底那一天；順序亂的也照日期排
const day = (tradeDate, marginBalanceLots, marginUtilizationRate) => ({ tradeDate, marginBalanceLots, marginLimitLots: 100000, marginUtilizationRate, shortBalanceLots: 50, shortToMarginRatio: 0.17, sblShortBalanceLots: null, sblShortAvailableLots: null })
const months = marginMonths([day('2026-11-23', 30970, 0.48), day('2026-10-31', 28000, 0.43), day('2026-10-02', 25000, 0.39), day('2026-11-03', 29000, 0.45)])
assert.deepEqual(months.map(month => `${month.month} ${month.tradeDate} ${month.marginBalanceLots}`), ['2026-10 2026-10-31 28000', '2026-11 2026-11-23 30970'])

const ok = { latest: { tradeDate: '2026-11-23', isMarginSuspended: false, isShortSuspended: false } }
assert.equal(marginAnswer(months.at(-1), ok, '台積電'), '2026-11-23 融資餘額 30,970 張，融資使用率 0.48%。')
assert.equal(shortAnswer(months.at(-1), '台積電'), '2026-11-23 融券餘額 50 張，券資比 0.17%。')
// 不在名單上（興櫃、或被取消信用交易）；暫停融券
assert.equal(marginAnswer(undefined, { latest: null }, '甲'), '甲目前不能信用交易（不在融資融券的名單上）。')
assert.equal(marginStatusText({ latest: { ...ok.latest, isShortSuspended: true } }, '甲'), '甲目前暫停融券（2026-11-23）。')
assert.equal(marginAnswer({ ...months.at(-1), marginUtilizationRate: null }, { latest: { ...ok.latest, isMarginSuspended: true, isShortSuspended: true } }, '甲'), '2026-11-23 融資餘額 30,970 張。甲目前暫停融資與融券（2026-11-23）。')

// 借券賣出上限：寫那一天的日期；張四捨五入，不到 1 張不寫成 0 張（0 是不能借券賣出）；沒有上限（收集之前、業務中台還沒轉發）不答
const capped = cap => ({ ...months.at(-1), sblShortAvailableLots: cap })
assert.equal(sblLimitAnswer(capped(428.771)), '2026-11-23 借券賣出的上限是 429 張。')
assert.equal(sblLimitAnswer(capped(1146.2)), '2026-11-23 借券賣出的上限是 1,146 張。')
assert.equal(sblLimitAnswer(capped(0.6)), '2026-11-23 借券賣出的上限不到 1 張。')
assert.equal(sblLimitAnswer(capped(0)), '2026-11-23 借券賣出的上限是 0 張。')
assert.equal(sblLimitAnswer(capped(null)), '')
assert.equal(sblLimitAnswer({ ...months.at(-1), sblShortAvailableLots: undefined }), '')
assert.equal(sblLimitAnswer(undefined), '')

// 停資停券預告（數據中台 2026-11-28 給的三個例子）：是預告不是實際狀態，沒有預告什麼都不寫
const notice = (suspensionType, startDate, endDate, reason = null, lastSeenDate = '2026-11-27') => ({ suspensionType, reason, startDate, endDate, lastSeenDate })
const preview = (suspensions, today = '2026-11-28') => suspensionNoticeText({ suspensions, suspensionsAsOf: '2026-11-27' }, today)
// 6141：減資停資停券各一列、沒寫迄日、還在最新一份預告表上 → 併成一段，帶年份
assert.equal(preview([notice('margin', '2026-12-04', null, '減資'), notice('short', '2026-12-04', null, '減資')]), '交易所預告 2026/12/4 起暫停融資與融券（減資）。')
// 1516：同樣沒寫迄日，但最後出現在 10-12、早就不在預告表上 → 不寫
assert.equal(preview([notice('margin', '2026-09-28', null, '減資', '2026-10-12'), notice('short', '2026-09-28', null, '減資', '2026-10-12')]), '')
// 6488（上櫃）：只停券、沒有原因 → 不加括號
assert.equal(preview([notice('short', '2026-12-22', '2026-12-28')]), '交易所預告 12/22～12/28 暫停融券。')
// 迄日當天還算，隔天就不寫；有迄日的不看還在不在預告表上（開始之後交易所可能就不再列）
const agm = [notice('short', '2026-11-20', '2026-11-28', '股東常會', '2026-11-19')]
assert.equal(preview(agm), '交易所預告 11/20～11/28 暫停融券（股東常會）。')
assert.equal(preview(agm, '2026-11-29'), '')
// 同一段兩個原因併在一起、重複的原因只寫一次；好幾段照起日排；只有一天不寫「～」；跨年兩端都帶年份
assert.equal(
  preview([notice('short', '2026-12-28', '2027-01-04', '除息'), notice('short', '2026-12-10', '2026-12-10', '股東臨時會'), notice('short', '2026-12-01', '2026-12-05', '分配收益'), notice('short', '2026-12-01', '2026-12-05', '受益人大會 '), notice('short', '2026-12-01', '2026-12-05', '分配收益')]),
  '交易所預告 12/1～12/5 暫停融券（分配收益、受益人大會）；12/10 暫停融券（股東臨時會）；2026/12/28～2027/1/4 暫停融券（除息）。'
)
// 不認得的種類不寫；業務中台還沒轉發、快取裡的舊資料沒有這兩個鍵也不壞
assert.equal(preview([notice('other', '2026-12-01', '2026-12-05', '減資')]), '')
assert.equal(suspensionNoticeText({}, '2026-11-28'), '')
// 伺服器先篩：拿最新一份預告表的日期當「今天」，結束在那之前的、不在表上的都不留
assert.deepEqual(liveSuspensions([notice('short', '2026-11-01', '2026-11-26'), notice('short', '2026-11-20', '2026-11-27'), notice('margin', '2026-09-28', null, '減資', '2026-10-12'), notice('margin', '2026-12-04', null)], '2026-11-27', '2026-11-27').map(item => item.startDate), ['2026-11-20', '2026-12-04'])

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
