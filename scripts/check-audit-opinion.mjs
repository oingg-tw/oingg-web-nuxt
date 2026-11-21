// 會計師示警（app/utils/audit-opinion.ts）：摘要卡那一句、基本資料頁的答句與只列示警的那幾期
// Run: node scripts/check-audit-opinion.mjs
import assert from 'node:assert/strict'
import { auditAnswer, auditorWarningText, auditPeriodLabel, auditReportLabel, isAuditWarning } from '../app/utils/audit-opinion.ts'

const entry = (fiscalYear, fiscalQuarter, reportKind, opinion) => ({ fiscalYear, fiscalQuarter, reportKind, opinion, accountants: [], reviewAuditDate: null })
// 2314 的樣子：2025 年報與 2026 Q3 核閱都是繼續經營疑慮，中間兩季的保留結論不算
const goingConcern = {
  symbol: '2314',
  auditorWarning: 'going_concern_uncertainty',
  entries: [entry(2026, 3, 'review', 'going_concern_uncertainty'), entry(2026, 2, 'review', 'qualified'), entry(2026, 1, 'review', 'qualified'), entry(2025, 4, 'audit', 'going_concern_uncertainty'), entry(2024, 4, 'audit', 'unqualified')]
}
assert.equal(auditorWarningText(goingConcern), '會計師：繼續經營有重大不確定性（2026 Q3）')
assert.equal(auditAnswer(goingConcern), '有：2026 Q3 的核閱報告寫了「繼續經營有重大不確定性」，2024 年以來共 2 期。')
assert.deepEqual(goingConcern.entries.filter(isAuditWarning).map(auditPeriodLabel), ['2026 Q3', '2025 年報'])
assert.deepEqual(goingConcern.entries.filter(isAuditWarning).map(auditReportLabel), ['季報核閱', '年度查核'])

// 年報保留意見：期別寫年報；季報的保留結論不算
const qualified = { symbol: '9999', auditorWarning: 'annual_qualified_opinion', entries: [entry(2026, 1, 'review', 'qualified'), entry(2025, 4, 'audit', 'qualified')] }
assert.equal(auditorWarningText(qualified), '會計師：保留意見（2025 年報）')
assert.equal(auditAnswer(qualified), '有：2025 年報寫了「保留意見」。')

// 沒有示警：摘要卡不寫、答句說幾年以來都沒有
const clean = { symbol: '2330', auditorWarning: 'none', entries: [entry(2026, 3, 'review', 'unqualified'), entry(2021, 4, 'audit', 'unqualified_with_emphasis')] }
assert.equal(auditorWarningText(clean), null)
assert.equal(auditAnswer(clean), '沒有：2021 年以來的財報都沒有繼續經營疑慮、無法表示意見或年報保留意見。')

// 過去有、最近一期沒有：摘要卡不寫，答句兩件事都說
const past = { symbol: '8888', auditorWarning: 'none', entries: [entry(2026, 3, 'review', 'unqualified'), entry(2023, 3, 'review', 'disclaimer_of_opinion'), entry(2022, 4, 'audit', 'unqualified')] }
assert.equal(auditorWarningText(past), null)
assert.equal(auditAnswer(past), '最近一期沒有；2023 Q3 的核閱報告曾寫「無法作成結論」。')

// 核閱報告的無法表示意見叫無法作成結論（8084 的 2026 Q3）
const disclaimer = { symbol: '8084', auditorWarning: 'disclaimer_of_opinion', entries: [entry(2026, 3, 'review', 'disclaimer_of_opinion'), entry(2026, 2, 'review', 'qualified'), entry(2025, 4, 'audit', 'unqualified_with_emphasis')] }
assert.equal(auditorWarningText(disclaimer), '會計師：無法作成結論（2026 Q3）')
assert.equal(auditAnswer(disclaimer), '有：2026 Q3 的核閱報告寫了「無法作成結論」。')

// 讀不到的意見（null）：「X 年以來」從讀得到的整年算起（1101 的 2017 Q3 讀不到 → 2018 年以來；2314 的 2015 年整年讀不到 → 2016 年以來）
const gap = (quarter, year) => ({ symbol: '1101', auditorWarning: 'none', entries: [entry(2026, 3, 'review', 'qualified'), entry(year, 4, 'audit', 'unqualified'), entry(year, quarter, 'review', null), entry(2013, 1, 'review', 'qualified')] })
assert.equal(auditAnswer(gap(3, 2017)), '沒有：2018 年以來的財報都沒有繼續經營疑慮、無法表示意見或年報保留意見。')
const fullYearUnknown = { symbol: '2314', auditorWarning: 'none', entries: [entry(2026, 3, 'review', 'unqualified'), entry(2016, 1, 'review', 'unqualified'), entry(2015, 4, 'audit', null), entry(2014, 4, 'audit', 'unqualified')] }
assert.equal(auditAnswer(fullYearUnknown), '沒有：2016 年以來的財報都沒有繼續經營疑慮、無法表示意見或年報保留意見。')

// 一期意見都沒有（null）、查不到（404 → null）：兩處都不寫
assert.equal(auditorWarningText({ symbol: '7777', auditorWarning: null, entries: [] }), null)
assert.equal(auditAnswer({ symbol: '7777', auditorWarning: null, entries: [] }), null)
assert.equal(auditorWarningText(null), null)
assert.equal(auditAnswer(null), null)

console.log('check-audit-opinion: ok')
