// font-size 一律相對單位（2026-11-04，數位發展部 Freego 檢測碼 CS2140401C「任何CSS樣式規則均使用具名字型尺寸，或者使用百分比或em等
// 相對字型尺寸單位」(AA)；全站每一頁都載入同一批 CSS，一條 px 就讓每一頁都不通過）：建置時把 font-size 宣告裡的 px 換成 rem
// （÷16，預設文字大小時一模一樣），Element Plus 的 CSS 與各元件的 <style> 都經過這裡，calc() 與 var() 的預設值也換。名稱裡有
// font-size 的 CSS 變數（--el-tag-font-size、--el-font-size-base…）一起換：它們是字級，而「--el-tag-font-size:12px」整串也長得像
// 違規的宣告。換成 rem 之後，外觀設定的文字大小（html[data-text-scale]）連 Element Plus 的字一起放大。邊框、間距的 px 不動。
// 在 nuxt.config 的 postcss.plugins 用路徑載入；scripts/check-font-size-rem.mjs 直接 import
const PX = /(-?\d*\.?\d+)px\b/g
const isFontSize = prop => prop === 'font-size' || (prop.startsWith('--') && prop.includes('font-size'))

const fontSizeRem = () => ({
  postcssPlugin: 'font-size-rem',
  Declaration(decl) {
    if (isFontSize(decl.prop)) decl.value = decl.value.replace(PX, (_, size) => `${Number(size) / 16}rem`)
  }
})
fontSizeRem.postcss = true

export default fontSizeRem
