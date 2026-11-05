<script setup lang="ts">
// 2026-10-07 手機改用全站共用的底部固定條（AppBottomNav），原本是頁首一段直式清單
const route = useRoute()
const current = computed(() => activeLabelFor(INDUSTRY_ZONE_ITEMS, '', route.path))

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
  <AppBottomNav :current="current" label="產業特區清單">
    <StockPageNavList :items="INDUSTRY_ZONE_ITEMS" label="產業特區" />
  </AppBottomNav>

  <AppNavRail label="產業特區導覽（釘選）">
    <StockPageNavList :items="INDUSTRY_ZONE_ITEMS" label="產業特區" />
  </AppNavRail>
</template>
