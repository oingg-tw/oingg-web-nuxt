// 有近N年選單的檔案一定也有範圍滑桿（2026-10-14，使用者：「我前面多次說過要統一改，還是漏掉…怎麼改可以不要漏掉？」）。
// 選單本身已經必填 `period`（少了 typecheck 會擋），這支擋的是另一半：有選單、有 period，卻忘了在圖下方放滑桿——選「自訂區間…」
// 什麼都不會出現。只讀檔案文字，不 import 任何 app 程式。
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SELECT = '<SharedLookbackWindowSelect'
const SLIDER = '<SharedPeriodRangeSlider'

const violates = text => text.includes(SELECT) && !text.includes(SLIDER)

// 自我測試：檢查本身壞了就不能說「全部通過」
if (!violates(`${SELECT} :period="period" />`) || violates(`${SELECT} />${SLIDER} />`) || violates('<div />')) {
  console.error('FAIL: check-period-controls self-test')
  process.exit(1)
}

const files = readdirSync('app', { recursive: true }).filter(file => String(file).endsWith('.vue')).map(file => join('app', String(file)))
const missing = files.filter(file => !file.endsWith('SharedLookbackWindowSelect.vue') && violates(readFileSync(file, 'utf8')))
if (missing.length) {
  for (const file of missing) console.error(`FAIL: ${file} 有近N年選單（SharedLookbackWindowSelect）卻沒有範圍滑桿（SharedPeriodRangeSlider），選「自訂區間…」不會有任何東西出現`)
  process.exit(1)
}
console.log(`PASS: period controls (${files.filter(file => readFileSync(file, 'utf8').includes(SELECT)).length} files with a lookback select)`)
