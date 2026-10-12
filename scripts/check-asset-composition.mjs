// 資產組成分組的自我檢查（shared/utils/asset-composition.ts）。樣本是 2330 115Q2 的資產負債表（2026-10-12 上游原值，千元），
// 期望值是 analysis-ts 同一期的占比（兩位小數）。分組改壞了，這裡的占比會對不上。
//   node scripts/check-asset-composition.mjs
import assert from 'node:assert/strict'
import { assetCompositionOf } from '../shared/utils/asset-composition.ts'

const tsmc = {
  assets: '9375654727', current_assets: '4565700742', noncurrent_assets: '4809953985',
  cash_and_cash_equivalents: '3134218213',
  current_financial_assets_at_amortised_cost: '190385845', current_financial_assets_at_fvoci: '193182690',
  current_financial_assets_at_fair_value_through_profit_or_loss: '226375', other_current_financial_assets: '80032539',
  accounts_receivable_net: '435762477', accounts_receivable_duefrom_related_parties_net: '5160539', notes_receivable_net: null,
  inventories: '385524542',
  noncurrent_financial_assets_at_amortised_cost: '105877457', noncurrent_financial_assets_at_fvoci: '88151593', noncurrent_financial_assets_at_fvtpl: '15780286',
  investment_accounted_for_using_equity_method: '18126371', property_plant_and_equipment: '4302880478',
  rightofuse_assets: '54895205', intangible_assets_and_goodwill: '24074828'
}

const result = assetCompositionOf(tsmc)
assert.ok(result)
const pct = value => Math.round((value / result.totalAssets) * 10000) / 100
// analysis-ts 的占比（同一期）
assert.equal(pct(result.current.cash), 33.43)
assert.equal(pct(result.current.financial), 4.95)
assert.equal(pct(result.current.receivables), 4.7)
assert.equal(pct(result.current.inventories), 4.11)
assert.equal(pct(result.current.other), 1.51)
assert.equal(pct(result.noncurrent.propertyPlantEquipment), 45.89)
// 各項加起來等於合計
const sum = parts => Object.values(parts).reduce((a, b) => a + b, 0)
assert.equal(sum(result.current), result.currentAssets)
assert.equal(sum(result.noncurrent), result.noncurrentAssets)
// 金融業：不分流動與非流動 → 拆不開
assert.equal(assetCompositionOf({ assets: '100', current_assets: null, noncurrent_assets: null }), null)
// 列出的科目超過合計（歸類錯）→ 不畫
assert.equal(assetCompositionOf({ ...tsmc, inventories: '9000000000' }), null)
console.log('asset composition: ok')
