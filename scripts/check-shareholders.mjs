// 股權分散表（app/utils/holders-text.ts 的 holderTypeGroups／holderTypeAnswer）與內部人申報轉讓（app/utils/insider-transfers.ts）
// Run: node scripts/check-shareholders.mjs
import assert from 'node:assert/strict'
import { foldSmallLayers } from '../shared/utils/metric-composition.ts'
import { holdingChangeText, insiderTransferAnswer, insiderTransferGroups, lotsText, transferMethodText, transferPeriodText, untransferredText } from '../app/utils/insider-transfers.ts'

// holders-text.ts 用 Nuxt 自動匯入的 foldSmallLayers（同 check-http-error.mjs 頂替 Nitro 的自動匯入）
Object.assign(globalThis, { foldSmallLayers })
const { holderTypeAnswer, holderTypeGroups } = await import('../app/utils/holders-text.ts')

// 2330 2026-04-06 的 11 類（DEV 實測）：圖合成 7 組，外國自然人 0.6%、庫藏股 0% 併進其他（不到 2%）
const category = (code, sharesPct) => ({ category: code, holderCount: 1, shares: 1, sharesPct })
const tsmc = {
  symbol: '2330',
  dataDate: '2026-04-06',
  categories: [category('government_agency', 6.39), category('domestic_financial_institution', 2.12), category('domestic_securities_trust_fund', 3.11), category('domestic_corporate', 1.18),
    category('domestic_other_juristic', 3.32), category('foreign_financial_institution', 4.32), category('foreign_juristic', 54.04), category('foreign_securities_trust_fund', 11.82),
    category('domestic_individual', 13.1), category('foreign_individual', 0.6), category('treasury_stock', 0)],
  directorsAndMajorShareholders: { holderCount: 38, shares: 1, sharesPct: 6.61 }
}
const groups = holderTypeGroups(tsmc)
assert.deepEqual(groups.map(group => `${group.name} ${group.pct.toFixed(2)}`), ['外國法人與基金 70.18', '本國自然人 13.10', '政府機構 6.39', '本國金融機構與投信基金 5.23', '本國公司與其他法人 4.50', '其他（含外國自然人） 0.60'])
assert.equal(groups.at(-1).base, '其他')
assert.equal(holderTypeAnswer(tsmc), '2026-04-06 的股東名簿上，外國法人與基金持有 70.18%，本國自然人 13.10%。')
// 沒有表（在名單但空的）：不畫
assert.deepEqual(holderTypeGroups({ ...tsmc, dataDate: null, categories: [] }), [])
assert.equal(holderTypeAnswer({ ...tsmc, dataDate: null, categories: [] }), null)

// 1540 的兩位申報人（DEV 實測）：贈與寫幾人、不寫是誰；轉讓後只剩 36 股寫不到 1 張
const shares = own => ({ own, trust: 0 })
const gift = (role, count, planned, before, after) => ({ generatedDate: '2026-11-20', declarantRole: role, transferMethod: '贈與', transfereeCount: count, plannedTransferShares: shares(planned), sharesBefore: shares(before), sharesAfter: shares(after), transferStartDate: '2026-11-20', transferEndDate: '2026-11-22', untransferred: null })
const director = gift('董事本人', 5, 954000, 1153171, 199171)
const spouse = gift('董事配偶', 3, 693000, 693036, 36)
assert.equal(transferMethodText(director), '贈與（5 人）')
assert.equal(lotsText(954000), '954 張')
assert.equal(holdingChangeText(director), '1,153 → 199 張')
assert.equal(holdingChangeText(spouse), '693 張 → 不到 1 張')
assert.equal(transferPeriodText(director), '11/20～11/22')
assert.equal(insiderTransferAnswer([director, spouse], 85_354_000), '11/20 有 2 位內部人申報轉讓，合計 1,647 張，占普通股 1.93%；轉讓期間到 11/22。')
assert.equal(insiderTransferAnswer([director, spouse], null), '11/20 有 2 位內部人申報轉讓，合計 1,647 張；轉讓期間到 11/22。')
assert.equal(insiderTransferAnswer([], 1), null)
// 大型股的一筆常常不到 0.01%（2890 的 150 張）：不寫 0.00%
assert.equal(insiderTransferAnswer([gift('子公司法人董事代表人本人', 0, 150000, 2782930, 2632930)], 12_000_000_000), '11/20 有 1 位內部人申報轉讓，合計 150 張，占普通股不到 0.01%；轉讓期間到 11/22。')

// 2890：一般交易換成短的寫法、沒有受讓人不寫人數；跨年的期間帶年份；分組照出表日、新到舊
const daily = { ...gift('子公司經理人本人', 0, 235567, 235567, 0), generatedDate: '2026-10-20', transferMethod: '一般交易(每日得轉讓股數限制)', transferStartDate: '2026-12-23', transferEndDate: '2027-01-22' }
assert.equal(transferMethodText(daily), '一般交易（每日有上限）')
assert.equal(transferPeriodText(daily), '2026/12/23～2027/1/22')
assert.deepEqual(insiderTransferGroups([director, spouse, daily]).map(group => `${group.day}:${group.items.length}`), ['2026-11-20:2', '2026-10-20:1'])
// 期滿沒轉讓：那一列底下寫一句
assert.equal(untransferredText({ ...director, untransferred: { reason: '股價因素', ownShares: 954000, trustShares: 0 } }), '期間內沒有轉讓 954 張：股價因素。')
assert.equal(untransferredText(director), null)

console.log('check-shareholders: ok')
