// 現金增資頁的文字（app/utils/capital-increases.ts）：答句、分組、格子。Run: node scripts/check-capital-increases.mjs
import assert from 'node:assert/strict'
import { dayText, leadText, payingAnswer, payingGroups, periodParts, periodText, priceText, publicSubscriptionAnswer, ratioText, stockCapitalIncreaseLine, upcomingAnswer } from '../app/utils/capital-increases.ts'

const up = (symbol, companyName, exRightsDate, stockHoldingRatio, subscriptionPricePerShare) => ({ symbol, companyName, exRightsDate, stockHoldingRatio, subscriptionPricePerShare })
const upcoming = [up('3706', '神達', '2026-11-27', 65.75641004, 52), up('6160', '欣技', '2026-12-03', 120.45708866, null), up('6596', '寬宏藝術', null, 100, null)]
assert.equal(upcomingAnswer(upcoming), '3 家：神達 11/27 最近，每仟股認購 65.7564 股、認購價 52 元；2 家還沒定價、1 家還沒公告除權日。')
assert.equal(upcomingAnswer([]), '目前沒有已公告、還沒除權的現金增資。')
// 每一家都還沒公告除權日：不寫「最近」
assert.equal(upcomingAnswer([up('6596', null, null, null, null)]), '1 家；1 家還沒定價、1 家還沒公告除權日。')

const pay = (symbol, companyName, start, end, paymentPhase) => ({ ...up(symbol, companyName, '2026-11-12', 91.888, 30), subscriptionPaymentStartDate: start, subscriptionPaymentEndDate: end, paymentPhase, paymentPeriodNullReason: paymentPhase === 'unknown' ? 'not_announced' : null })
const paying = [pay('2414', '精技', '2026-11-21', '2026-11-28', 'in_progress'), pay('6595', '光禹國際', '2026-11-25', '2026-12-02', 'in_progress'), pay('5475', '德宏', '2026-12-01', '2026-12-05', 'not_started'), pay('7731', null, null, null, 'unknown')]
assert.equal(payingAnswer(paying), '2 家正在繳款，最早截止的是精技 11/28；另外 1 家還沒開始繳；1 家繳款期間還沒公告。')
assert.deepEqual(payingGroups(paying).map(group => [group.label, group.rows.length]), [['繳款中', 2], ['還沒開始繳', 1], ['繳款期間還沒公告', 1]])
assert.deepEqual(payingGroups([paying[2]]).map(group => group.label), ['還沒開始繳'], '沒有的組不畫')
assert.equal(payingAnswer([]), '目前沒有已除權、還在繳款期間的現金增資。')

const ipo = { symbol: '7889', companyName: '範例甲', market: 'sii', publicSubscriptionStartDate: '2026-12-01', publicSubscriptionEndDate: '2026-12-03', underwritingPrice: 88, underwritingPriceStatus: 'provisional' }
assert.equal(publicSubscriptionAnswer([ipo]), '1 家：範例甲 12/1～12/3 公開申購，暫定承銷價 88 元。')
assert.equal(publicSubscriptionAnswer([{ ...ipo, underwritingPriceStatus: 'final' }]), '1 家：範例甲 12/1～12/3 公開申購，承銷價 88 元。')
assert.equal(publicSubscriptionAnswer([]), '目前沒有正在公開申購的初次上市櫃公司。')

assert.equal(leadText({ upcoming, paying, publicSubscriptions: [] }), '接下來 3 家公司現金增資除權，最近的是神達 11/27；已除權的有 2 家正在繳款。')
assert.equal(leadText({ upcoming: [], paying: [], publicSubscriptions: [] }), '目前沒有已公告、還沒除權的現金增資。')

// 個股配息頁那一行：還沒除權寫除權日，已除權寫繳款期間，沒有就不畫
const data = { upcoming, paying, publicSubscriptions: [] }
assert.equal(stockCapitalIncreaseLine(data, '3706'), '11/27 現金增資除權')
assert.equal(stockCapitalIncreaseLine(data, '6596'), '辦理現金增資，除權日還沒公告')
assert.equal(stockCapitalIncreaseLine(data, '2414'), '現金增資繳款 11/21～11/28')
assert.equal(stockCapitalIncreaseLine(data, '7731'), '現金增資已除權，繳款期間還沒公告')
assert.equal(stockCapitalIncreaseLine(data, '2330'), null)

// 格子：每仟股最多 4 位小數、0 與沒有是「－」；認購價沒有是「待定價」；日期沒有是「還沒公告」
assert.equal(ratioText({ stockHoldingRatio: 120.45708866 }), '120.4571')
assert.equal(ratioText({ stockHoldingRatio: 0 }), '－')
assert.equal(priceText(null), '待定價')
assert.equal(priceText(35.15), '35.15')
assert.equal(dayText(null), '還沒公告')
assert.equal(periodText('2026-11-21', '2026-11-28'), '11/21～11/28')
assert.equal(periodText(null, '2026-11-28'), '還沒公告')
assert.deepEqual(periodParts('2026-11-25', '2026-12-01'), ['11/25～', '12/1'], '折行只在「～」後面')
assert.deepEqual(periodParts(null, null), ['還沒公告'])

console.log('PASS: capital increases')
