// 摘要卡的停止買賣那一句（app/utils/trading-halt.ts）。前三例是 2026-10-22 業務中台 GET /stocks 的真實資料。Run: node scripts/check-trading-halt.mjs
import assert from 'node:assert/strict'
import { delistingText, tradingHaltText } from '../app/utils/trading-halt.ts'

// 1516 川飛：減資換發中
assert.equal(tradingHaltText({ status: 'active', reason: 'capital_reduction', haltFrom: '2026-10-15', haltTo: '2026-10-23', resumeOn: '2026-10-27' }), '停止買賣中（減資換發，10/15～10/23），預計 10/27 恢復')
// 1589 永冠-KY：處分，沒有結束日也沒有恢復日——帶年份（可能拖很久）
assert.equal(tradingHaltText({ status: 'active', reason: 'regulatory', haltFrom: '2026-04-07', haltTo: null, resumeOn: null }), '停止買賣中（主管機關處分，2026/4/7 起）')
// 8291 尚茂：已公告、還沒開始
assert.equal(tradingHaltText({ status: 'upcoming', reason: 'capital_reduction', haltFrom: '2026-11-19', haltTo: '2026-11-27', resumeOn: '2026-11-30' }), '將停止買賣（減資換發，11/19～11/27），預計 11/30 恢復')
// 跨年就每個日期都帶年份
assert.equal(tradingHaltText({ status: 'active', reason: 'par_value_change', haltFrom: '2026-12-28', haltTo: '2027-01-05', resumeOn: '2027-01-07' }), '停止買賣中（面額變更換發，2026/12/28～2027/1/5），預計 2027/1/7 恢復')
// other 與沒見過的原因不寫原因；沒見過的狀態、沒有資料都不顯示
assert.equal(tradingHaltText({ status: 'active', reason: 'other', haltFrom: '2026-10-15', haltTo: '2026-10-16', resumeOn: null }), '停止買賣中（10/15～10/16）')
assert.equal(tradingHaltText({ status: 'resumed', reason: 'capital_reduction', haltFrom: '2026-10-15', haltTo: '2026-10-16', resumeOn: null }), null)
assert.equal(tradingHaltText(null), null)
assert.equal(tradingHaltText(undefined), null)

// 1589 永冠-KY：已公告下市；生效後的 90 天內寫「已於」；沒見過的狀態不顯示
assert.equal(delistingText({ status: 'announced', date: '2026-11-18' }), '已公告 11/18 下市')
assert.equal(delistingText({ status: 'effective', date: '2026-11-18' }), '已於 11/18 下市')
assert.equal(delistingText({ status: 'cancelled', date: '2026-11-18' }), null)
assert.equal(delistingText(null), null)

console.log('PASS: trading halt')
