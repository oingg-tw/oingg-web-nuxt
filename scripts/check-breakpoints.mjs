// 斷點的規則（2026-11-14，使用者：「我們有這麼多的breakpoint設計上正常嗎? 該怎麼改好?」→「統一做法、數字跟內容」）。靜態掃描 app/：
//   1. 整頁版面看視窗寬，@media 的寬度只有兩條：768（手機↔桌機），以及 App 外框那一條（1280，或 1024 橫放，整串照抄 layouts/default.vue）。
//      其他視窗寬度要寫進 ALLOWED 並說明理由；元件自己的排法看自己的寬度，用 @container，門檻是內容放得下的寬度
//   2. 不用範圍語法（(width < 768px)）：@media 的範圍語法要 Safari 16.4，停在 iOS 15 的手機（iPhone 6s／7）會把整條規則當成無效、手機版面
//      整個不見
//   3. 寬度只寫 min-width，「以下」寫它的反面：@media not all and (min-width: 768px)、@container not (min-width: 720px)。一個斷點只有
//      一個數字，兩邊剛好互補：max-width: 767px 跟 min-width: 768px 中間有縫，縮放後視窗寬可以是 767.5px，兩條都不成立
// JS 的 matchMedia 照同樣的規則。不開瀏覽器，跑在 pnpm selfcheck。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../app/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const SHELL = '(min-width: 1280px), (min-width: 1024px) and (orientation: landscape)'
const PAGE = new Set(['min-width: 768px'])
// 檔案 → 這個檔案另外可以用的條件（整串）與理由
const ALLOWED = {
  'assets/css/element-plus.css': { 'not all and (min-width: 340px)': '日期面板是浮在畫面上的彈出層，量的是視窗' },
  'components/app/AppHeaderMenu.vue': { 'not all and (min-width: 1280px)': '頁首固定全寬，搜尋框在 1280 以下收成按鈕（同檔的 matchMedia）', '(min-width: 1280px)': '同上，matchMedia' },
  'components/app/AppSlideLayer.vue': { '(min-width: 1280px)': '兩層滑出層各自對外框那一條的兩半', '(min-width: 1024px) and (orientation: landscape)': '同上' },
  'components/app/AppNavRail.vue': { '(min-width: 1720px)': '浮動側欄是 fixed、量視窗：置中版面在 1720 以上旁邊才放得下' }
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const problems = []
for (const file of walk(ROOT).filter(path => /\.(vue|css|ts)$/.test(path))) {
  const rel = relative(ROOT, file).replaceAll('\\', '/')
  const source = readFileSync(file, 'utf8')
  // @media／@container 只看樣式（.vue 的 <style>、.css）：程式的註解裡也會寫到「@media (…)」
  const css = (file.endsWith('.css') ? source : file.endsWith('.vue') ? [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n') : '').replace(/\/\*[\s\S]*?\*\//g, '')
  const queries = [
    ...[...css.matchAll(/@(media|container)\b([^{;]*)\{/g)].map(([, kind, condition]) => ({ kind, condition: condition.trim().replace(/\s+/g, ' ') })),
    ...[...source.matchAll(/matchMedia\(\s*'([^']*)'/g)].map(([, condition]) => ({ kind: 'media', condition }))
  ]
  for (const { kind, condition } of queries) {
    const where = `${rel}  @${kind} ${condition}`
    if (/\(\s*(width|height)\s*[<>=]/.test(condition)) problems.push(`${where}：範圍語法舊 Safari 讀不懂，寫 min-width（以下用 not）`)
    if (/max-width/.test(condition)) problems.push(`${where}：寬度只寫 min-width，以下寫 not（@media not all and (min-width: …)、@container not (min-width: …)）`)
    if (kind !== 'media' || condition === SHELL || ALLOWED[rel]?.[condition]) continue
    for (const [feature] of condition.matchAll(/(min|max)-width:\s*[\d.]+(px|rem|em)/g)) {
      if (!PAGE.has(feature)) problems.push(`${where}：視窗寬只有 768 與外框那一條；元件自己的排法用 @container，特例寫進 ALLOWED`)
    }
  }
}

if (problems.length) {
  console.log(`斷點有 ${problems.length} 處不合規則：\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('PASS: breakpoints')
