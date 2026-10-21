// The one runnable check for securityPath (shared/utils/hub-slugs.ts): which page a security code links to.
// Codes measured against the 2,725-security directory on 2026-10-21. Pure, no network.
//
// Run: node scripts/check-security-path.mjs
import { securityPath } from '../shared/utils/hub-slugs.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

assert(securityPath('2330') === '/stock/2330', '普通股：個股頁')
assert(securityPath('1101') === '/stock/1101', '普通股：特別股的母公司照樣是個股頁')
assert(securityPath('0056') === '/etf/0056', '四碼 ETF')
assert(securityPath('00878') === '/etf/00878', '五碼 ETF')
assert(securityPath('00931B') === '/etf/00931b', '債券 ETF（00 開頭、帶 B）是 ETF，不是特別股')
assert(securityPath('00679B') === '/etf/00679b', '另一檔債券 ETF')
assert(securityPath('2881A') === '/preferred/2881a', '特別股')
assert(securityPath('2887Z1') === '/preferred/2887z1', '特別股（字母後再一碼）')
assert(securityPath('1101B') === '/preferred/1101b', '台泥乙特')

console.log(failures ? `\n${failures} 項失敗` : '\n全部通過')
process.exitCode = failures ? 1 : 0
