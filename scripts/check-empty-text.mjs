// 畫面上的空值一律寫「－」（U+FF0D），不寫「—」（2026-11-05，使用者：「只要不合理就改掉」：原本 21 個檔寫「—」，其餘寫「－」，同一張表的
// 欄與欄、不同頁之間都不一樣）。靜態掃描 app／shared／server：單獨一個「—」的字面值（'—'、>—<）就是空值，註解與句子裡的破折號不算。
// 不開瀏覽器，跑在 pnpm selfcheck。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const LONE_DASH = /['"`>]—['"`<]/

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|vue)$/.test(path) ? [path] : []
  })
}

const problems = ['app', 'shared', 'server'].flatMap(dir => sourceFiles(join(ROOT, dir))).flatMap(file =>
  readFileSync(file, 'utf8').split('\n').flatMap((line, index) =>
    LONE_DASH.test(line) ? [`${relative(ROOT, file).replaceAll('\\', '/')}:${index + 1}  ${line.trim().slice(0, 100)}`] : []))

if (problems.length) {
  console.log(`空值要寫「－」，不是「—」（${problems.length} 處）：\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('PASS: empty text')
