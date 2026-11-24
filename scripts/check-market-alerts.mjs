// 注意與處置股票頁（app/utils/market-alerts.ts）：還沒結束的處置、處置中與將處置的順序、注意股票的筆數說法
// Run: node scripts/check-market-alerts.mjs
import assert from 'node:assert/strict'
import { attentionAnswer, dispositionAnswer, liveDispositions, mergeMarkets } from '../app/utils/market-alerts.ts'

const disposed = (symbol, start, end) => ({ symbol, companyName: symbol, market: 'sii', announcementDate: start, reason: '連續三次', dispositionStartDate: start, dispositionEndDate: end, dispositionMeasures: null })
const today = '2026-11-24'
const live = liveDispositions([
  disposed('9999', '2026-11-25', '2026-12-01'),
  disposed('3653', '2026-11-24', '2026-11-30'),
  disposed('1111', '2026-11-10', '2026-11-21'),
  disposed('2222', '2026-11-20', '2026-11-24')
], today)
// 結束日是今天的還在處置中；已經結束的不列；將處置的排最後
assert.deepEqual(live.map(item => `${item.symbol}:${item.upcoming}`), ['2222:false', '3653:false', '9999:true'])
assert.equal(dispositionAnswer(live), '目前有 2 檔處置中、1 檔即將處置。')
assert.equal(dispositionAnswer([]), '目前沒有處置中的股票。')
assert.equal(dispositionAnswer(live.slice(0, 2)), '目前有 2 檔處置中。')

const attention = (symbol, tradeDate, market = 'otc') => ({ symbol, companyName: null, market, tradeDate, reason: '', close: null, sixDayChangePct: null })
const lists = (sii, otc) => [{ market: 'sii', items: sii }, { market: 'otc', items: otc }]
assert.equal(attentionAnswer(lists([], [attention('1528', '2026-11-23'), attention('4722', '2026-11-23'), attention('1809', '2026-11-20')])), '2026-11-23 有 2 檔被列為注意股票。')
// 上市、上櫃分開讀再合併：新到舊，同一天上市在前；兩所的最近一天不同時，答句寫比較新的那一天
const siiDay = [attention('2471', '2026-11-24', 'sii'), attention('3189', '2026-11-23', 'sii')]
const otcDay = [attention('1528', '2026-11-23'), attention('1809', '2026-11-20')]
assert.deepEqual(mergeMarkets(lists(siiDay, otcDay), item => item.tradeDate).map(item => item.symbol), ['2471', '3189', '1528', '1809'])
assert.equal(attentionAnswer(lists(siiDay, otcDay)), '2026-11-24 有 1 檔被列為注意股票。')
// 上游還不認得 market：兩份都是同一份合併的清單，各留自己那一所，合起來不重複
const merged = [...siiDay, ...otcDay]
assert.equal(mergeMarkets(lists(merged, merged), item => item.tradeDate).length, 4)
// 有一份讀滿 50 筆而且全是最近那一天：可能還有沒列到的。上市讀滿、上櫃只有幾筆也算
const full = Array.from({ length: 50 }, (_, index) => attention(String(1000 + index), '2026-11-23', 'sii'))
assert.equal(attentionAnswer(lists(full, [attention('1528', '2026-11-23')])), '2026-11-23 至少有 51 檔被列為注意股票。')
// 讀滿 50 筆但最舊的一筆是前一天：最近那一天都列到了
assert.equal(attentionAnswer(lists([...full.slice(1), attention('9999', '2026-11-20', 'sii')], [])), '2026-11-23 有 49 檔被列為注意股票。')
assert.equal(attentionAnswer(lists([], [])), '最近沒有注意股票。')
console.log('PASS: market alerts')
