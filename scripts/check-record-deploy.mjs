// 部署紀錄的 commit 解析與破壞性判斷（scripts/record-deploy.mjs）。Run: node scripts/check-record-deploy.mjs
import assert from 'node:assert/strict'
import { parseCommits } from './record-deploy.mjs'

const entry = (sha, subject, body = '') => `${sha}\x1f${subject}\x1f${body}\x1e`
const trailer = '\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'

// 一般 commit：不是破壞性；git log 每筆之間的換行要去掉
const [plain, second] = parseCommits(entry('a'.repeat(40), 'Add /changelog', `Body.${trailer}`) + '\n' + entry('b'.repeat(40), 'Fix typo'))
assert.deepEqual(plain, { sha: 'a'.repeat(40), subject: 'Add /changelog', isBreaking: false, breakingNote: null })
assert.equal(second.sha, 'b'.repeat(40))

// 內文的 BREAKING CHANGE：說明到空行為止，不收結尾的 Co-Authored-By；說明可以多行
const [noted] = parseCommits(entry('c'.repeat(40), 'Rename reason codes', `Why.\n\nBREAKING CHANGE: upstream_timeout 改名。\n影響：管理站的排程與服務頁${trailer}`))
assert.equal(noted.isBreaking, true)
assert.equal(noted.breakingNote, 'upstream_timeout 改名。\n影響：管理站的排程與服務頁')
// footer 緊接在說明下一行（中間沒空行）也不收
assert.equal(parseCommits(entry('c'.repeat(40), 'x', 'BREAKING CHANGE: a\nb\nRefs: #12\nCo-Authored-By: C <c@x>'))[0].breakingNote, 'a\nb')

// 標題的 `!`、BREAKING-CHANGE 寫法、只寫標記沒寫說明，都算破壞性
assert.equal(parseCommits(entry('d'.repeat(40), 'feat!: drop ?f= v1'))[0].isBreaking, true)
assert.equal(parseCommits(entry('d'.repeat(40), 'fix(url)!: drop ?f= v1'))[0].isBreaking, true)
assert.equal(parseCommits(entry('e'.repeat(40), 'x', 'BREAKING-CHANGE: y'))[0].breakingNote, 'y')
assert.deepEqual(parseCommits(entry('f'.repeat(40), 'x', `BREAKING CHANGE:${trailer}`))[0], { sha: 'f'.repeat(40), subject: 'x', isBreaking: true, breakingNote: null })
// 內文提到這個詞但不在行首、標題有驚嘆號但不是 type!: 的格式：不算
assert.equal(parseCommits(entry('a'.repeat(40), 'Wow! big change', 'not a BREAKING CHANGE: here'))[0].isBreaking, false)

// 業務中台的上限：標題 300 字、一次 200 個
assert.equal(parseCommits(entry('a'.repeat(40), 'x'.repeat(400)))[0].subject.length, 300)
assert.equal(parseCommits(Array.from({ length: 250 }, () => entry('a'.repeat(40), 's')).join('\n')).length, 200)

console.log('PASS: record deploy')
