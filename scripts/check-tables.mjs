// 全站表格只由 SharedTable 畫（2026-10-23，使用者：「重點是表格元件要統一管理 這是最重要的」）。靜態掃描 app/ 的 .vue：
//   1. <table> 只能出現在 SharedTable.vue（ALLOWED 列的例外各自寫理由）
//   2. .app-table-card（表格的卡片）只能出現在 SharedTable.vue
//   3. <style> 裡不能直接改 .seo-table 本身（.seo-table td、:deep(.seo-table th)…）：頁面的版面掛在 table-class 上。
//      .seo-table__num／.seo-table__link 這類格子與連結的 class 不算
// 不開瀏覽器，跑在 pnpm selfcheck。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../app/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const OWNER = 'components/shared/SharedTable.vue'
// 例外：不是資料表、或自己有一整套互動的格子
const ALLOWED = {
  'components/shared/SharedSheetGrid.vue': '試算表（role="grid"、可框選、鍵盤方向鍵）：外觀跟著全站表格的 token 走，結構是自己的',
  'components/holdings/HoldingsTraits.vue': '九宮格是色塊（一張圖，不是表格的樣子），下面的指標表與它共用欄位對齊（使用者：「希望底下表格的數字可以對應到上面九宮格的位置」），整塊是一張卡片'
}

function vueFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? vueFiles(path) : path.endsWith('.vue') ? [path] : []
  })
}

const problems = []
for (const file of vueFiles(ROOT)) {
  const rel = relative(ROOT, file).replaceAll('\\', '/')
  if (rel === OWNER) continue
  const source = readFileSync(file, 'utf8')
  const template = source.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '')
  const styles = [...source.matchAll(/<style[\s\S]*?>([\s\S]*?)<\/style>/g)].map(match => match[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n')
  if (!ALLOWED[rel] && /<table[\s>]/.test(template)) problems.push(`${rel}: 直接寫 <table>，改用 <SharedTable>`)
  if (/\bapp-table-card\b/.test(template) || /\.app-table-card\b/.test(styles)) problems.push(`${rel}: 用了 .app-table-card，卡片由 <SharedTable> 畫`)
  if (/\.seo-table(?![\w-])/.test(styles)) problems.push(`${rel}: <style> 直接改 .seo-table，改用 table-class`)
}

for (const problem of problems) console.log(`FAIL ${problem}`)
console.log(problems.length ? `\n${problems.length} 處` : 'PASS: tables')
process.exitCode = problems.length ? 1 : 0
