// 注意與處置股票頁（app/utils/market-alerts.ts）：還沒結束的處置、處置中與將處置的順序、注意股票的筆數說法
// Run: node scripts/check-market-alerts.mjs
import assert from 'node:assert/strict'
import { attentionAnswer, dispositionAnswer, liveDispositions } from '../app/utils/market-alerts.ts'

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

const attention = (symbol, tradeDate) => ({ symbol, companyName: null, market: 'otc', tradeDate, reason: '', close: null, sixDayChangePct: null })
assert.equal(attentionAnswer([attention('1528', '2026-11-23'), attention('4722', '2026-11-23'), attention('1809', '2026-11-20')]), '2026-11-23 有 2 檔被列為注意股票。')
// 最近一天占滿 50 筆：可能還有沒列到的
assert.equal(attentionAnswer(Array.from({ length: 50 }, (_, index) => attention(String(1000 + index), '2026-11-23'))), '2026-11-23 至少有 50 檔被列為注意股票。')
assert.equal(attentionAnswer([]), '最近沒有注意股票。')
console.log('PASS: market alerts')
