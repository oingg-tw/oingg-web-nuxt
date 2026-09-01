<script setup lang="ts">
// Standalone layout for the public/SEO landing page (/) — deliberately doesn't reuse
// desktop.vue/mobile.vue's app-shell chrome (pinned sidebar, stock search bar, health
// banner). Those exist for an already-in-the-app experience; a first-time visitor landing
// here has no watchlist/screener state to search across yet, and a sidebar full of app
// sections would bury the marketing copy this page exists to surface. See app.vue for how
// this gets selected (page meta, not the desktop/mobile viewport split every other route
// uses).
//
// No <header> — the brand mark/GitHub link live in the footer instead (see
// docs/存股 SaaS 首頁 SEO 策略.md's own "頁尾語意化連結" guidance), which is also where the
// YMYL/E-E-A-T trust content (data-source attribution, financial disclaimer) that same doc
// calls for belongs — site-wide legal boilerplate, not specific to any one page's content.
</script>

<template>
  <div class="landing-shell">
    <main class="landing-shell__content">
      <slot />
    </main>

    <footer class="landing-shell__footer">
      <div class="landing-shell__footer-brand">
        <AppLogo />
        <AppGithubLink />
        <!-- Commented out until there's a real LINE 官方帳號/社群 link to point it at (see
             AppLineLink.vue's own TODO). -->
        <!-- <AppLineLink /> -->
      </div>
      <p class="landing-shell__footer-disclaimer">
        本網站之篩選結果、財報指標說明與歷史回測僅供投資輔助與財務規劃參考，不構成任何有價證券之買賣建議或獲利保證，實際投資決策請自行判斷並審慎評估風險。股市歷史行情與財務數據來源包含台灣證券交易所（TWSE）、證券櫃檯買賣中心（TPEx）及公開資訊觀測站等公開資料。
      </p>
    </footer>
  </div>
</template>

<style scoped>
.landing-shell__content {
  max-width: 1080px;
  margin: 0 auto;
  padding: calc(32px + env(safe-area-inset-top)) 16px 32px;
}

.landing-shell__footer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--el-border-color-lighter);
}

.landing-shell__footer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.landing-shell__footer-disclaimer {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--el-text-color-placeholder);
}
</style>
