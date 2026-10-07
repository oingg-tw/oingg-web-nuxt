<script setup lang="ts">
import { STOCK_METRIC_INDEX } from '~/utils/stock-page-nav'
// 個股頁面導覽——/stock/:code 子頁之間的連結（清單本身在 StockPageNavList）。兩份真實的副本都在 SSR HTML 裡，純 CSS 決定哪一份
// 可見（2026-09-21 重寫，取代 `<ClientOnly><Teleport>` 版本：實測 Vue SSR 不會把 Teleport 內容渲染進應用內的具名目標——raw curl
// 看到目標是空的，hydration 報 node mismatch；NuxtTeleportSsrSlot 只給 islands 用）。側欄 `<nav aria-label="個股頁面">` 放在
// <main> 裡沒有關係：<nav> 本身就是獨立的地標，不需要外面再包一個 <aside>；也不把它移到 main 之後（線性閱讀的使用者會最後才碰到）。
// 桌機 Tab 順序因此是「頁首 → 摘要卡 → 這個 nav → 麵包屑 → 內容」，是刻意的取捨。
// 固定定位的外殼 2026-09-22 搬到 AppNavRail（總經特區成了第二個使用者）；兩份副本＋CSS 的安排留在這裡，只有這裡知道窄版該長怎樣。
// 股息哪裡來已併入配股配息（2026-09-19）；徽章頁在試行期間（f-score-pilot）不列，從財報亮點與風險連過去。
// 手機版是底部吸附的 <details>（2026-09-23，「底部吸附的 <details> 聽起來UIUX很棒」）：/stock/2330 在 375×812 實測，內嵌清單
// 384px 高、佔第一屏 47%、之後整頁 91% 都碰不到。原生 <details> 不用 JS、鍵盤可操作、不是對話框（不疊彈窗）；不用 el-drawer
// 是因為它的內容打開前不在 SSR HTML 裡，而這些連結是站內連結圖（check-click-depth 讀 raw HTML 證明約 2,300 個個股網址三步內可達）。
// 2026-10-07：外殼（固定、展開、關閉、body 留白）搬到 AppBottomNav，全站共用；這裡只決定清單內容與「目前：XX」。
const props = defineProps<{ code: string }>()

const route = useRoute()
// 釘選的指標頁（例如 /roe）也要寫出目前在哪一頁：原本只查 STOCK_NAV_ITEMS，所以那些頁的這條只剩「其他頁面」
const activeLabel = computed(() => activeLabelFor(STOCK_NAV_ITEMS, props.code, route.path) ?? activeLabelFor(STOCK_METRIC_INDEX, props.code, route.path))
</script>

<template>
  <AppBottomNav :current="activeLabel" label="個股頁面清單">
    <StockPageNavList :code="code" vertical />
  </AppBottomNav>

  <AppNavRail label="個股頁面導覽（釘選）">
    <StockPageNavList :code="code" vertical />
  </AppNavRail>
</template>
