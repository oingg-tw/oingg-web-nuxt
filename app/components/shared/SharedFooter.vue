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
// Rendered in two structurally different spots, which turns out to need two different width
// behaviors, not the one-size-fits-all max-width:1080px this shipped with originally:
// - landing.vue places it as a sibling of .landing-shell__content, not nested inside it — a
//   full-bleed bar the whole viewport width, where .shared-footer__inner's own max-width:1080px
//   is what centers its content to match the page's own 1080px reading column above it.
// - desktop.vue/mobile.vue place it INSIDE .app-shell__inner instead, which already resolves to
//   whatever width the page itself uses (full width, or capped at --app-content-max-width in
//   "centered" mode via useContentWidthMode) — stacking another fixed 1080px cap on top of that
//   made the footer visibly narrower than the page content sitting right above it on any screen
//   wider than 1080px, reported directly ("dashboard 畫面 footer看起來很窄"). `matchContainerWidth`
//   drops the cap so the footer just fills whatever width its already-constrained parent gives
//   it, matching the page content's own edges exactly instead of imposing a second opinion.
const props = defineProps<{ matchContainerWidth?: boolean }>()
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
  <!-- id/tabindex 2026-09-16 — Alt+H accesskey target (app/pages/sitemap.vue documents the
       full scheme); desktop.vue/mobile.vue's own skip-link-styled `#app-footer` anchor jumps
       here, same tabindex="-1" convention `#main-content` already uses so this element can
       actually receive focus even though it's not natively focusable. -->
  <footer id="app-footer" tabindex="-1" class="shared-footer" :class="{ 'shared-footer--match-container-width': matchContainerWidth }" role="contentinfo">
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
            <!-- 2026-09-16 per direct request ("功能導向去網站導覽說明頁") — replaces the
                 always-visible AppAccesskeyBar.vue text bar with a real, linked page
                 (app/pages/sitemap.vue) documenting the Accesskey shortcuts plus a full site
                 map, reached from here the same way most sites surface a sitemap link. -->
            <NuxtLink to="/sitemap" class="shared-footer__nav-link">網站導覽</NuxtLink>
          </li>
          <!-- Hub pages 2026-09-19 (the SEO build) — the footer is on every page, so these are the
               one set of links a crawler (and a keyboard user who scrolled to the end) can count
               on regardless of which page it landed on. -->
          <li>
            <NuxtLink to="/stock" class="shared-footer__nav-link">個股總表</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/screener" class="shared-footer__nav-link">個股篩選</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/rank" class="shared-footer__nav-link">排行</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/metrics" class="shared-footer__nav-link">指標說明</NuxtLink>
          </li>
          <!-- 大師徽章／部落格 2026-09-19 — moved here from the top nav's own 更多▾ dropdown when
               that nav collapsed to 4 flat items (interface-complexity review); the footer is on
               every page, so these two entries still have a reachable, permanent home. -->
          <li>
            <NuxtLink to="/guru-indicators" class="shared-footer__nav-link">大師徽章</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/blog" class="shared-footer__nav-link">部落格</NuxtLink>
          </li>
          <li>
            <a href="mailto:ian.chu@oingg.com" class="shared-footer__nav-link">聯絡我們</a>
          </li>
          <li>
            <!-- 2026-09-17 per direct request ("外觀設定要兩個入口 ... 2. 頁尾 — 這是無障礙慣例中
                 常被忽略但很重要的一條。低視力使用者放大後,header 可能被擠掉;而且很多人習慣在頁尾
                 找「協助工具」「無障礙設定」。") — same plain nav-link treatment as 網站導覽/聯絡我們
                 above it, no special styling. -->
            <NuxtLink to="/appearance" class="shared-footer__nav-link">外觀設定</NuxtLink>
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

/* No cap, no auto-centering — the parent (.app-shell__inner) already resolved to the exact
   width the rest of the page's content uses, full-width or --app-content-max-width centered;
   this just fills that instead of imposing a second, narrower opinion on top of it. */
.shared-footer--match-container-width .shared-footer__inner {
  max-width: none;
  margin: 0;
}

/* Reported live ("主要內容的下緣 請與 Footer 有間距") — desktop.vue/mobile.vue place this
   directly after the page's own <slot> with no gap between them (the footer's own border-top
   was the only visual separation, and a page whose last element is a table/list/tree ran
   straight into it). landing.vue's own plain `<SharedFooter />` (no match-container-width) isn't
   affected — that page already manages its own spacing above the footer separately. */
.shared-footer--match-container-width {
  margin-top: 32px;
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
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  text-decoration: none;
}

.shared-footer__nav-link:hover,
.shared-footer__nav-link:focus-visible {
  color: var(--el-color-primary);
}

.shared-footer__disclaimer {
  margin: 0;
  font-size: 1rem;
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
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}
</style>
