<script setup lang="ts">
// 「找不到這檔股票」的 soft-404 畫面，一份（2026-10-02）。
//
// 它原本在 18 個檔案裡各寫一份一模一樣的 markup——16 個 /stock/[code] 子頁面加兩個共用模板
//（StockBadgeDetailPage／StockMetricDetailPage）。CSS 早就是共用的（main.css 的
// `.stock-not-found__title`），只有 markup 留在各處。
//
// 唯一的差異軸是「回首頁」怎麼導航：13 份用 `router.push('/')`、5 份用 `navigateTo('/')`，
// 兩者行為相同。這裡統一用 `navigateTo`，它是 Nuxt 的慣用寫法、SSR 與用戶端都通，而且讓呼叫端
// 不必為了這一顆按鈕持有一個 `useRouter()`。
//
// **條件留在呼叫端**（`v-else-if="!stock"`）而不是搬進來：那個條件是「這一頁判斷公司存不存在」，
// 而 2026-10-02 起那個判斷是看 profile 而不是股價（見 useStockDetailSummary 的註解）。把它藏進
// 這個元件會讓下一次改判斷的人找不到它。
</script>

<template>
  <el-result icon="warning" sub-title="請確認股票代號是否正確">
    <template #title>
      <h1 class="stock-not-found__title">找不到這檔股票</h1>
    </template>
    <template #extra>
      <el-button type="primary" @click="navigateTo('/')">回首頁</el-button>
    </template>
  </el-result>
</template>
