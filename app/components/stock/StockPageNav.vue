<script setup lang="ts">
// 個股頁面導覽——/stock/:code 子頁之間的連結（清單本身在 StockPageNavList）。兩份真實的副本都在 SSR HTML 裡、純 CSS 決定哪一份可見
//（2026-09-21：Vue SSR 不會把 Teleport 內容渲染進應用內的具名目標，hydration 會報 node mismatch）。側欄 nav 放在 <main> 裡是刻意的：
// <nav> 本身就是地標，桌機 Tab 順序「頁首 → 摘要卡 → 這個 nav → 麵包屑 → 內容」。固定外殼 2026-09-22 搬到 AppNavRail。
// 手機版是底部吸附的 <details>（2026-09-23 使用者：「聽起來 UIUX 很棒」）：/stock/2330 在 375×812 實測內嵌清單佔第一屏 47%。原生
// <details> 不用 JS、鍵盤可用、不是對話框；不用 el-drawer 是因為它的內容打開前不在 SSR HTML 裡，而這些連結是站內連結圖
//（check-click-depth 讀 raw HTML）。2026-10-07 外殼搬到 AppBottomNav 全站共用，這裡只決定清單內容與「目前：XX」。
const props = defineProps<{ code: string }>()

const route = useRoute()
// 釘選的指標頁（例如 /roe）也要寫出目前在哪一頁：原本只查 STOCK_NAV_ITEMS，所以那些頁的這條只剩「其他頁面」
const activeLabel = computed(() => activeLabelFor(STOCK_NAV_ITEMS, props.code, route.path) ?? activeLabelFor(STOCK_METRIC_INDEX, props.code, route.path))

// 自選指標可以拖曳排序（StockPageNavList 的 sortableItems），順序就是 pinnedSlugs，同步進帳號（useStockPinnedMetricsSync）
const pinnedNodes = useStockPinnedMetricNodes()
const { pinnedSlugs } = useStockPinnedMetrics()
function reorderPinned(oldIndex: number, newIndex: number) {
  // 清單上看得到的才參與排序；存了但已下架的 slug（pinnedNodes 濾掉的）原樣留在後面
  const visible = pinnedSlugs.value.filter(slug => METRIC_INDEX_BY_SLUG.has(slug))
  const [moved] = visible.splice(oldIndex, 1)
  visible.splice(newIndex, 0, moved!)
  pinnedSlugs.value = [...visible, ...pinnedSlugs.value.filter(slug => !METRIC_INDEX_BY_SLUG.has(slug))]
}
</script>

<template>
  <AppBottomNav :current="activeLabel" label="個股頁面清單">
    <StockPageNavList :code="code" :sortable-items="pinnedNodes" sortable-heading="自選指標" @reorder="reorderPinned" />
  </AppBottomNav>

  <AppNavRail label="個股頁面導覽（釘選）">
    <StockPageNavList :code="code" :sortable-items="pinnedNodes" sortable-heading="自選指標" @reorder="reorderPinned" />
  </AppNavRail>
</template>
