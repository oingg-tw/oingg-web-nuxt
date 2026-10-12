// 資產負債表組成（資產／負債／淨值）的自我檢查（shared/utils/balance-composition.ts）。樣本是 2330 115Q2 的資產負債表（2026-10-12 上游原值，千元），
// 期望值是 analysis-ts 同一期的占比（兩位小數）。分組改壞了，這裡的占比會對不上。
//   node scripts/check-balance-composition.mjs
import assert from 'node:assert/strict'
import { assetCompositionOf, debtCompositionOf, equityCompositionOf } from '../shared/utils/balance-composition.ts'

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
// 負債：2330 115Q2（上游原值，千元）。應付票據及帳款＝對供應商＋對關係人，analysis-ts 的占比 1.18%
const debtStatement = {
  ...tsmc, liabilities: '2901183746', current_liabilities: '1857761825', noncurrent_liabilities: '1043421921',
  trade_and_other_current_payables_to_trade_suppliers: '108890080', trade_and_other_current_payables_to_related_parties: '1735737',
  longterm_liabilities_current_portion: '167409865', longterm_borrowings: '49226958', noncurrent_portion_of_noncurrent_bonds_issued: '815036716',
  noncurrent_lease_liabilities: '33276056'
}
const debt = debtCompositionOf(debtStatement)
assert.ok(debt)
assert.equal(pct(debt.parts.accountsPayable), 1.18)
assert.equal(sum(debt.parts), debt.liabilities)
assert.equal(debtCompositionOf({ liabilities: '100', current_liabilities: null, noncurrent_liabilities: null }), null)
// 淨值：2330 115Q2 五項加起來精確等於歸屬母公司權益
const equity = equityCompositionOf({ equity_attributable_to_owners_of_parent: '6432518334', issued_capital: '259323701', capital_reserve: '72290839', retained_earnings: '6051113099', other_equity_interest: '49790695', treasury_shares: null })
assert.ok(equity)
assert.equal(sum(equity.parts), equity.equity)
assert.equal(equityCompositionOf({ equity_attributable_to_owners_of_parent: '100', issued_capital: '10' }), null)
console.log('balance composition: ok')
