// 圖上的空白期別（app/utils/metric-null-reason.ts 的 semiannualWindowNote、app/utils/metric-history-points.ts 的 trimEmptyEnds）：
// 近四季跨到只申報半年報那一年時提示框寫的原因，與頭尾修掉、中間留著
// Run: node scripts/check-null-reason.mjs
import assert from 'node:assert/strict'
import { NULL_REASON_LABELS, nullReasonShortText, periodNotesText, periodNoteText, semiannualWindowNote, screenerNullText } from '../app/utils/metric-null-reason.ts'
import { trimEmptyEnds, undisclosedQuarter } from '../app/utils/metric-history-points.ts'
import { withPeriodFacts } from '../shared/utils/metrics-history.ts'

// 只在半年報揭露的資本適足率：Q1、Q3 沒有值整期拿掉，有值照留；其他指標的空季照舊是缺口
const car = (quarter, value) => ({ fiscalQuarter: quarter, values: { bankCarRatio: { value, nullReason: value === null ? 'missing_input' : null } } })
assert.equal(undisclosedQuarter('bankCarRatio', car(1, null)), true)
assert.equal(undisclosedQuarter('bankCarRatio', car(3, null)), true)
assert.equal(undisclosedQuarter('bankCarRatio', car(2, null)), false)
assert.equal(undisclosedQuarter('bankCarRatio', car(3, 14.2)), false)
assert.equal(undisclosedQuarter('roe', { fiscalQuarter: 1, values: { roe: { value: null, nullReason: 'missing_input' } } }), false)

const codes = ['roe', 'netProfitMargin']
const entry = (fiscalYear, fiscalQuarter, value, nullReason = null) => ({ fiscalYear, fiscalQuarter, values: Object.fromEntries(codes.map(code => [code, { value, nullReason }])) })
// 3158：2023 年只申報半年報（單季序列的 Q2、Q4 標 semiannual_only），2024 年起季報
const quarterly = [entry(2023, 2, null, 'semiannual_only'), entry(2023, 4, null, 'semiannual_only'), entry(2024, 1, 3.58), entry(2024, 2, 12), entry(2024, 3, 7.36)]
const gap = (year, quarter, reason = 'insufficient_history') => entry(year, quarter, null, reason)
assert.equal(semiannualWindowNote(gap(2024, 1), quarterly, codes), '2023 年只申報半年報，這一季的近四季算不出來（單季看得到）')
assert.equal(semiannualWindowNote(gap(2024, 3), quarterly, codes), '2023 年只申報半年報，這一季的近四季算不出來（單季看得到）')
// 單季也沒有就不說看得到
assert.equal(semiannualWindowNote(gap(2024, 1), quarterly.slice(0, 2), codes), '2023 年只申報半年報，這一季的近四季算不出來')
// 有值、別的原因、第二四季（半年報算得出來）、前一年是季報、只空一項：都不寫
assert.equal(semiannualWindowNote(entry(2024, 2, 31.87), quarterly, codes), undefined)
assert.equal(semiannualWindowNote(gap(2024, 1, 'zero_or_negative_denominator'), quarterly, codes), undefined)
assert.equal(semiannualWindowNote(gap(2024, 2), quarterly, codes), undefined)
assert.equal(semiannualWindowNote(gap(2025, 1), quarterly, codes), undefined)
assert.equal(semiannualWindowNote({ ...gap(2024, 1), values: { ...gap(2024, 1).values, roe: { value: 25, nullReason: null } } }, quarterly, codes), undefined)

// 數據中台的原因碼 semiannual_window（11-12 起）：同一句；11/21 重算前跟 insufficient_history 混著也一樣
assert.equal(semiannualWindowNote(gap(2024, 1, 'semiannual_window'), quarterly, codes), '2023 年只申報半年報，這一季的近四季算不出來（單季看得到）')
assert.equal(semiannualWindowNote({ ...gap(2024, 3), values: { ...gap(2024, 3).values, roe: { value: null, nullReason: 'semiannual_window' } } }, quarterly, codes), '2023 年只申報半年報，這一季的近四季算不出來（單季看得到）')
// 有一支是新原因碼、另一支是別的原因（例如只看資產負債表的那支）：整期都沒值，照樣寫；全是別的原因就不寫
assert.equal(semiannualWindowNote({ ...gap(2024, 1, 'semiannual_window'), values: { ...gap(2024, 1, 'semiannual_window').values, netProfitMargin: { value: null, nullReason: 'missing_input' } } }, quarterly, codes), '2023 年只申報半年報，這一季的近四季算不出來（單季看得到）')
assert.equal(semiannualWindowNote(gap(2024, 1, 'missing_input'), quarterly, codes), undefined)
// 單季序列只有一支標了（另一支是資產負債表類、照樣有值）也認得出年份
const oneMarked = [{ fiscalYear: 2023, fiscalQuarter: 2, values: { roe: { value: null, nullReason: 'semiannual_only' }, netProfitMargin: { value: 1.4, nullReason: null } } }, { fiscalYear: 2023, fiscalQuarter: 4, values: { roe: { value: null, nullReason: 'semiannual_only' }, netProfitMargin: { value: 1.5, nullReason: null } } }]
assert.equal(semiannualWindowNote(gap(2024, 1), oneMarked, codes), '2023 年只申報半年報，這一季的近四季算不出來')
// 單季序列看不到前一年（例如序列太短）：原因碼照樣寫，只是沒有年份
assert.equal(semiannualWindowNote(gap(2024, 1, 'semiannual_window'), [], codes), NULL_REASON_LABELS.semiannual_window)
assert.equal(semiannualWindowNote(gap(2024, 1), [], codes), undefined)
// 年中掛牌：2023 只有上半年是半年報（第三季起季報）→ 第一季寫上半年；第三季的近四季只用到下半年，不是這個原因
const midYear = [entry(2023, 2, null, 'semiannual_only'), entry(2023, 3, 5), entry(2023, 4, 6), entry(2024, 1, 4), entry(2024, 3, 7)]
assert.equal(semiannualWindowNote(gap(2024, 1, 'semiannual_window'), midYear, codes), '2023 年上半年只申報半年報，這一季的近四季算不出來（單季看得到）')
assert.equal(semiannualWindowNote(gap(2024, 3), midYear, codes), undefined)
// 這一期算不出來，不是不適用（semiannual_only 才是不適用）
assert.equal(nullReasonShortText('semiannual_window'), '無法計算')
assert.equal(nullReasonShortText('semiannual_only'), '不適用')

const has = value => value !== null
assert.deepEqual(trimEmptyEnds([null, 1, null, 2, null], has), [1, null, 2])
assert.deepEqual(trimEmptyEnds([null, null], has), [])
// 篩選結果的格子：幾年期的指標歷史不夠長寫「未滿 N 年」，年數從期別開頭或指標代碼結尾讀；其他原因、讀不出年數的不改（照舊「－」）
assert.equal(screenerNullText('roeWeighted5y.FY', 'insufficient_history'), '未滿 5 年')
assert.equal(screenerNullText('beta.5Y_1M', 'insufficient_history'), '未滿 5 年')
assert.equal(screenerNullText('peRatioRiverBand.3Y_1D', 'insufficient_history'), '未滿 3 年')
assert.equal(screenerNullText('holdingDividendGrowthRate3y.EOD', 'insufficient_history'), '未滿 3 年')
assert.equal(screenerNullText('livePriceChangeRate.EOD', 'no_trade'), '無成交')
assert.equal(NULL_REASON_LABELS.no_trade, '當天沒有成交')
assert.equal(screenerNullText('epsCagr5y.FY', 'zero_or_negative_denominator'), null)
assert.equal(screenerNullText('roe.TTM', 'insufficient_history'), null)
// 興櫃的上市櫃年數（數據中台的 not_listed）：格子寫未上市櫃、短措辭算不適用（結構性），長說明有寫
assert.equal(screenerNullText('listedYears.EOD', 'not_listed'), '未上市櫃')
assert.equal(nullReasonShortText('not_listed'), '不適用')
assert.ok(NULL_REASON_LABELS.not_listed)

// 每一期的說明（2026-11-21）：數據中台的代碼與參數 → 句子；金額千元；同一句只寫一次；不認得的代碼不寫
assert.equal(periodNoteText({ code: 'large_net_other_income_expenses', amount: 59607, ratioToRevenue: 37.91, operatingMarginAboveGrossMargin: true }), '營業利益含其他收益及費損 5,961萬元（占營收 37.91%），營業利益率因此高過毛利率。')
assert.equal(periodNoteText({ code: 'large_net_other_income_expenses', amount: -77640, ratioToRevenue: null, operatingMarginAboveGrossMargin: false }), '營業利益含其他收益及費損 −7,764萬元。')
assert.equal(periodNoteText({ code: 'operating_expense_not_itemized', reason: 'components_do_not_add_up', unitemizedAmount: -1234 }), '這一期推銷、管理、研發與減損加起來不等於營業費用合計，差 123.4萬元。')
assert.equal(periodNoteText({ code: 'operating_expense_not_itemized', reason: 'total_only', unitemizedAmount: 999 }), '這一期的營業費用只申報合計，拆不出推銷、管理與研發。')
assert.equal(periodNoteText({ code: 'something_new' }), null)
const shared = { code: 'operating_expense_not_itemized', reason: 'financial_industry_format', unitemizedAmount: 624988 }
assert.equal(periodNotesText([{ notes: [shared] }, { notes: [shared] }, null, { notes: [] }]), '銀行、金控、保險與證券的營業費用用另一套科目申報，拆不出推銷、管理與研發。')

// 財報更正、重編與沒申報的期別（數據中台 A 批，2026-11-22）：句子、短措辭，以及 withPeriodFacts 併進格子
assert.equal(periodNoteText({ code: 'financial_report_corrected', announcementDate: '2026-11-16' }), '這一期的財報在 2026-11-16 更正過，數字是更正後的。')
assert.equal(periodNoteText({ code: 'financial_report_restated', announcementDate: '2026-04-02' }), '這一期的財報在 2026-04-02 重編，數字是重編後的。')
assert.equal(periodNoteText({ code: 'monthly_revenue_corrected' }), '這個月的營收更正過，數字是更正後的。')
assert.equal(nullReasonShortText('no_filing'), '未申報')
assert.equal(nullReasonShortText('unsupported_format'), '無法計算')
// 上市的三大法人（not_in_open_data）：我們拿不到，不是算不出來，也不是不適用
assert.equal(nullReasonShortText('not_in_open_data'), '尚無資料')
assert.ok(NULL_REASON_LABELS.not_in_open_data)
// REIT 查不到分配紀錄的那兩段（no_distribution_records）：同樣是沒有紀錄，不是算不出來
assert.equal(nullReasonShortText('no_distribution_records'), '尚無資料')
assert.ok(NULL_REASON_LABELS.no_distribution_records.includes('公開資訊觀測站沒有收錄'))
const cell = value => ({ value, nullReason: null, knowledgeDate: '2026-11-16', knowledgeDateIsFallback: false })
const corrected = { code: 'financial_report_corrected', announcementDate: '2026-11-16' }
const facts = withPeriodFacts(
  [{ fiscalYear: 2025, fiscalQuarter: 1, values: { eps: cell(1), roe: cell(2) } }, { fiscalYear: 2025, fiscalQuarter: 3, values: { eps: cell(3), roe: null }, notes: [corrected] }],
  ['eps', 'roe'],
  [{ fiscalYear: 2024, fiscalQuarter: 4, nullReason: 'no_filing' }, { fiscalYear: 2025, fiscalQuarter: 2, nullReason: 'no_filing' }, { fiscalYear: 2025, fiscalQuarter: 4, nullReason: 'unsupported_format' }]
)
// 回應裡已經有的期別不動（數據中台不會列，以防萬一）；只申報半年報那幾年的第一、三季（semiannual_only）不補：3158 的 2023 年只有 Q2、Q4
assert.equal(withPeriodFacts([{ fiscalYear: 2025, fiscalQuarter: 1, values: { eps: cell(-0.51) } }], ['eps'], [{ fiscalYear: 2025, fiscalQuarter: 1, nullReason: 'unsupported_format' }])[0].values.eps.value, -0.51)
assert.deepEqual(withPeriodFacts([{ fiscalYear: 2023, fiscalQuarter: 2, values: { eps: cell(1) } }, { fiscalYear: 2023, fiscalQuarter: 4, values: { eps: cell(2) } }], ['eps'], [{ fiscalYear: 2023, fiscalQuarter: 3, nullReason: 'semiannual_only' }]).length, 2)
// 比第一期早的不補；中間與最新的補成帶原因的空格；更正接到那一期有值的格子，沒有紀錄的格子照舊是 null
assert.deepEqual(facts.map(entry => `${entry.fiscalYear}Q${entry.fiscalQuarter}`), ['2025Q1', '2025Q2', '2025Q3', '2025Q4'])
assert.equal(nullReasonShortText(facts[1].values.eps.nullReason), '未申報')
assert.equal(periodNotesText([facts[1].values.eps, facts[1].values.roe]), '沒有申報 XBRL 財報，所以沒有數字。')
assert.equal(periodNotesText([facts[2].values.eps, facts[2].values.roe]), '這一期的財報在 2026-11-16 更正過，數字是更正後的。')
assert.equal(facts[2].values.roe, null)
assert.equal(periodNotesText([facts[3].values.eps]), '財報格式還讀不到，所以算不出來。')
assert.equal(periodNotesText([facts[0].values.eps]), '')
// 月營收的列只有 notes
assert.equal(periodNotesText([{ notes: [{ code: 'monthly_revenue_corrected', announcementDate: '2026-11-20' }] }]), '這個月的營收在 2026-11-20 更正過，數字是更正後的。')

console.log('check-null-reason: ok')
