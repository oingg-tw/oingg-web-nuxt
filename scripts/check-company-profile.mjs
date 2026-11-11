// 個股基本資料的寫法（app/utils/company-profile.ts）：上市櫃滿幾年、負責人一人一行怎麼寫、officers 與舊字串欄怎麼選
// Run: node scripts/check-company-profile.mjs
import assert from 'node:assert/strict'
import { fullYears, officerText, officersOf, websiteHref } from '../app/utils/company-profile.ts'

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

// officers 是 null（上游還沒有）照舊讀字串欄；有 officers 讀 officers，同角色多人用頓號接，[] 是真的沒有
const legacy = { officers: null, chairman: '魏哲家', generalManager: '總裁: 魏哲家', spokesperson: '黃仁昭', spokespersonTitle: '資深副總經理暨財務長', deputySpokesperson: '高孟華' }
assert.equal(officersOf(legacy, 'general_manager'), '總裁: 魏哲家')
assert.equal(officersOf(legacy, 'spokesperson'), '黃仁昭（資深副總經理暨財務長）')
assert.equal(officersOf(legacy, 'deputy_spokesperson'), '高孟華')
const split = { ...legacy, officers: [person('general_manager', '游步東'), person('general_manager', '謝兵')] }
assert.equal(officersOf(split, 'general_manager'), '游步東、謝兵')
assert.equal(officersOf(split, 'chairman'), null)
assert.equal(officersOf({ ...legacy, officers: [] }, 'chairman'), null)

// 公司網站：只有 http(s):// 開頭的完整網址才是連結；數據中台現在給的 tsmc.com 不補 https://（交給數據中台），javascript: 擋掉
assert.equal(websiteHref('https://www.tsmc.com'), 'https://www.tsmc.com')
assert.equal(websiteHref('http://www.morn-sun.com.tw/'), 'http://www.morn-sun.com.tw/')
assert.equal(websiteHref('tsmc.com'), undefined)
assert.equal(websiteHref('javascript:alert(1)'), undefined)
assert.equal(websiteHref('https://a.com b.com'), undefined)
assert.equal(websiteHref(null), undefined)

console.log('PASS: company profile')
