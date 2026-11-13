// 元件庫的規則（2026-11-06，使用者：「整理元件庫」「元件庫的元件風格統一，比如卡片，讓網站每個卡片的邊框樣式一樣」）。靜態掃描 app/：
//   1. 元件都放在資料夾裡，檔名以資料夾名開頭：Nuxt 的標籤就是檔名（app/AppLogo.vue 是 <AppLogo>），看標籤就知道檔案在哪
//   2. 卡片只有一種畫法（.app-card 或 <el-card>）：有實線框又有卡片圓角的規則，不是讀 --el-card-* 就要寫在 CONTROLS 並說明理由
//   3. 分隔線不用控制項的 3:1 深灰：那是輸入框、按鈕的外框，分隔線是 --app-divider（theme.css）
//   4. --el-bg-color 當底色只給外殼（SHELL）：卡片是 --app-card-bg，控制項是 --el-fill-color-blank（2026-11-06，使用者：「每個元件的背景顏色怎麼決定的?」）
// 不開瀏覽器，跑在 pnpm selfcheck。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

const ROOT = new URL('../app/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const COMPONENTS = join(ROOT, 'components')
// 圓角在這個範圍是卡片；再大是晶片或膠囊
const CARD_RADIUS = { min: 8, max: 20 }
// 有框、有圓角，但不是卡片
const CONTROLS = {
  '.appearance-page__swatch': '外觀設定的選項鈕，是控制項，框要 3:1',
  '.learn-group__pager-link': '上一篇／下一篇，按鈕樣子的連結，是控制項',
  '.header-nav__panel': '頁首的下拉選單，是浮層（讀 --el-border-color-light，同 Element 的彈出層）',
  '.column-set-menu__panel': '觀察清單、持股總覽每一類的「欄位」下拉選單（SharedColumnSetMenu），是浮層（框是卡片的暖色，同 .el-popover）'
}

// 頁面外殼：讀 --el-bg-color 的只有這幾個
const SHELL = new Set(['.app-header-menu', '.mobile-header', '.app-nav-rail', '.slide-layer', 'kbd'])

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

// 每個區塊自己的宣告；巢狀的 &:hover、@media 各算一塊
function blocksOf(css) {
  const blocks = []
  const stack = []
  let buffer = ''
  const declare = (text) => {
    const at = text.indexOf(':')
    if (at > 0 && stack.length) stack.at(-1).declarations[text.slice(0, at).trim()] = text.slice(at + 1).trim()
  }
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') {
      const block = { selector: buffer.trim().replace(/\s+/g, ' '), declarations: {} }
      stack.push(block)
      blocks.push(block)
      buffer = ''
    } else if (char === '}') {
      declare(buffer)
      stack.pop()
      buffer = ''
    } else if (char === ';') {
      declare(buffer)
      buffer = ''
    } else {
      buffer += char
    }
  }
  return blocks
}

const problems = []
const pascal = name => name[0].toUpperCase() + name.slice(1)

for (const file of walk(COMPONENTS).filter(path => path.endsWith('.vue'))) {
  const rel = relative(COMPONENTS, file).replaceAll('\\', '/')
  const folder = basename(dirname(file))
  if (dirname(file) === COMPONENTS) problems.push(`${rel}：元件要放在資料夾裡`)
  else if (!basename(file).startsWith(pascal(folder))) problems.push(`${rel}：檔名要以 ${pascal(folder)} 開頭`)
}

for (const file of walk(ROOT).filter(path => /\.(vue|css)$/.test(path))) {
  const rel = relative(ROOT, file).replaceAll('\\', '/')
  const source = readFileSync(file, 'utf8')
  const css = file.endsWith('.css') ? source : [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n')
  for (const { selector, declarations } of blocksOf(css)) {
    const border = declarations.border ?? ''
    const radius = declarations['border-radius'] ?? ''
    const solid = /^[\d.]+px solid /.test(border) && !/transparent|--el-card-border-color/.test(border)
    const rounded = parseFloat(radius) >= CARD_RADIUS.min && parseFloat(radius) < CARD_RADIUS.max
    if (solid && rounded && !CONTROLS[selector]) problems.push(`${rel}  ${selector}：手畫的卡片，換成 .app-card（控制項才寫進 CONTROLS）`)
    const background = declarations.background ?? declarations['background-color'] ?? ''
    if (background.startsWith('var(--el-bg-color)') && !SHELL.has(selector)) problems.push(`${rel}  ${selector}：--el-bg-color 只給外殼，卡片用 .app-card，控制項用 --el-fill-color-blank`)
    for (const side of ['top', 'bottom', 'left', 'right']) {
      if (/^1px solid var\(--el-border-color(-lighter)?\)/.test(declarations[`border-${side}`] ?? '')) problems.push(`${rel}  ${selector}：分隔線用 --app-divider`)
    }
  }
}

if (problems.length) {
  console.log(`元件庫有 ${problems.length} 處不合規則：\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('PASS: component library')
