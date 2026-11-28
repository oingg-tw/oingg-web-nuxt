// 裁罰、違反申報規定與經營權異動（app/utils/regulatory-events.ts）：三份名單併成一張表、答句、專區連結
// Run: node scripts/check-regulatory-events.mjs
import assert from 'node:assert/strict'
import { formatMoney } from '../shared/utils/number-format.ts'

// websiteHref 在 app/utils/company-profile.ts（自動匯入）；這裡放同一條規則：只收 http、https
Object.assign(globalThis, { formatMoney, websiteHref: url => (url && /^https?:\/\/\S+$/i.test(url) ? url : undefined) })
const { hasRegulatoryCoverage, regulatoryAnswer, regulatoryRows, regulatorySince, regulatorySources } = await import('../app/utils/regulatory-events.ts')

const coverage = (from, base = 'https://mops.example') => ({
  penalties: { from, sourceUrl: `${base}/penalties` },
  disclosureViolations: { from, sourceUrl: `${base}/violations` },
  controlChanges: { from, sourceUrl: `${base}/control` }
})
const empty = { symbol: '2330', coverage: coverage('2026-10-01'), penalties: [], disclosureViolations: [], controlChanges: [] }
const penalty = (letterDate, penalizedParty, fineNtd = 240000, violatedLaw = '證券交易法第165條之3、第178條第1項第4款及第179條規定。') => ({ letterDate, penalizedParty, violatedLaw, dispositionType: 'fine', fineNtd })
const violation = (letterDate, filing, material = [], breachPenaltyNtd = 50000) => ({ letterDate, breachPenaltyNtd, filingRuleArticles: filing, materialInfoRuleArticles: material })

// 沒有紀錄：寫名單從哪天起完整，不寫「沒有」
assert.equal(regulatoryAnswer(empty, '台積電'), '2026-10-01 以來，交易所公布的名單裡查不到台積電的裁罰、違反申報規定或經營權異動。')
assert.deepEqual(regulatoryRows(empty), [])
// 三份的起日不一樣：取最晚的那天
assert.equal(regulatorySince({ ...empty, coverage: { ...empty.coverage, controlChanges: { from: '2026-11-25', sourceUrl: 'https://mops.example/control' } } }), '2026-11-25')
// 興櫃（coverage 都是 null）、讀不到：不畫這一段
const emerging = { ...empty, coverage: { penalties: null, disclosureViolations: null, controlChanges: null } }
assert.equal(hasRegulatoryCoverage(emerging), false)
assert.equal(regulatoryAnswer(emerging, '甲'), null)
assert.equal(regulatoryAnswer(null, '甲'), null)

// 一筆：寫日期與種類；受罰的不是公司要說
const one = { ...empty, penalties: [penalty('2026-11-05', 'responsible_person')] }
assert.equal(regulatoryAnswer(one, '甲'), '有 1 筆：2026-11-05 的證期局裁罰。裁罰的對象不是公司。')
assert.deepEqual(regulatoryRows(one), [{ date: '2026-11-05', kind: '證期局裁罰', amount: '24萬元', remark: '對象：公司的行為負責人。法條：證券交易法第165條之3、第178條第1項第4款及第179條規定。' }])
assert.equal(regulatoryAnswer({ ...empty, controlChanges: [{ changeDate: '2026-08-12' }] }, '甲'), '有 1 筆：2026-08-12 的經營權異動。')

// 好幾筆：新的在前，同一天照裁罰、違反申報、經營權異動；答句各寫幾筆
const many = {
  ...empty,
  penalties: [penalty('2026-11-05', 'company', 840000), penalty('2026-10-20', 'individual', null, null)],
  disclosureViolations: [violation('2026-11-05', ['4條1項16款', '4條1項20款'], ['4條1項8款']), violation('2026-10-02', [], [], null)],
  controlChanges: [{ changeDate: '2026-11-20' }]
}
assert.deepEqual(regulatoryRows(many), [
  { date: '2026-11-20', kind: '經營權異動', amount: '－', remark: '' },
  { date: '2026-11-05', kind: '證期局裁罰', amount: '84萬元', remark: '對象：公司。法條：證券交易法第165條之3、第178條第1項第4款及第179條規定。' },
  { date: '2026-11-05', kind: '違反申報規定', amount: '5萬元', remark: '法條：資訊申報作業辦法 4條1項16款、4條1項20款；重大訊息處理程序 4條1項8款。' },
  // 來源沒寫金額、沒寫法條：金額「－」，只剩對象
  { date: '2026-10-20', kind: '證期局裁罰', amount: '－', remark: '對象：個人。' },
  { date: '2026-10-02', kind: '違反申報規定', amount: '－', remark: '' }
])
const answer = regulatoryAnswer(many, '甲')
assert.equal(answer, '有 5 筆：證期局裁罰 2 筆、違反申報規定 2 筆、經營權異動 1 筆，最近一筆在 2026-11-20。其中 1 筆裁罰的對象不是公司。')
assert.ok(answer.length <= 80, `答句 ${answer.length} 字`)
// 只有一種：筆數不寫兩次；裁罰的對象全都不是公司寫「都不是」（1589 的真資料：四案都是個人，加一筆違約金）
const individuals = ['2026-10-12', '2026-09-02', '2026-05-18', '2026-04-01'].map(date => penalty(date, 'individual'))
assert.equal(regulatoryAnswer({ ...empty, penalties: individuals }, '甲'), '有 4 筆證期局裁罰，最近一筆在 2026-10-12。裁罰的對象都不是公司。')
assert.equal(regulatoryAnswer({ ...empty, penalties: individuals, disclosureViolations: [violation('2026-11-04', [], ['4條1項2款'], 30000)] }, '甲'), '有 5 筆：證期局裁罰 4 筆、違反申報規定 1 筆，最近一筆在 2026-11-04。裁罰的對象都不是公司。')
assert.equal(regulatoryAnswer({ ...empty, penalties: [penalty('2026-11-05', 'company'), ...individuals.slice(0, 2)] }, '甲'), '有 3 筆證期局裁罰，最近一筆在 2026-11-05。其中 2 筆裁罰的對象不是公司。')
assert.equal(regulatoryAnswer({ ...empty, disclosureViolations: [violation('2026-07-13', ['3條2項18款']), violation('2026-02-09', [])] }, '甲'), '有 2 筆違反申報規定，最近一筆在 2026-07-13。')
// 一筆裁罰（對象不是公司）加別種：不寫「其中 1 筆」（3360 的真資料）
assert.equal(regulatoryAnswer({ ...empty, penalties: [penalty('2026-02-26', 'responsible_person')], disclosureViolations: [violation('2026-06-25', ['3條2項18款'])] }, '甲'), '有 2 筆：證期局裁罰 1 筆、違反申報規定 1 筆，最近一筆在 2026-06-25。裁罰的對象不是公司。')
// 筆數兩位數時也在 80 字內
const dozen = { ...empty, penalties: [penalty('2026-11-05', 'company'), ...Array.from({ length: 11 }, () => penalty('2026-10-20', 'individual'))], disclosureViolations: Array.from({ length: 12 }, () => violation('2026-10-02', [])), controlChanges: Array.from({ length: 12 }, () => ({ changeDate: '2026-11-20' })) }
assert.ok(regulatoryAnswer(dozen, '甲').length <= 80, `答句 ${regulatoryAnswer(dozen, '甲').length} 字`)
// 上游之後新增的對象、處分種類：不寫對象（不能當成公司）、金額不寫成罰鍰
assert.deepEqual(regulatoryRows({ ...empty, penalties: [{ ...penalty('2026-11-05', 'director'), dispositionType: 'warning' }] })[0], { date: '2026-11-05', kind: '證期局裁罰', amount: '－', remark: '法條：證券交易法第165條之3、第178條第1項第4款及第179條規定。' })

// 專區連結：三種各一個；不是 http(s) 的網址不變成連結
assert.deepEqual(regulatorySources(empty).map(link => link.label), ['證期局裁罰', '違反申報規定', '經營權異動'])
assert.deepEqual(regulatorySources({ ...empty, coverage: { ...empty.coverage, penalties: { from: '2026-10-01', sourceUrl: 'javascript:alert(1)' } } }).map(link => link.href), ['https://mops.example/violations', 'https://mops.example/control'])
console.log('PASS: regulatory events')
