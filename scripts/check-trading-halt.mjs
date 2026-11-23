// 摘要卡的停止買賣那一句（app/utils/trading-halt.ts）。前三例是 2026-10-22 業務中台 GET /stocks 的真實資料。Run: node scripts/check-trading-halt.mjs
import assert from 'node:assert/strict'
import { delistingText, tradingHaltText, tradingStatusTexts } from '../app/utils/trading-halt.ts'

// 1516 川飛：減資換發中
assert.equal(tradingHaltText({ status: 'active', reason: 'capital_reduction', haltStartDate: '2026-10-15', haltEndDate: '2026-10-23', resumeDate: '2026-10-27' }), '停止買賣中（減資換發，10/15～10/23），預計 10/27 恢復')
// 1589 永冠-KY：處分，沒有結束日也沒有恢復日——帶年份（可能拖很久）
assert.equal(tradingHaltText({ status: 'active', reason: 'regulatory', haltStartDate: '2026-04-07', haltEndDate: null, resumeDate: null }), '停止買賣中（主管機關處分，2026/4/7 起）')
// 8291 尚茂：已公告、還沒開始
assert.equal(tradingHaltText({ status: 'upcoming', reason: 'capital_reduction', haltStartDate: '2026-11-19', haltEndDate: '2026-11-27', resumeDate: '2026-11-30' }), '將停止買賣（減資換發，11/19～11/27），預計 11/30 恢復')
// 跨年就每個日期都帶年份
assert.equal(tradingHaltText({ status: 'active', reason: 'par_value_change', haltStartDate: '2026-12-28', haltEndDate: '2027-01-05', resumeDate: '2027-01-07' }), '停止買賣中（面額變更換發，2026/12/28～2027/1/5），預計 2027/1/7 恢復')
// other 與沒見過的原因不寫原因；沒見過的狀態、沒有資料都不顯示
assert.equal(tradingHaltText({ status: 'active', reason: 'other', haltStartDate: '2026-10-15', haltEndDate: '2026-10-16', resumeDate: null }), '停止買賣中（10/15～10/16）')
assert.equal(tradingHaltText({ status: 'resumed', reason: 'capital_reduction', haltStartDate: '2026-10-15', haltEndDate: '2026-10-16', resumeDate: null }), null)
assert.equal(tradingHaltText(null), null)
assert.equal(tradingHaltText(undefined), null)

// 1589 永冠-KY：已公告下市；生效後的 90 天內寫「已於」；沒見過的狀態不顯示
assert.equal(delistingText({ status: 'announced', date: '2026-11-18' }), '已公告 11/18 下市')
assert.equal(delistingText({ status: 'effective', date: '2026-11-18' }), '已於 11/18 下市')
assert.equal(delistingText({ status: 'cancelled', date: '2026-11-18' }), null)
assert.equal(delistingText(null), null)

// 處置、可能達處置、注意股票、全額交割（數據中台 00185-jqq 的 quote，2026-11-24 實打的例子）
// 3287：三個都有，處置與可能達處置都寫，注意股票不寫（次數已經算在可能達處置裡）
assert.deepEqual(tradingStatusTexts({
  attention: { tradeDate: '2026-11-23' },
  nearDispositionThreshold: { announcedDate: '2026-11-23', clauses: [{ noticeCount: 2, windowTradingDays: null, startDate: '2026-11-20', endDate: '2026-11-23' }] },
  disposition: { status: 'active', startDate: '2026-11-20', endDate: '2026-11-26' },
  alteredTradingMethod: null
}), ['處置中（11/20～11/26）', '可能達處置標準：連續 2 次注意（11/23 公布）'])
// 2455 11-06：近 N 個營業日 M 次；一則同時符合兩條就兩條都寫
assert.deepEqual(tradingStatusTexts({ nearDispositionThreshold: { announcedDate: '2026-11-06', clauses: [{ noticeCount: 5, windowTradingDays: 9, startDate: '2026-10-27', endDate: '2026-11-06' }, { noticeCount: 3, windowTradingDays: null, startDate: '2026-11-04', endDate: '2026-11-06' }] } }), ['可能達處置標準：近 9 個營業日 5 次、連續 3 次注意（11/6 公布）'])
// 收盤後公告、明天開始的處置；跨年的區間帶年份
assert.deepEqual(tradingStatusTexts({ disposition: { status: 'upcoming', startDate: '2026-12-30', endDate: '2027-01-12' } }), ['將處置（2026/12/30～2027/1/12）'])
// 只有注意股票
assert.deepEqual(tradingStatusTexts({ attention: { tradeDate: '2026-11-23' }, disposition: null, nearDispositionThreshold: null }), ['注意股票（11/23 公布）'])
// 1213、2067：11-26 之前只有名單日期，只寫全額交割中；之後有生效日（沒有結束日，帶年份）
assert.deepEqual(tradingStatusTexts({ alteredTradingMethod: { listedDate: '2026-11-23' } }), ['全額交割中'])
assert.deepEqual(tradingStatusTexts({ alteredTradingMethod: { listedDate: '2026-11-27', startDate: '2026-11-26', status: 'active' } }), ['全額交割中（2026/11/26 起）'])
assert.deepEqual(tradingStatusTexts({ alteredTradingMethod: { listedDate: '2026-11-27', startDate: '2026-12-01', status: 'upcoming' } }), ['將全額交割（2026/12/1 起）'])
// 沒見過的狀態、空的 clauses、沒有資料都不寫
assert.deepEqual(tradingStatusTexts({ disposition: { status: 'ended', startDate: '2026-11-01', endDate: '2026-11-10' }, nearDispositionThreshold: { announcedDate: '2026-11-23', clauses: [] } }), [])
assert.deepEqual(tradingStatusTexts(null), [])

console.log('PASS: trading halt')
