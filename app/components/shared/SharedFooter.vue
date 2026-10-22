<script setup lang="ts">
// 全站共用的頁尾（法律／聯絡資訊＋語意化導覽），2026-09-07 起 landing.vue 與登入後的 app shell 都用它；app shell 原本那份較簡短
// 的頁尾已刪，免責聲明一律用付費／登入情境下較嚴的措辭（對價關係較強）。
// 兩個掛載處需要兩種寬度行為：landing.vue 把它放在 .landing-shell__content 的兄弟位置，整個視窗寬的滿版列，靠
// .shared-footer__inner 自己的 max-width:1080px 對齊上面 1080px 的閱讀欄；layouts/default.vue 把它放在 .app-shell__inner 裡面，
// 那裡已經決定了頁面寬度（滿版或 useContentWidthMode 的置中上限），再疊一個 1080px 就比正上方的內容窄（「dashboard 畫面 footer
// 看起來很窄」）——`matchContainerWidth` 拿掉那個上限，讓頁尾貼齊父容器。
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
// GDPR／CCPA／Impressum 入口不做（來源文件自己的地域觸發）；無障礙聲明 2026-10-08 起有真的頁面（/accessibility）所以列進導覽。
// 標章只在 NUXT_PUBLIC_A11Y_MARK_URL／IMG 有值時渲染（無障礙網路空間服務網核發後貼官方值），沒核發前不放假圖。
const companyInfo = useCompanyInfo()
const a11yMark = useRuntimeConfig().public.a11yMark
const currentYear = new Date().getFullYear()
// 「Cookie 設定」（2026-10-18）：把 Google Analytics 的選擇清掉，橫幅再出現、焦點移到它的第一顆按鈕。只在真的會問的建置出現
const { asks: consentAsks, setConsent } = useAnalyticsConsent()
async function reopenConsent() {
  setConsent(null)
  await nextTick()
  document.querySelector<HTMLElement>('.consent-banner button')?.focus()
}
</script>

<template>
  <!-- id/tabindex 2026-09-16 — Alt+H accesskey target (app/pages/sitemap.vue documents the
       full scheme); layouts/default.vue's own skip-link-styled `#app-footer` anchor jumps
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

      <!-- 只放本站相關（2026-10-22，使用者：「footer 只放 本站相關」「學習 塞進去 網站導覽」）：連結是 app-features.ts 的
           ABOUT_SITE_LINKS，也是網站導覽頁的「本站」那一組；全站的其他區塊從這裡的「網站導覽」進去。這裡只多兩個頁尾才有的（聯絡我們、
           Cookie 設定）。外觀設定一定要在頁尾（2026-09-17：低視力使用者放大後頁首可能被擠掉，很多人習慣在頁尾找無障礙設定） -->
      <nav class="shared-footer__nav" aria-label="本站">
        <ul class="shared-footer__nav-list">
          <li v-for="link in ABOUT_SITE_LINKS" :key="link.to">
            <NuxtLink :to="link.to" class="shared-footer__nav-link">{{ link.label }}</NuxtLink>
          </li>
          <li>
            <a href="mailto:ian.chu@oingg.com" class="shared-footer__nav-link">聯絡我們</a>
          </li>
          <li v-if="consentAsks">
            <button type="button" class="shared-footer__nav-link shared-footer__nav-button" @click="reopenConsent">Cookie 設定</button>
          </li>
        </ul>
      </nav>

      <p class="shared-footer__disclaimer">
        本站僅提供一般性證券投資資訊與客觀數據篩選結果，非證券投資顧問事業，不構成任何個別有價證券之買賣建議、目標價或進出場時點，不保證投資獲利。歷史行情與財務數據來源包含台灣證券交易所（TWSE）、證券櫃檯買賣中心（TPEx）及公開資訊觀測站等公開資料，實際投資決策請自行判斷並審慎評估風險。
      </p>
      <!-- 名稱後面的 *（2026-10-22，使用者問「強生* 後面那個 * 是甚麼意思? 名稱很多頁面都會用到 這個說明放在哪裡好?」，選了頁尾一句＋
           摘要卡寫面額）：證交所、櫃買中心的簡稱標示，量過 45 家帶 * 的抽 40 家：33 家面額不是 10 元、7 家上游沒有面額、0 家是 10 元 -->
      <p class="shared-footer__disclaimer">公司名稱後面的 *：每股面額不是新臺幣 10 元（證交所、櫃買中心的標示），個股頁的摘要會寫出實際面額。</p>

      <div class="shared-footer__legal">
        <p class="shared-footer__copyright">© {{ currentYear }} {{ companyInfo.legalName }}</p>
        <!-- 統一編號 intentionally omitted — see useCompanyInfo.ts's own comment. -->
        <p v-if="companyInfo.taxId" class="shared-footer__tax-id">統一編號：{{ companyInfo.taxId }}</p>
        <a v-if="a11yMark.url" :href="a11yMark.url" target="_blank" rel="noopener" class="shared-footer__a11y-mark">
          <img :src="a11yMark.img" alt="通過 AA 無障礙網頁檢測（另開新視窗）" width="88" height="31">
        </a>
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

/* Reported live ("主要內容的下緣 請與 Footer 有間距") — layouts/default.vue places this
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

/* Wrapping row, not a single vertical column (2026-09-20, real bug reported live: "Footer 長太高
   了") — the old flex-direction:column stacked all 8 links into 8 full-width 48px rows (384px)
   regardless of viewport width, wasting the whole row's horizontal space on every item. Still a
   flat list, not an accordion — Footer.md §2's own "don't collapse into an accordion below 10
   links" rule is about hiding links behind a toggle, not about a single column being the only
   compact-but-visible option; a wrapped row is exactly as visible/crawlable as the column was,
   just laid out to use the width it already has. Same gap/wrap technique this app's own
   .hub-chip-list already uses elsewhere. */
.shared-footer__nav-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 4px 24px;
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

/* Underline added on top of the existing colour change (2026-09-20) — with links now sitting
   side by side instead of one per row, colour alone was the only difference a hover/focus state
   had next to its neighbours. */
.shared-footer__nav-button {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
}

.shared-footer__nav-link:hover,
.shared-footer__nav-link:focus-visible {
  color: var(--el-color-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
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

.shared-footer__a11y-mark {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}
</style>
