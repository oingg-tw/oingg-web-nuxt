<script setup lang="ts">
// Rendered at the end of the scrollable content column in both desktop.vue and mobile.vue
// (inside .app-shell__inner, after the page's own <slot />, so it inherits the same
// centered/full-width max-width as the page content instead of spanning the raw viewport).
// landing.vue (the public "/" page) already carries an equivalent disclaimer in its own
// footer, but that layout is never used once signed into the actual app — every other page
// (screener, stock detail, dashboard, watchlist, presets...) had none at all until now.
//
// Per docs/regulatory-compliance/為 ifa.rocks 與 oingg.com 打造 Bucket 工具與選股平台：方法論與
// 台灣法規遵循研究報告.md's own recommendation for oingg.com ("全站免責與警語：顯著標示「本站提供
// 一般性證券投資資訊，非證券投資顧問事業，不構成投資建議」") — paid/subscribed access actually
// strengthens the 對價關係 (compensation) element a court would weigh (基隆地院99年訴字第87號),
// so the authenticated app shell needs this disclaimer more than the public landing page does,
// not less. Wording is sharper than landing.vue's own (adds "非證券投資顧問事業" and explicitly
// rules out per-security buy/sell points and target prices) — landing.vue's own copy is still
// compliant, just less precise; left alone here rather than touched as part of this change.
</script>

<template>
  <footer class="app-footer">
    <p class="app-footer__disclaimer">
      本站僅提供一般性證券投資資訊與客觀數據篩選結果，非證券投資顧問事業，不構成任何個別有價證券之買賣建議、目標價或進出場時點，不保證投資獲利。歷史行情與財務數據來源包含台灣證券交易所（TWSE）、證券櫃檯買賣中心（TPEx）及公開資訊觀測站等公開資料，實際投資決策請自行判斷並審慎評估風險。
    </p>
  </footer>
</template>

<style scoped>
.app-footer {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.app-footer__disclaimer {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--el-text-color-placeholder);
}
</style>
