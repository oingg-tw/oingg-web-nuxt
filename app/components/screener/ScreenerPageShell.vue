<script setup lang="ts">
// 三組篩選（普通股、特別股、ETF）共用的頁面骨架（2026-10-15 三組篩選重新設計）。使用者：「三組最後使用UIUX要接近，降低用戶負擔」——
// 順序只寫在這裡，三頁只填內容：標題 → 側欄導覽 → 一句說明 → 設定區（我的篩選＋條件）→ 結果區（標題、筆數、顯示欄位、結果表）。
//
// 版面規則（也只寫在這裡）：整頁自然往下捲，**不鎖在一個螢幕高**。原本三頁各自用 height: calc(100vh - …) 把整頁鎖住，上面的分頁與
// 條件吃掉高度後，結果表只剩小小的內捲框（2026-10-15 在 1440×800 量到 ETF 273px、特別股 317px）。結果表自己限高一個螢幕
//（SharedMetricTable 的 viewportHeight），手機是卡片、跟著頁面捲。
defineProps<{
  title: string
  intro: string
  // 「符合上述條件 N 檔」：條件一變就念出來（role="status"）；還沒查過、查詢中由頁面決定要寫什麼
  countText: string
}>()

const uid = useId()
</script>

<template>
  <div class="app-page app-page--compact screener-shell">
    <h1 class="app-page__title app-page__title--app screener-shell__title">
      {{ title }}
      <slot name="title-extra" />
    </h1>
    <ScreenerNav />
    <p class="screener-shell__intro">{{ intro }}</p>
    <slot name="before" />

    <section class="screener-shell__setup" :aria-labelledby="`${uid}-setup`">
      <h2 :id="`${uid}-setup`" class="visually-hidden">篩選條件</h2>
      <slot name="saved" />
      <slot name="conditions" />
    </section>

    <section class="screener-shell__results" :aria-labelledby="`${uid}-results`">
      <div class="screener-shell__results-header">
        <h2 :id="`${uid}-results`" class="app-page__h2 screener-shell__results-title">篩選結果</h2>
        <p class="screener-shell__count" role="status">{{ countText }}</p>
      </div>
      <div v-if="$slots['result-tools']" class="screener-shell__tools">
        <slot name="result-tools" />
      </div>
      <slot name="results" />
    </section>

    <slot />
  </div>
</template>

<style scoped>
.screener-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.screener-shell__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.screener-shell__intro {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

/* 設定區一個框：我的篩選＋條件是同一件事（「篩什麼」），跟下面的結果分開 */
.screener-shell__setup {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.screener-shell__results {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.screener-shell__results-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
}

.screener-shell__results-title {
  margin: 0;
}

.screener-shell__count {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.screener-shell__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
