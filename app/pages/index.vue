<script setup lang="ts">
// "/" is now the public/SEO landing page — split off from the dashboard (moved to
// dashboard.vue) per the reasoning that a live-data dashboard has nothing static or
// keyword-rich for search engines to index, while the site's highest-authority URL sitting
// idle on SEO was a real missed opportunity. Structure follows
// docs/存股 SaaS 首頁 SEO 策略.md's own page-module table (hero → features grid → FAQ) and
// heading hierarchy (H1 → H2 → H3) — its pricing-snapshot and AggregateRating modules are
// deliberately NOT included here since this app has no real pricing tiers or review data to
// show; fabricating either would be exactly the kind of misleading YMYL content that doc
// warns against, not a shortcut around missing it.
//
// Rebuilt 2026-09-02 per explicit user request ("首頁砍掉大改") — added a 理念 (philosophy)
// section between hero and the features grid, built around a user-supplied classical quote
// on rejecting luck/speculation in favor of disciplined accumulation ("摒棄僥倖之念，必取百煉
// 成鋼，厚積分秒之功"). Deliberately kept as a philosophy statement about the TOOL (data over
// guessing), not a claim about investment outcomes — mixing the two would cross into exactly
// the kind of return-implying language the SEO doc's YMYL section warns against. Same pass
// also swapped the 大師指標 feature card (its old card copy promised detailed content that
// doesn't exist — see guru-indicators.vue's own comment for that feature's status) for ETF
// 專區 (etf-zone.vue,
// real and live), and rewrote the 總覽儀表板 card's description — it still described the
// pre-repositioning dashboard (大盤行情、當日沖銷與短線交易), which moved to /day-trading on
// 2026-09-02; dashboard.vue is now the retirement-investor-focused page (估值排行/月營收排行/
// 個股健檢).
//
// Rebuilt again 2026-09-05 per conductor's rewritten 首頁.md (3 audiences/前端工程師) - that
// version's own header explicitly frames itself as a forward-looking spec ("以本文件為修正方向,
// 不代表現況已正確"), and its 7.1 section cross-references two "老闆" (executive) strategy docs
// (03-獨特價值主張.md, 04-解決方案.md) - both read directly and confirmed consistent (the UVP
// line below is quoted verbatim from 03, not reworded). H1 now uses that already-decided UVP
// sentence instead of reinventing one (7.1's own instruction). HIGHLIGHTS collapsed from 4
// cards to the 3 the doc specifies (3rd section) - dropped ETF 專區 (not one of the three) and
// 總覽儀表板 (7.1: dashboard is /dashboard's own concern, not a homepage entry card) - with the
// 3rd (KY 股/地雷) card now visually + textually marked as a distinct "defensive" type
// (3.2/3.3 節: the doc explicitly names the OLD 4-card-identical-styling layout as the mistake
// being corrected here). The new 2nd card ("高股息生活費日曆") points at /holdings, which is
// STILL just a shell page (three "功能開發中" sections, no real data) - same trap this file's
// own history already fell into once (大師指標's card above overpromised before being pulled),
// so its description explicitly says "功能持續上線中" rather than implying a finished calendar UI.
//
// Hero rebuilt again 2026-09-05 per a user-supplied competitor screenshot ("首頁照抄這個設計,
// 只是換成自己的文案") — copies the reference's illustrated hero + search layout, but not its
// "今日存股精選" curated-picks carousel (would've conflicted with this app's no-curated-picks
// rule for the retirement-investor audience) or its separate 4-step process-card section
// (folded into the existing 3 HIGHLIGHTS cards instead — step-number badge + "深入了解→" hint —
// rather than duplicating the same 3 destinations under a second, vaguer set of labels). A
// follow-up pass the same day removed the "免費開始使用" CTA (redundant next to the search box)
// and the objectively-sorted stock-ranking section entirely (user: "以下的部分請還原成之前的
// 那個簡單的版本") — back to hero → 核心功能 → FAQ. The defensive-styled KY 股 card was also
// unified back to the same visuals as the other two per explicit user request, overriding
// 首頁.md 3.2/3.3's original "must look visually distinct" recommendation.
//
// The hero illustration (public/images/landing-hero-tree.jpg) is a user-supplied asset - the
// roots' glowing numbers are decorative texture baked into the artwork, not data this app is
// asserting, same as a stock photo's blurred background chart. Hero container is CSS Grid
// (not flex-column) for the two-column layout specifically to avoid re-triggering the "child
// sizes to its own content, not the container" bug three earlier commits
// (f21baf2/4e60a40/b2720c3) already had to debug and fix on the single-column version - Grid
// items default to justify/align-items: stretch, flex items with align-items: flex-start do
// not.
import { Coin, Filter, WarningFilled } from '@element-plus/icons-vue'
import type { Component } from 'vue'

// Own standalone layout (see layouts/landing.vue and app.vue) instead of the app-shell
// desktop/mobile split every other page uses — no pinned sidebar or stock search bar here.
definePageMeta({ layout: 'landing' })

useSeoMeta({
  title: '安盈選股 — 選股篩選與財報分析工具',
  description: '設定屬於你的選股條件，看懂 ROE、Altman Z-Score 等財報指標背後的意義，避開 KY 股地雷，讓每一次投資布局都在時間裡穩健成長。'
})

interface Highlight {
  key: string
  icon: Component
  title: string
  description: string
  to: string
}

const HIGHLIGHTS: Highlight[] = [
  {
    key: 'screener',
    icon: Filter,
    title: '上市櫃全覽篩選',
    description: '從獲利能力、現金流品質到估值指標，設定屬於你的篩選條件，找出真正值得長期持有的好公司。',
    to: '/screener'
  },
  {
    key: 'holdings-cashflow',
    icon: Coin,
    title: '高股息生活費日曆',
    description: '彙整除權息時間與稅後現金流，陪你規劃退休生活費的節奏——功能持續上線中。',
    to: '/holdings'
  },
  {
    key: 'ky-stocks',
    icon: WarningFilled,
    title: '地雷股預警防衛',
    description: '境外上市公司的財務與治理風險，整理成投資人真正該檢查的重點清單，避開地雷。',
    to: '/ky-stocks'
  }
]

// Kept honest on purpose — no invented update cadence, user counts, or accuracy claims this
// app can't actually back up. Mirrored into the FAQPage JSON-LD below verbatim, so the
// visible text and the structured data never drift apart.
interface FaqItem {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: '使用安盈選股需要付費嗎？',
    answer: '目前所有功能皆可免費使用，登入帳號即可儲存你的篩選條件與觀察清單。'
  },
  {
    question: '篩選結果算是投資建議嗎？',
    answer:
      '不是。安盈選股提供的篩選工具、財報指標說明與歷史回測僅供投資輔助與財務規劃參考，不構成任何有價證券之買賣建議或獲利保證，實際投資決策請自行判斷並審慎評估風險。'
  },
  {
    question: '股價與財報數據從哪裡來？',
    answer: '股市歷史行情、財務比率與除權息資訊來源包含台灣證券交易所（TWSE）、證券櫃檯買賣中心（TPEx）及公開資訊觀測站等公開資料。'
  },
  {
    question: '可以追蹤 KY 股或 ETF 嗎？',
    answer: '可以，安盈選股提供 KY 股專區整理境外上市公司的財務與治理風險重點，以及 ETF 專區協助比較追蹤標的。'
  }
]

const requestUrl = useRequestURL()
const companyInfo = useCompanyInfo()

// SoftwareApplication (applicationCategory: FinanceApplication) + Organization + FAQPage —
// the three schema types docs/存股 SaaS 首頁 SEO 策略.md calls out as the baseline for a
// 存股 SaaS homepage. offers/aggregateRating deliberately omitted (see the top-of-file
// comment); logo omitted too since there's no real image asset yet, just the placeholder
// LOGO mark — a logo URL pointing at nothing would be worse than no logo property at all.
//
// Organization.legalName added 2026-09-07 per Footer.md §4 ("頁尾顯示的文字內容與 @graph 中的
// Organization.name...保持一致") — name stays the brand ('安盈選股', what everything else on
// this page/site calls itself) while legalName carries the incorporated entity SharedFooter.vue
// already shows in its copyright line (useCompanyInfo.ts), so a crawler reading both sees one
// consistent entity with two properly-typed names instead of two competing identities.
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: '安盈選股',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        url: requestUrl.origin
      })
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '安盈選股',
        legalName: companyInfo.legalName,
        url: requestUrl.origin,
        sameAs: ['https://github.com/oingg-tw']
      })
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer }
        }))
      })
    }
  ]
})
</script>

<template>
  <div class="landing-page">
    <!-- Went through a dashboard-screenshot hero visual, then a logo-mark swap, then plain
         text-only, then back to a two-column illustrated layout once a real asset existed —
         see top-of-file comment for why Grid (not the old flex-column) this time. -->
    <section class="landing-page__hero">
      <div class="landing-page__hero-visual">
        <img src="/images/landing-hero-tree.jpg" alt="投資如同種一棵樹，紮根、生長、結果的示意圖">
      </div>

      <div class="landing-page__hero-text">
        <span class="landing-page__eyebrow">財報 + 金流分析工具</span>
        <h1 class="landing-page__title">用工具協助解讀財報<br>找出值得長期持有的好公司</h1>
        <p class="landing-page__lead">
          投資如同種一棵樹——春天紮根、夏天生長，都是為了等待秋天結成飽滿的果實。安盈選股
          陪你篩選值得長期持有的好公司、看懂財報數字背後的意義，讓每一分耐心，最終都不會白費。
        </p>
        <LandingStockSearch />
        <p class="landing-page__hero-note">
          本站篩選結果與財報說明僅供投資輔助參考，不構成買賣建議或獲利保證。
        </p>
      </div>
    </section>

    <section class="landing-page__section">
      <h2 class="landing-page__section-title">核心功能</h2>
      <div class="landing-page__highlights">
        <NuxtLink
          v-for="item in HIGHLIGHTS"
          :key="item.key"
          :to="item.to"
          class="landing-page__card"
        >
          <div class="landing-page__card-head">
            <el-icon class="landing-page__card-icon"><component :is="item.icon" /></el-icon>
            <h3 class="landing-page__card-title">{{ item.title }}</h3>
          </div>
          <p class="landing-page__card-desc">{{ item.description }}</p>
        </NuxtLink>
      </div>
    </section>

    <section class="landing-page__section">
      <h2 class="landing-page__section-title">常見問題</h2>
      <div class="landing-page__faqs">
        <div v-for="faq in FAQS" :key="faq.question" class="landing-page__faq">
          <h3 class="landing-page__faq-question">{{ faq.question }}</h3>
          <p class="landing-page__faq-answer">{{ faq.answer }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* Layered radial-gradient "glow" background — per docs/0_researches/oingg.com 首頁背景漸層設計
   研究報告.md's core technique (low-saturation aurora/radial-glow, static not animated, per its
   own guidance for a retirement-age audience: "克制動態、拉高對比"). Deliberately does NOT use
   the report's own suggested fixed navy/gold hex values — this app already has a real, shipped
   7-color selectable accent theme (see useAppTheme.ts), and hardcoding one palette would fight
   that system instead of working with it. color-mix(..., transparent) against
   --el-color-primary is the same technique StockSearchBar.vue's own translucent header
   background already uses, so this automatically follows whichever accent color and
   light/dark mode the user has chosen, with no separate light/dark branch needed. Opacities
   (8–16%) kept low enough that hero text contrast is unaffected — no scrim needed.
   Lives on .landing-page (the full-page wrapper), NOT .landing-page__hero — an earlier version
   scoped to the hero's own (short) box had every radial-gradient's "transparent" fade point
   land AFTER that box's actual edge, so the glow visibly cut off in a hard rectangle exactly
   matching the hero's bounds ("漸層範圍不對", reported live with a screenshot showing the seam).
   Fixed-px circle sizes (not the default farthest-corner ellipse, and not % positions) keep
   each blob anchored near the hero's actual position regardless of how tall the rest of the
   page's content is.
   closest-side, not a fixed px radius — a fixed radius (e.g. 320px) is only safe if it never
   exceeds the actual distance from that blob's anchor point to the box's nearest edge; at wide
   viewports one blob's anchor sat close enough to the box's right edge that its 320px radius
   overshot it, reproducing the exact same hard-cutoff bug one edge over ("好一點了 但是還是不對",
   reported live with a wide-viewport screenshot). closest-side makes each circle's radius
   auto-equal to the distance to its nearest edge, which by construction can never overshoot —
   correct at any box width/height instead of only the ones actually tested.
   The gradient itself lives on a ::before, not .landing-page's own background — .landing-page
   is capped to the same 1080px content column as the rest of the page (via
   .landing-shell__content's max-width), so on a wide monitor the glow stayed confined to that
   centered column too, leaving the empty side margins looking just as bare as before
   ("畫面的左右還是好空虛"). The ::before breaks out to full viewport width (the standard
   negative-margin/100vw full-bleed trick) so the glow spans the entire browser width while the
   actual text/cards content stays at its original, readable centered width — only the
   decorative background needs to be full-bleed, not the content. */
.landing-page {
  position: relative;
  // z-index: 0, not just position: relative — without an explicit z-index, this element does
  // NOT establish its own stacking context, so the ::before's z-index: -1 below escapes to
  // compete at the PAGE's stacking level instead of staying local, and rendered behind the
  // page's own base background (confirmed live: the glow vanished entirely). z-index: 0 forces
  // a local stacking context so -1 correctly means "behind this element's own children," not
  // "behind everything on the page."
  z-index: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.landing-page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 100vw;
  height: 100%;
  transform: translateX(-50%);
  z-index: -1;
  pointer-events: none;
  background-image:
    radial-gradient(circle closest-side at 12% 160px, color-mix(in srgb, var(--el-color-primary) 16%, transparent) 0%, transparent 100%),
    radial-gradient(circle closest-side at 88% 80px, color-mix(in srgb, var(--el-color-primary) 10%, transparent) 0%, transparent 100%),
    radial-gradient(circle closest-side at 65% 420px, color-mix(in srgb, var(--el-color-primary) 8%, transparent) 0%, transparent 100%),
    /* % Y positions (not px) for these two — unlike the three hero blobs above, these are meant
       to keep some glow visible after scrolling past the hero ("滑鼠往下滾以後 下面就沒有漸層
       了"), so they need to track this element's own full height (核心功能 + 常見問題 included)
       rather than stay pinned near the top. Kept fainter (5–6%) than the hero blobs — this is
       meant to read as the same ambient wash continuing, not a second set of equally-prominent
       spotlights competing with the FAQ text for attention. */
    radial-gradient(circle closest-side at 20% 60%, color-mix(in srgb, var(--el-color-primary) 6%, transparent) 0%, transparent 100%),
    radial-gradient(circle closest-side at 85% 88%, color-mix(in srgb, var(--el-color-primary) 5%, transparent) 0%, transparent 100%);
  background-repeat: no-repeat;
}

/* Grid, not flex — see top-of-file comment: three earlier commits had to hunt down "child
   sizes to its own content instead of the container" bugs on the old flex-column single-
   column hero, root-caused to align-items: flex-start. Grid items default to
   justify-items/align-items: stretch, so the same class of bug can't recur here even though
   this is now a two-column layout, which is more layout surface area, not less. Single column
   (image stacked above text) below 960px — matches this app's other 768px breakpoints being
   "tablet-and-up", but the illustration is wide/short (1408x768) and needs more horizontal
   room than that to not look cramped, hence the higher breakpoint here specifically. */
.landing-page__hero {
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  gap: 24px;
  padding: 24px 0;

  @media (min-width: 960px) {
    grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
    gap: 40px;
  }
}

/* Bordered, rounded panel — deliberately NOT trying to blend the image's own dark canvas into
   the page background (which varies by theme: this app's dark mode is #121212, but users can
   switch to several light accent themes too, see main.css). A framed illustration reads as
   intentional in every theme; an edge-bleeding image whose own background doesn't match the
   page's would only look right in one specific theme. */
.landing-page__hero-visual {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);

  img {
    display: block;
    width: 100%;
    aspect-ratio: 736 / 664;
    object-fit: cover;
  }
}

.landing-page__hero-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.landing-page__eyebrow {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  font-size: 16px;
  font-weight: 600;
}

/* 30px on mobile (28px was under the doc's 36-40px H1 guidance for a retiree-facing homepage,
   see docs/compass_artifact_.../吸引退休族群的網站首頁設計要點.md); bumped further at the
   768px breakpoint already used elsewhere in this app (觀察清單/ETF 專區 etc.) rather than the
   1280px sidebar breakpoint AppLogo.vue uses, which is unrelated to this page's own layout.
   width: 100% is required, not optional — .landing-page__hero-text is align-items: flex-start
   (deliberately, so the eyebrow pill/CTA button stay their own natural width instead of
   stretching full-width), which means WITHOUT an explicit width every flex child sizes to its
   own content instead of the container (this is the exact bug three earlier commits had to
   debug — see top-of-file comment). Now scoped to the hero's own text column (not the full
   page width) since the hero is two-column again; that's fine, this only needs to match the
   search box below it, not the 核心功能 grid outside the hero entirely. */
.landing-page__title {
  width: 100%;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.4;
  margin: 0;

  @media (min-width: 768px) {
    font-size: 38px;
  }
}

/* 18px, a step above this app's global 16px font-size floor (see feedback_16px_font_floor
   memory) — the homepage is the most retiree-facing surface in the app, worth the extra step
   per the doc's "內文最低 16px，建議 18–19px 起跳" guidance. Secondary/caption text
   (hero-note, quote-source, eyebrow) stays at 16px on purpose, matching the doc's own
   distinction between primary body copy and secondary labels.
   width: 100% required for the same reason as .landing-page__title above — this flex column
   doesn't stretch children by default (align-items: flex-start, kept for the eyebrow). */
.landing-page__lead {
  width: 100%;
  font-size: 18px;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.landing-page__hero-note {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.landing-page__section {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
  }
}

.landing-page__highlights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

/* Bottom accent bar (border-bottom) + a hover lift — replaced an icon-in-a-colored-badge
   treatment per user's explicit design pick (2026-09-05, chose the accent-bar direction over
   3 other previewed options) after two earlier passes ("還是複雜了", then a redundant "中性
   探索"/"防衛檢查" tag) had made these cards too busy — see top-of-file comment. --el-bg-color
   is this app's own "raised surface" token (already used elsewhere, e.g. the quote block's
   --el-bg-color-overlay one level up). 2px, not the original 3px ("border-bottom 數字變小") —
   a brief ::after-based "short bar" detour got corrected back to a full-width border-bottom,
   just thinner. border-bottom-color stays solid primary on hover (border-color's shorthand
   below would otherwise lighten it along with the other 3 sides). */
.landing-page__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-bottom: 2px solid var(--el-color-primary);
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    border-bottom-color: var(--el-color-primary);
    box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.3);
    transform: translateY(-2px);
  }

  &-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &-icon {
    flex-shrink: 0;
    font-size: 22px;
    color: var(--el-color-primary);
  }

  &-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  &-desc {
    margin: 0;
    font-size: 18px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }
}

.landing-page__faqs {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.landing-page__faq {
  &-question {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 6px;
  }

  &-answer {
    margin: 0;
    font-size: 18px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }
}
</style>
