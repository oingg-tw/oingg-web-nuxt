// The one runnable check for app/utils/holdings-metrics.ts, against bff-ts's synthetic fixtures in
// scripts/fixtures/holdings/ (synthetic ledger, no user data — see that folder's README). Pure, no network.
//
// Run: node scripts/check-holdings-metrics.mjs
import { readFileSync } from 'node:fs'
import { BANNED_WORDS } from '../shared/utils/compliance-words.ts'
import { COVARIANCE_MIN_DAYS, NO_RISK_FREE, TAIL_MIN_DAYS, UNDER_A_YEAR, coverageText, firstReason, holdingsMetricText, periodUnderYear, riskFreeLine, sampleShortfall } from '../app/utils/holdings-metrics.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/holdings/${name}.json`, import.meta.url), 'utf8'))

console.log('格式')
assert(holdingsMetricText('0.731248', 'signedPct', '－', 2) === '+73.12%', '報酬 +73.12%')
assert(holdingsMetricText('-0.071633', 'signedPct') === '-7.2%', '負的 α 照實寫負號')
assert(holdingsMetricText('0.000468', 'pct', '－', 2) === '0.05%', '成本率兩位小數')
assert(holdingsMetricText('-0.0000001', 'pct') === '0.0%', '四捨五入到 0 不寫成 -0.0%')
assert(holdingsMetricText('2.103793', 'ratio') === '2.10', '比值兩位小數')
assert(holdingsMetricText('9696000', 'money') === '9,696,000 元', '金額千分位')
assert(holdingsMetricText(null, 'pct', '期間未滿一年') === '期間未滿一年', 'null 顯示給定的原因')

console.log('門檻')
assert(sampleShortfall(40, COVARIANCE_MIN_DAYS) === '樣本不足（40 天，需 120 天）', '40 天不到 120')
assert(sampleShortfall(120, COVARIANCE_MIN_DAYS) === null, '剛好 120 天就夠')
assert(periodUnderYear('2026-08-10', '2026-10-07'), '兩個月不滿一年')
assert(!periodUnderYear('2025-10-07', '2026-10-07'), '剛好一年不算未滿')
assert(firstReason(null, false, 'B') === 'B' && firstReason(null) === '－', 'firstReason 取第一個成立的')

console.log('(a) 一年、全部有值')
{
  const p = fixture('a-normal-1y.performance')
  assert(riskFreeLine(p.riskFree) === '無風險利率：五大銀行一年期定存 1.70%（2026-08）', '利率日期寫 sourcePeriod（最後一個月沿用 2026-08）')
  // 範例資料重新產生時數值會變（bff-ts 用當天的市場資料），所以跟資料本身比，不寫死數字
  assert(p.riskAdjusted.sharpe !== null && holdingsMetricText(p.riskAdjusted.sharpe, 'ratio') === Number(p.riskAdjusted.sharpe).toFixed(2), 'Sharpe 有值、兩位小數')
}

console.log('(b) 40 個交易日')
{
  const p = fixture('b-short-window.performance')
  const r = fixture('b-short-window.risk')
  assert(p.annualized.twr === null && periodUnderYear(p.from, p.to), '年化是 null，原因是期間未滿一年')
  const sharpe = holdingsMetricText(p.riskAdjusted.sharpe, 'ratio', firstReason(!p.riskFree && NO_RISK_FREE, sampleShortfall(p.riskAdjusted.sampleDays, COVARIANCE_MIN_DAYS)))
  assert(sharpe.startsWith('樣本不足'), `Sharpe 寫樣本不足（得到「${sharpe}」）`)
  const tail = holdingsMetricText(r.portfolio.valueAtRisk95, 'pct', firstReason(sampleShortfall(r.tradingDays, TAIL_MIN_DAYS)))
  assert(tail === `樣本不足（${r.tradingDays} 天，需 100 天）`, `VaR 寫樣本不足（得到「${tail}」）`)
}

console.log('(c) 取不到無風險利率')
{
  const p = fixture('c-risk-free-null.performance')
  assert(riskFreeLine(p.riskFree) === null, '沒有利率那一行')
  const sharpe = holdingsMetricText(p.riskAdjusted.sharpe, 'ratio', firstReason(!p.riskFree && NO_RISK_FREE, sampleShortfall(p.riskAdjusted.sampleDays, COVARIANCE_MIN_DAYS)))
  assert(sharpe === NO_RISK_FREE, '原因是利率取不到，不是樣本不足（樣本其實夠）')
}

console.log('第二批（bff-ts 9d691cd）')
{
  const r = fixture('a-normal-1y.risk')
  assert(coverageText(r.fundamentals.peCoverage) === '涵蓋 88% 市值', '0056 沒有本益比：涵蓋 88%')
  assert(coverageText('1.000000') === null, '全部涵蓋時不寫')
  const b = fixture('b-short-window.realized')
  assert(b.tradeStats.sellCount === 0 && b.tradeStats.winRate === null, '沒有賣出的期間：統計全是 null（頁面改寫「這段期間沒有賣出」）')
}

console.log('用詞')
{
  const texts = [UNDER_A_YEAR, NO_RISK_FREE, sampleShortfall(1, 120), riskFreeLine(fixture('a-normal-1y.performance').riskFree)]
  const hit = BANNED_WORDS.filter(word => texts.some(text => text.includes(word)))
  assert(hit.length === 0, `沒有禁用詞${hit.length ? `（命中 ${hit.join('、')}）` : ''}`)
}

console.log(failures ? `\nFAIL: ${failures}` : '\nPASS: holdings metrics')
process.exit(failures ? 1 : 0)
