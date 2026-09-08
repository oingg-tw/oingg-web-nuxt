<script setup lang="ts">
// Site-wide dialog, not a screener.vue-only inline banner — per direct follow-up ("希望改掉，
// 變成一個全域彈窗" then "全站任何頁面都可能彈出") superseding the original inline
// .screener-page__maintenance-notice el-alert. Mounted in desktop.vue/mobile.vue (same spot as
// AppSystemHealthBanner), NOT landing.vue — a first-time visitor on the marketing homepage
// hasn't discovered screener yet, so announcing its outage there would be premature noise
// rather than useful information (same "already-in-the-app experience" distinction
// layouts/landing.vue's own top comment already draws for why it skips the app-shell chrome
// entirely).
//
// analysis-ts's own POST /screener (plus /screener/ranking, /screener/values) was deleted
// 2026-09-08 while retiring the old filterCatalog mechanism, with no fallback and no committed
// restoration timeline (rebuilding on the pitMetrics query layer instead — a real project, per
// bff-ts's own 2026-09-08 notice). This is a static, hand-maintained announcement, not a live
// health probe like useSystemHealth.ts's own — there's no endpoint to poll that would tell this
// component when the outage actually ends, so it doesn't try to auto-detect recovery. Update or
// remove this component once bff-ts/analysis-ts reports the new query layer is live (see
// project_screener_backend_outage memory).
// Shared across every mount (both layouts, same as AppSystemHealthBanner's own reasoning) —
// session-scoped, not persisted to localStorage: resets to false on a fresh page load/session,
// so a returning visitor sees it again rather than it being silently suppressed forever after
// one dismissal during an outage with no defined end date.
const dismissed = useState('screener-maintenance-dialog-dismissed', () => false)

function dismiss() {
  dismissed.value = true
}
</script>

<template>
  <el-dialog
    :model-value="!dismissed"
    title="自訂篩選功能維護中"
    width="360px"
    align-center
    append-to-body
    @update:model-value="dismiss"
  >
    <p class="screener-maintenance-dialog__body">
      目前無法執行搜尋，後端查詢功能正在重新設計，暫無確切恢復時間，造成不便敬請見諒。
    </p>
    <template #footer>
      <el-button type="primary" @click="dismiss">了解</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.screener-maintenance-dialog__body {
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}
</style>
