<script setup lang="ts">
// Per docs/3_audiences/前端工程師/Footer.md — a shared footer component with the site's legal/
// contact info and a semantically-structured nav. Used everywhere now (2026-09-07, confirmed
// directly): landing.vue's own inline footer markup, and desktop.vue/mobile.vue's authenticated
// app shell, which previously rendered its own compact single-paragraph AppFooter.vue instead
// (deleted — this component fully replaces it). That component's disclaimer wording was
// DELIBERATELY sharper than landing's own (paid/authenticated access strengthens the 對價關係 a
// court would weigh) — this component's own disclaimer below now uses that sharper wording
// everywhere, resolving the wording mismatch that used to block sharing one component.
//
// Sits inside .app-shell__inner (the sidebar-offset content column, narrower than a full-bleed
// landing page) on desktop.vue/mobile.vue — this component's own max-width:1080px on
// .shared-footer__inner just centers within whatever space it's given, same as it already does
// on the landing pages, so no layout-specific variant was needed.
//
// Two things the source doc calls mandatory are deliberately NOT implemented here, per this
// app's own "never fabricate" principle extended to legal/regulatory information:
// - 隱私權政策/服務條款連結：pages don't exist yet. The doc's own §3 principle ("頁尾連結只應
//   指向真實可用的頁面，未上線功能不應出現在頁尾") argues against linking to them anyway.
// - 統一編號：see useCompanyInfo.ts's own comment — the company hasn't been incorporated yet,
//   so no real tax ID exists to disclose. Confirmed directly with the user 2026-09-07, not
//   guessed.
//
// GDPR/CCPA/Impressum/Accessibility-Statement entry points (doc §1) are correctly out of scope
// here too — explicit "地域觸發" opt-outs in the source doc itself, not an oversight.
const companyInfo = useCompanyInfo()
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="shared-footer" role="contentinfo">
    <div class="shared-footer__inner">
      <div class="shared-footer__brand">
        <AppLogo />
        <div class="shared-footer__social">
          <AppGithubLink />
          <AppEmailLink />
        </div>
      </div>

      <nav class="shared-footer__nav" aria-label="頁尾連結">
        <ul class="shared-footer__nav-list">
          <li>
            <a href="mailto:ian.chu@oingg.com" class="shared-footer__nav-link">聯絡我們</a>
          </li>
        </ul>
      </nav>

      <p class="shared-footer__disclaimer">
        本站僅提供一般性證券投資資訊與客觀數據篩選結果，非證券投資顧問事業，不構成任何個別有價證券之買賣建議、目標價或進出場時點，不保證投資獲利。歷史行情與財務數據來源包含台灣證券交易所（TWSE）、證券櫃檯買賣中心（TPEx）及公開資訊觀測站等公開資料，實際投資決策請自行判斷並審慎評估風險。
      </p>

      <div class="shared-footer__legal">
        <p class="shared-footer__copyright">© {{ currentYear }} {{ companyInfo.legalName }}</p>
        <!-- 統一編號 intentionally omitted — see useCompanyInfo.ts's own comment. -->
        <p v-if="companyInfo.taxId" class="shared-footer__tax-id">統一編號：{{ companyInfo.taxId }}</p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.shared-footer {
  border-top: 1px solid var(--el-border-color-lighter);
}

.shared-footer__inner {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
}

.shared-footer__brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.shared-footer__social {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 單欄平鋪，不用手風琴摺疊 — per Footer.md §2，現階段連結數遠低於 10 個的門檻。 */
.shared-footer__nav-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shared-footer__nav-link {
  display: inline-flex;
  align-items: center;
  /* 觸控熱區 48x48px 下限 — 這裡是文字連結，用 min-height 撐開熱區而非隱形偽元素。 */
  min-height: 48px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  text-decoration: none;
}

.shared-footer__nav-link:hover,
.shared-footer__nav-link:focus-visible {
  color: var(--el-color-primary);
}

.shared-footer__disclaimer {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--el-text-color-placeholder);
}

.shared-footer__legal {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.shared-footer__copyright,
.shared-footer__tax-id {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
