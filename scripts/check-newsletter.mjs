// shared/utils/newsletter.ts：token 的形狀、下一封預計的時間（下一個台北週日 20:00）。
// Run: node scripts/check-newsletter.mjs
import assert from 'node:assert/strict'
import { NEWSLETTER_SECTIONS, isNewsletterToken, newsletterAddress, nextNewsletterIssue } from '../shared/utils/newsletter.ts'

const own = status => ({ address: 'line@example.com', status, verifiedAt: status === 'verified' ? '2026-11-16T12:00:00.000Z' : null })
assert.equal(newsletterAddress({ email: 'acct@example.com', newsletterEmail: own('verified'), editions: [] }), 'acct@example.com', '帳號有 email 就用帳號的')
assert.equal(newsletterAddress({ email: null, newsletterEmail: own('verified'), editions: [] }), 'line@example.com', '沒有帳號 email 才用驗證過的')
assert.equal(newsletterAddress({ email: null, newsletterEmail: own('pending_verification'), editions: [] }), null, '還沒驗證不寄')
assert.equal(newsletterAddress({ email: null, newsletterEmail: own('entered'), editions: [] }), null)
assert.equal(newsletterAddress({ email: null, newsletterEmail: null, editions: [] }), null)

assert.ok(isNewsletterToken('aB3_-x'.repeat(10) + 'abcd'), '64 字、英數與 - _')
assert.ok(!isNewsletterToken('a'.repeat(65)), '超過 64 字')
for (const bad of ['', 'a b', 'a.b', 'a/b', 'a%2F', '台積電', 'abc=', null, undefined, 42, ['abc']]) assert.ok(!isNewsletterToken(bad), `不收 ${JSON.stringify(bad)}`)

const at = iso => nextNewsletterIssue(Date.parse(iso))
assert.equal(at('2026-11-16T12:00:00+08:00'), '11/22（日）晚上 8 點', '週一')
assert.equal(at('2026-11-22T19:59:00+08:00'), '11/22（日）晚上 8 點', '週日 8 點以前是當天')
assert.equal(at('2026-11-22T20:00:00+08:00'), '11/29（日）晚上 8 點', '週日 8 點整起是下週')
assert.equal(at('2026-11-21T16:30:00Z'), '11/22（日）晚上 8 點', 'UTC 週六 16:30＝台北週日 00:30，當天 8 點')
assert.equal(at('2026-11-21T15:59:00Z'), '11/22（日）晚上 8 點', 'UTC 週六 15:59＝台北週六 23:59')
assert.equal(at('2026-12-28T10:00:00+08:00'), '1/3（日）晚上 8 點', '跨年')
assert.deepEqual(NEWSLETTER_SECTIONS.map(section => section.code), ['holdings', 'ex_dividends', 'material_announcements', 'attention_and_disposed_stocks'], '業務中台的固定順序')
console.log('PASS: newsletter')
