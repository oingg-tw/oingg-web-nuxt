<script setup lang="ts">
import { INDUSTRY_ZONE_ITEMS } from '~/utils/industry-nav'

// 產業特區的導覽。**版面與樣式全部來自 StockPageNavList**（2026-10-01「請使用共用元件。不可重造
// 車輪。」）——先前這裡自己刻了一份 el-menu 之外的膠囊列，跟個股頁面的側邊欄長得不一樣。
//
// 兩份都在 SSR HTML 裡、由 CSS 決定哪一份可見，跟 StockPageNav 同一個「複製而不是搬移」的安排
// （Teleport 在 Vue SSR 下不會把內容渲染進站內的具名目標，量過）。
//
// 不列 34 個類股：使用者的判斷是「這麼個塞法 UIUX 很難用」。類股入口在 /industries 的表格裡，
// 那裡每一列還帶著家數與兩個中位數，比一份純名稱清單能判斷的多。
</script>

<template>
  <div class="industry-nav-inline">
    <StockPageNavList :items="INDUSTRY_ZONE_ITEMS" label="產業特區" />
  </div>

  <AppNavRail label="產業特區導覽（釘選）">
    <StockPageNavList :items="INDUSTRY_ZONE_ITEMS" label="產業特區" vertical />
  </AppNavRail>
</template>

<style scoped>
/* 橫列只在窄螢幕出現，軌道只在寬螢幕出現。斷點跟站上其他七處一致（見 StockPageNav.vue 的註解）。 */
@media (min-width: 1280px), (min-width: 1024px) and (orientation: landscape) {
  .industry-nav-inline {
    display: none;
  }
}
</style>
