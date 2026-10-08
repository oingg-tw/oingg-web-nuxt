<script setup lang="ts">
// AppHeaderMenu、SharedFooter 與 layouts/landing.vue 共用的 logo。白色字形（public/images/logo-white.png）放在底色為
// var(--el-color-primary) 的 .app-logo__mark 色塊上，標誌才會跟著使用者選的主色與明暗模式變（2026-09-06，「請用純色色塊當他的
// 背景，這樣才可以跟著主色調變色」——固定金色的 SVG 在某些配色下對比低到看不見）。
const props = withDefaults(defineProps<{
  // 預設（false）在 1280px 以下藏站名：AppHeaderMenu 那一列寬度不夠。landing.vue 的品牌列沒有這個問題，而且藏了就是
  // 「沒見到首頁有網站名稱」（2026-09-05），所以那邊選擇一律顯示。
  alwaysShowName?: boolean
  // accesskey 快速鍵（2026-09-16，完整配置見 pages/sitemap.vue）。這個元件也用在 SharedFooter 與 landing.vue，而 accesskey
  // 每頁必須唯一，所以不能寫死在 NuxtLink 上——只有一頁一個的頁首（AppHeaderMenu／AppMobileHeader）傳 true。
  homeAccesskey?: boolean
}>(), {
  alwaysShowName: false,
  homeAccesskey: false
})
</script>

<template>
  <NuxtLink
    to="/"
    class="app-logo"
    :class="{ 'app-logo--always-show-name': alwaysShowName }"
    :accesskey="props.homeAccesskey ? 'u' : undefined"
    :title="props.homeAccesskey ? '上方功能區塊' : undefined"
    aria-label="回首頁"
  >
    <span class="app-logo__mark">
      <img src="/images/logo-white.png" alt="" class="app-logo__mark-icon">
    </span>
    <!-- Desktop-only by default (see the media query below) — mobile doesn't have the header
         width to spare for both the mark and the full Chinese name alongside the search
         bar/sidebar trigger, so the mark alone still identifies/links home there.
         alwaysShowName overrides that for contexts with no such competing chrome. -->
    <span class="app-logo__name">安盈選股</span>
  </NuxtLink>
</template>

<style scoped>
.app-logo {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

/* 標誌本體 32px，低於 44×44 的觸控下限。用未定位的偽元素擴大熱區而不是放大標誌：AppHeaderMenu 量自己的高度時讀的是
   元素實際盒子，透明覆蓋層不影響那個量測。 */
.app-logo::before {
  content: '';
  position: absolute;
  inset: -6px;
}

.app-logo__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  padding: 2px;
  border-radius: 8px;
  background: var(--el-color-primary);
}

.app-logo__mark-icon {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* line-height: 1 removes the browser-default extra leading around the glyphs — without it the
   text sits visually low relative to the 32px mark despite .app-logo's own align-items: center,
   since that only centers the SPAN's line box, not the glyphs within it. */
.app-logo__name {
  display: none;
  color: var(--el-text-color-primary);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

/* The pinned-sidebar desktop breakpoint, 1280px — one of the eight places that must agree
   (see StockPageNav.vue's own comment for the list). */
/* 見 layouts/default.vue 的同一條查詢——平板直向吃手機、橫向吃桌面。八處必須一致。 */
@media (min-width: 1280px), (min-width: 1024px) and (orientation: landscape) {
  .app-logo__name {
    display: inline;
  }
}

.app-logo--always-show-name .app-logo__name {
  display: inline;
}
</style>
