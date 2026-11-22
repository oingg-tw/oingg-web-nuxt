// 背書保證與資金貸與頁、轉投資頁（app/utils/guarantees.ts、investments.ts）：答句、排序、欄位，用本機數據中台 2026-11-23 的 9933、2330 實測值
// Run: node scripts/check-note-details.mjs
import assert from 'node:assert/strict'
import { exposureOrder, guaranteeAnswer, guaranteeLimitText, hasSeveral, interestRateText, loanAnswer, natureText, relatedPartyAnswer, relatedPartyColumns, relationshipText } from '../app/utils/guarantees.ts'
import { investeesAnswer, mainlandAnswer } from '../app/utils/investments.ts'

const money = thousand => `${(thousand / 100000).toFixed(2)}億元`
const period = { symbol: '9933', fiscalYear: 2026, fiscalQuarter: 3, equity: 26152855 }

// 背書保證：集團外 16.79%（指標的值），集團內的另外寫；沒有列的寫「財報附註沒有列出」，不寫「沒有」
const guarantees = { ...period, totals: { endingBalance: 96989133, endingBalanceToEquity: 370.85, externalEndingBalance: 4392136, externalEndingBalanceToEquity: 16.79 }, rows: [{}] }
assert.equal(guaranteeAnswer(guarantees, money), '2026 Q3 替集團外背書保證 43.92億元，占淨值 16.79%；另替集團內的公司保證 925.97億元。')
assert.equal(guaranteeAnswer({ ...guarantees, totals: { ...guarantees.totals, externalEndingBalance: 0, externalEndingBalanceToEquity: 0 } }, money), '2026 Q3 只替集團內的公司背書保證，共 969.89億元。')
assert.equal(guaranteeAnswer({ ...guarantees, rows: [] }, money), '2026 Q3 財報附註沒有列出背書保證。')
assert.equal(guaranteeAnswer({ ...guarantees, fiscalYear: null, fiscalQuarter: null }, money), null)

// 集團外（含判不出）在前、各自大到小；關係代碼照詞彙表，沒有代碼的照原文
const order = exposureOrder([
  { name: 'in-big', intraGroup: true, endingBalance: 900 }, { name: 'out-small', intraGroup: false, endingBalance: 10 },
  { name: 'unknown', intraGroup: null, endingBalance: 50 }, { name: 'out-null', intraGroup: false, endingBalance: null }
])
assert.deepEqual(order.map(row => row.name), ['unknown', 'out-small', 'out-null', 'in-big'])
assert.equal(relationshipText({ relationshipCodes: [2, 6], relationship: '2、6' }), '直接及間接持股過半、共同投資')
assert.equal(relationshipText({ relationshipCodes: [], relationship: '權益法之被投資公司' }), '權益法之被投資公司')
assert.equal(guaranteeLimitText({ limitPerCounterparty: 156917130, limitOfTotalGuarantee: 261528550 }, money), '1569.17億元／2615.29億元')
assert.equal(guaranteeLimitText({ limitPerCounterparty: null, limitOfTotalGuarantee: null }, money), '－')
assert.equal(hasSeveral(['中鼎工程(股)公司', '中鼎工程(股)公司', null]), false)
assert.equal(hasSeveral(['中鼎工程(股)公司', '崑鼎綠能環保(股)公司']), true)

// 資金貸與：分子是期末餘額（核准額度）；借給關係人的占集團外的比例
const loans = { ...period, totals: { endingBalance: 12192390, endingBalanceToEquity: 46.62, externalEndingBalance: 13878, externalEndingBalanceToEquity: 0.05, externalRelatedPartyEndingBalance: 13878, externalRelatedPartyEndingBalanceToEquity: 0.05 }, rows: [{}] }
assert.equal(loanAnswer(loans, money), '2026 Q3 對集團外的資金貸與餘額 0.14億元，占淨值 0.05%，借給關係人的占 100.00%；集團內另有 121.79億元。')
assert.equal(loanAnswer({ ...loans, totals: { ...loans.totals, externalEndingBalance: 0, externalRelatedPartyEndingBalance: 0 } }, money), '2026 Q3 只借給集團內的公司，資金貸與餘額共 121.92億元。')
assert.equal(interestRateText({ interestRateMin: 4.5, interestRateMax: 4.75 }), '4.50%～4.75%')
assert.equal(interestRateText({ interestRateMin: 2, interestRateMax: 2 }), '2.00%')
assert.equal(interestRateText({ interestRateMin: null, interestRateMax: null }), '－')
assert.equal(natureText({ natureOfLoanKind: 'shortTermFinancing' }), '短期融通')
assert.equal(natureText({ natureOfLoanKind: 'somethingNew' }), '－')

// 關係人交易：比率是指標的單季值；年報只有全年，表格改列年初至今
const related = { ...period, rows: [{ account: '銷貨', category: '關聯企業', amountQuarter: 69880, amountPriorYearQuarter: 70874, amountYtd: 214629, amountPriorYearYtd: 187266 }] }
assert.equal(relatedPartyAnswer(related, 0.95, 0.3), '2026 Q3（單季）向關係人銷貨占營收 0.95%，向關係人進貨占營業成本 0.30%。')
assert.equal(relatedPartyAnswer(related, null, null), '2026 Q3 財報附註列了 1 筆關係人交易。')
assert.deepEqual(relatedPartyColumns(related), { ytd: false, labels: ['本季', '去年同季'] })
const annual = { ...period, fiscalQuarter: 4, rows: [{ ...related.rows[0], amountQuarter: null, amountPriorYearQuarter: null }] }
assert.deepEqual(relatedPartyColumns(annual), { ytd: true, labels: ['全年', '去年全年'] })

// 大陸投資：帳面占淨值（指標）、累計匯出與核准額度用掉的比率；KY 公司沒有限額表只寫帳面
const mainland = { symbol: '2330', fiscalYear: 2026, fiscalQuarter: 3, equity: 0, totals: { bookValue: 313625534, bookValueToEquity: 4.48, accumulatedInvestment: 49461079, authorizedAmount: 119412667, authorizedUsage: 41.42 }, investees: [{}] }
assert.equal(mainlandAnswer(mainland, money), '2026 Q3 大陸投資帳面 3136.26億元，占淨值 4.48%；累計從台灣匯出 494.61億元，用掉經濟部核准額度的 41.42%。')
assert.equal(mainlandAnswer({ ...mainland, totals: { ...mainland.totals, accumulatedInvestment: null, authorizedAmount: null, authorizedUsage: null } }, money), '2026 Q3 大陸投資帳面 3136.26億元，占淨值 4.48%。')
assert.equal(mainlandAnswer({ ...mainland, investees: [] }, money), '2026 Q3 財報附註沒有列出大陸投資。')

// 轉投資：子公司與關聯企業的家數（同名算一家，數據中台算），帳面最大的那一家；所在地「其他」不寫
const investees = { ...mainland, totals: { intraGroupCount: 17, externalCount: 4, unresolvedCount: 0 }, rows: [{ investee: 'TSMC Global', location: '英屬維京群島', bookValue: 1973977528 }] }
assert.equal(investeesAnswer(investees, money), '2026 Q3 子公司 17 家、關聯企業 4 家；帳面最大的是 TSMC Global 19739.78億元，在英屬維京群島。')
assert.equal(investeesAnswer({ ...investees, totals: { intraGroupCount: 1, externalCount: 0, unresolvedCount: 2 }, rows: [{ investee: 'X', location: '其他', bookValue: 1 }] }, money), '2026 Q3 子公司 1 家、無法判斷 2 家；帳面最大的是 X 0.00億元。')

console.log('check-note-details: ok')
