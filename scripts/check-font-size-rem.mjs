// postcss-font-size-rem.mjs 的自我檢查（2026-11-04，Freego CS2140401C：font-size 不能用 px）。直接呼叫外掛的宣告處理函式
// （postcss 只是 Nuxt 的間接相依，這裡不另外裝）
//   node scripts/check-font-size-rem.mjs
import assert from 'node:assert/strict'
import fontSizeRem from '../postcss-font-size-rem.mjs'

const plugin = fontSizeRem()
assert.equal(plugin.postcssPlugin, 'font-size-rem')
const run = (prop, value) => {
  const decl = { prop, value }
  plugin.Declaration(decl)
  return decl.value
}

assert.equal(run('font-size', '12px'), '0.75rem')
assert.equal(run('font-size', '20px'), '1.25rem')
assert.equal(run('font-size', '13.5px'), '0.84375rem')
// Element Plus 的 calc() 與 var() 預設值
assert.equal(run('font-size', 'calc(var(--el-tag-font-size) - 2px)'), 'calc(var(--el-tag-font-size) - 0.125rem)')
assert.equal(run('font-size', 'var(--el-message-close-size,16px)'), 'var(--el-message-close-size,1rem)')
// 名稱裡有 font-size 的 CSS 變數也換
assert.equal(run('--el-tag-font-size', '12px'), '0.75rem')
assert.equal(run('--el-font-size-base', '14px'), '0.875rem')
// 已經是相對單位、具名尺寸的照舊
for (const value of ['1.125rem', 'small', '90%', '1.2em', 'var(--el-font-size-base)']) assert.equal(run('font-size', value), value)
// 其他屬性與其他變數的 px 不動
assert.equal(run('margin', '12px'), '12px')
assert.equal(run('line-height', '20px'), '20px')
assert.equal(run('--el-border-radius-base', '4px'), '4px')
console.log('font-size rem: ok')
