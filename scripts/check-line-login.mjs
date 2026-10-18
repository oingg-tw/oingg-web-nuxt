// The one runnable check for takeLineLogin (app/utils/line-login.ts): the state must match, it is single-use, and
// returnTo never leaves the site (open redirect). Pure, no network, no browser.
//
// Run: node scripts/check-line-login.mjs
const store = new Map()
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }
})
const { takeLineLogin } = await import('../app/utils/line-login.ts')

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const pending = returnTo => store.set('line-login', JSON.stringify({ state: 's1', nonce: 'n'.repeat(36), returnTo }))

pending('/stock/2330?tab=1')
assert(takeLineLogin('s1')?.returnTo === '/stock/2330?tab=1', '站內路徑原樣回去')
assert(takeLineLogin('s1') === null, '只能用一次')
pending('/x')
assert(takeLineLogin('other') === null, 'state 不符就不算')
assert(takeLineLogin('s1') === null, 'state 不符也會清掉，不能再試')
for (const evil of ['//evil.example', 'https://evil.example', '/auth/line?code=x', '', undefined]) {
  pending(evil)
  assert(takeLineLogin('s1')?.returnTo === '/', `不接受 ${JSON.stringify(evil)}，改回首頁`)
}
store.set('line-login', '{broken')
assert(takeLineLogin('s1') === null, '存的內容壞掉不丟錯')

if (failures) {
  console.log(`\n${failures} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
