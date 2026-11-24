// 個股基本資料的寫法（app/utils/company-profile.ts）：上市櫃滿幾年、負責人一人一行怎麼寫、officers 與舊字串欄怎麼選
// Run: node scripts/check-company-profile.mjs
import assert from 'node:assert/strict'
import { formatMoney } from '../shared/utils/number-format.ts'
// keyManagementAnswer 用自動匯入的 formatMoney（同 check-http-error.mjs 頂替 Nitro 的自動匯入）
Object.assign(globalThis, { formatMoney })
const { fullYears, officerText, officersOf, websiteHref, keyManagementAnswer, keyManagementYears, meetingText, DIVIDEND_FREQUENCY_TEXT } = await import('../app/utils/company-profile.ts')

// 滿幾年：還沒到週年要少一年；日期在今天之後或讀不懂是 null
assert.equal(fullYears('1994-09-05', '2026-11-08'), 32)
assert.equal(fullYears('1987-02-21', '2026-11-08'), 39)
assert.equal(fullYears('2001-12-19', '2026-11-08'), 24)
assert.equal(fullYears('2001-11-08', '2026-11-08'), 25)
assert.equal(fullYears('2026-11-09', '2026-11-08'), null)
assert.equal(fullYears(null, '2026-11-08'), null)
assert.equal(fullYears('1994/09/05', '2026-11-08'), null)

// 一個人：職稱跟角色不同才括號、代理標出來、法人董事寫代表人附法人全名、法人沒寫代表人只寫法人
const person = (role, name, extra = {}) => ({ role, name, title: null, isActing: false, corporationName: null, ...extra })
assert.equal(officerText(person('general_manager', '魏哲家', { title: '總裁' })), '魏哲家（總裁）')
assert.equal(officerText(person('chairman', '魏哲家', { title: '董事長' })), '魏哲家')
assert.equal(officerText(person('general_manager', '王小明', { isActing: true, title: '總裁' })), '王小明（代理，總裁）')
assert.equal(officerText(person('chairman', '蔡明興', { corporationName: '富邦金融控股股份有限公司' })), '蔡明興（富邦金融控股股份有限公司代表人）')
assert.equal(officerText(person('chairman', null, { corporationName: '某某投資股份有限公司' })), '某某投資股份有限公司')

// 同角色多人用頓號接；那個角色沒有人、或 officers 是 [] 是 null（2026-11-16 起不讀舊的字串欄）
const split = { officers: [person('general_manager', '游步東'), person('general_manager', '謝兵')] }
assert.equal(officersOf(split, 'general_manager'), '游步東、謝兵')
assert.equal(officersOf(split, 'chairman'), null)
assert.equal(officersOf({ officers: [] }, 'chairman'), null)

// 公司網站：只有 http(s):// 開頭的完整網址才是連結；數據中台現在給的 tsmc.com 不補 https://（交給數據中台），javascript: 擋掉
assert.equal(websiteHref('https://www.tsmc.com'), 'https://www.tsmc.com')
assert.equal(websiteHref('http://www.morn-sun.com.tw/'), 'http://www.morn-sun.com.tw/')
assert.equal(websiteHref('tsmc.com'), undefined)
assert.equal(websiteHref('javascript:alert(1)'), undefined)
assert.equal(websiteHref('https://a.com b.com'), undefined)
assert.equal(websiteHref(null), undefined)


// 主要管理階層薪酬（2026-11-22）：2330 的 2025 年（DEV 實測，千元）；虧損年度沒有占比；金控沒有附註（全部 missing_input）就沒有這一段
const kmEntry = (fiscalYear, compensation, shareBased, ratio, reason = null) => ({ fiscalYear, fiscalQuarter: 4, values: {
  keyManagementCompensation: compensation === null ? { value: null, nullReason: 'missing_input' } : { value: compensation, nullReason: null },
  keyManagementShareBasedPayment: { value: shareBased, nullReason: null },
  keyManagementCompensationToNetIncome: { value: ratio, nullReason: reason }
} })
const kmYears = keyManagementYears([kmEntry(2024, 5808770, 1357432, 0.5), kmEntry(2025, 9224363, 3888675, 0.54)])
assert.deepEqual(kmYears.map(year => year.fiscalYear), [2025, 2024])
assert.equal(keyManagementAnswer(kmYears), '2025 年主要管理階層薪酬 92.24億元，占稅後淨利 0.54%；其中股份基礎給付 38.89億元。')
assert.equal(keyManagementAnswer(keyManagementYears([kmEntry(2025, 2669030, 0, null, 'zero_or_negative_denominator')])), '2025 年主要管理階層薪酬 26.69億元。')
assert.equal(keyManagementAnswer(keyManagementYears([kmEntry(2025, null, null, null, 'missing_input')])), null)
// 配息頻率與股東會（2026-11-24）：代碼換中文，不認得的種類只寫日期，沒有是「－」
assert.equal(DIVIDEND_FREQUENCY_TEXT.quarterly, '季配')
assert.equal(DIVIDEND_FREQUENCY_TEXT.semiannual, '半年配')
assert.equal(meetingText({ meetingDate: '2026-06-04', meetingType: 'regular' }), '2026-06-04（常會）')
assert.equal(meetingText({ meetingDate: '2026-12-10', meetingType: 'extraordinary' }), '2026-12-10（臨時會）')
assert.equal(meetingText({ meetingDate: '2026-12-10', meetingType: 'other' }), '2026-12-10')
assert.equal(meetingText(null), '－')
console.log('PASS: company profile')
