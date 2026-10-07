<script setup lang="ts">
import { Star, StarFilled, Share } from '@element-plus/icons-vue'
import type { Stock } from '~/composables/stock/useStocks'

const props = defineProps<{
  stock: Stock
  // 興櫃三態（見 useCompanyProfile 的註解）。只有 `true` 才會寫出「沒有行情」的原因——
  // `null` 代表上游還沒送這個欄位，那時候任何原因都是猜的。
  isEmerging?: boolean | null
  isFavorite: boolean
  // Added 2026-09-15 per direct request ("Summary占太多空間了，名稱可以用短名嗎？比如台積電") —
  // stock.name is the full legal registered name (e.g. "台灣積體電路製造股份有限公司"), which on
  // a phone-width card routinely wraps to 2 lines and eats a lot of the card's own vertical
  // space. Reuses the exact same NormalizedCompanyProfile.shortName field/fallback chain
  // useStockDetailSummary.ts's own stockShortName already established — not derived
  // independently here, so both places stay in sync automatically. Falls back to the full name
  // itself at the call site, same "graceful degrade" convention as stockShortName's own definition.
  shortName: string
  // The page's own subject (公司健檢／配股配息／…), rendered INTO this card's single <h1> — see
  // the heading comment in the template. Every /stock/:code sub-page passes its own.
  topic: string
}>()

// 公司 logo（2026-09-23）— fetched here rather than passed down, because every one of the twelve
// pages that render this card would otherwise have to thread the same prop through.
//
// THE CARD RESERVES NO SPACE FOR IT. Roughly a quarter of the market has no logo（1,533 of 1,985；
// 2330 台積電 among them, its site answers crawlers with 403）, so an empty slot would be the
// common case, not the exception. Nothing stands in for a missing one either — no initial, no
// generated mark — because a placeholder asserts we hold something we do not, the same line this
// app holds against filling a chart's gaps.
const logoSymbol = computed(() => props.stock.code)
const { data: logoData } = await useFetch(() => `/api/stock/${logoSymbol.value}/logo`, {
  key: () => `stock-logo-${logoSymbol.value}`,
  watch: [logoSymbol],
  default: () => null
})
const logo = computed(() => logoData.value?.logo ?? null)

const emit = defineEmits<{
  toggleFavorite: []
}>()

// Share button added 2026-09-15 per direct request ("加上 share button"). navigator.share (the
// native OS share sheet) is the primary path — genuinely useful on the phone-width layout this
// whole card just got redesigned for, letting a viewer hand the page straight to another app
// (LINE/Messages/etc.) instead of manually copying a URL. Falls back to clipboard-copy + a toast
// for browsers without it (desktop Chrome/Firefox still don't implement navigator.share as of
// this date). AbortError is the browser's own signal for "user closed the native share sheet
// without picking anything" — not a real failure, so it's the one error swallowed silently
// instead of surfacing an error toast for a deliberate cancel.
async function shareStock(): Promise<void> {
  const url = window.location.href
  const title = `${props.shortName} ${props.stock.code} ${props.topic}`
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
    } catch (error) {
      if ((error as Error).name !== 'AbortError') ElMessage.error('分享失敗，請稍後再試')
    }
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('連結已複製')
  } catch {
    ElMessage.error('複製連結失敗')
  }
}

// NO COMPANY LOGO HERE ANY MORE（2026-09-22,「拿掉 logo，以後Logo不要從前端拿，改成從後端analysis
// 拿，存進DB」）. This card fetched one straight from Brandfetch's CDN per render; Brandfetch began
// answering every request — any domain, including their own example — with a 302 to their usage
// guidelines page instead of an image, so no logo had been rendering for anyone. Sourcing it from
// a third-party CDN at render time was the actual mistake: the logo is company data and belongs in
// analysis-ts's database beside the rest of the profile, fetched once upstream rather than by
// every visitor's browser. Requested there the same day; this card stays logo-free until it
// arrives as a normal field.
//
// `mounted` stays — the QR code below needs window.location.href, which SSR has no equivalent of.
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
// QR code share added 2026-09-15 per direct request ("要有QR Code分享功能一樣放在左上角 一樣是個
// icon") alongside the existing navigator.share button — covers the "someone standing next to me
// wants this exact page, no chat app in common" case navigator.share can't (that always requires
// a target app to hand the link to). No QR-generation package in this app yet and one isn't worth
// adding for a single small image — reuses the same "trust an external CDN for a small generated
// image" pattern. Gated on `mounted` since window.location.href doesn't exist during SSR.
const qrCodeUrl = computed(() =>
  mounted.value ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}` : null
)

// Switched from el-popover to el-dialog 2026-09-15 per direct follow-up ("QR Code打開時 要讓背景
// 是灰色壟罩。避免視覺失焦") — a popover has no backdrop/mask at all, the rest of the page stayed
// fully visible and interactive behind it, which is exactly the "視覺失焦" (visual focus not
// pulled anywhere) the request is about. el-dialog gives the standing dimmed-mask behavior every
// other modal in this app already gets for free, no custom overlay needed.
const qrDialogVisible = ref(false)

</script>

<template>
  <!-- ONE DOM tree for every width (2026-09-19, the stock-detail a11y/SEO redesign) — replaces the
       2026-09-16 pair of parallel `.summary-card__desktop`/`.summary-card__mobile` trees that both
       shipped in the SSR HTML and were swapped by a media query. That pair meant every stock page
       carried TWO <h1>s (both copies of the same "give jump-by-heading somewhere to land" idea,
       written on different days for the two responsive variants — never a deliberate double), and
       the desktop copy even had the 加入最愛 button INSIDE the heading, so its accessible name
       read「台灣積體電路製造股份有限公司 2330 加入最愛」. Now: exactly one <h1>, no controls inside
       it, and the mobile-vs-desktop arrangement (centered vs. left-aligned title/name/price
       stack) is purely a CSS swap on `.summary-card__body` — same "no JS width check, no
       post-hydration DOM swap"
       convention the old two-tree version was itself trying to honor, without the duplicate
       markup. Mobile-only share/QR corner buttons are CSS-hidden at desktop width (per the
       earlier decision "電腦版不會有 share 與 QR Code"), not a second template.

       The <h1> is「{短名} {代碼} {頁面主題}」— the page's own subject is part of it, so each
       /stock/:code sub-page has one distinct, complete heading (台積電 2330 公司健檢 vs 台積電
       2330 配股配息) instead of a shared identity heading plus a second page-level <h1> below it.
       shortName (not the full legal name) is the search vocabulary people actually type; the full
       name is demoted to the <p> right after, shown at desktop width only. -->
  <!-- body-style padding trimmed 20px→12px top/bottom 2026-09-21（「公司卡片先打薄」, found via a
       first-screen-answer measurement: /stock/2330/eps's real numeric answer landed at 538px on a
       900px viewport, 60% down the fold, well past the "answer in the first 20% of the viewport"
       bar a pSEO research doc names — this card was the single largest contributor at 240px, ahead
       of the breadcrumb's 48px). Horizontal padding (20px) untouched — this only removes the
       card's own top/bottom whitespace. -->
  <el-card class="summary-card" shadow="never" :body-style="{ padding: '12px 20px' }">
    <!-- Mobile-only in-flow action row (2026-09-19, interface-complexity review), replacing the
         two absolutely-positioned corner icon groups this card used to have: a bare icon circle
         failed the reference doc's "icon + visible text" rule, and once these buttons gained real
         text their width no longer fit inside the old 84px title padding reserved for them —
         measured overlap, not a guess. In normal document flow instead, so there's nothing left
         to overlap. Desktop's own 最愛 button stays a separate, absolutely-positioned element
         below (.summary-card__corner-right) — this row is display:none there. -->
    <div class="summary-card__mobile-actions">
      <el-button class="summary-card__action-btn" @click="shareStock">
        <el-icon aria-hidden="true"><Share /></el-icon>分享
      </el-button>
      <!-- 真正的 QR 圖示（2026-09-15，「請找真正的qr code icon」）：@element-plus/icons-vue 沒有 QR 字形（Grid 看起來只是格子），
           用一個內嵌 SVG（三個定位角＋散點，QR 閱讀器圖示的通用語法），不打網路、不加套件。 -->
      <el-button class="summary-card__action-btn" @click="qrDialogVisible = true">
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zM3 14h7v7H3v-7zm2 2v3h3v-3H5zM14 3h7v7h-7V3zm2 2v3h3V5h-3zM14 14h3v3h-3v-3zM19 14h2v2h-2v-2zM14 19h2v2h-2v-2zM19 19h2v2h-2v-2zM17 17h2v2h-2v-2z" />
        </svg>QR 碼
      </el-button>
      <el-button
        type="warning"
        :plain="!isFavorite"
        class="summary-card__action-btn"
        :aria-pressed="isFavorite"
        @click="emit('toggleFavorite')"
      >
        <el-icon aria-hidden="true"><component :is="isFavorite ? StarFilled : Star" /></el-icon>{{ isFavorite ? '已加最愛' : '加入最愛' }}
      </el-button>
    </div>

    <div class="summary-card__corner-right">
      <!-- `warning`（琥珀色）是全站收藏／星號的既有顏色（StockExDividendCard 也用）；`plain` 未收藏時是主題正確的描邊、收藏後整顆
           填色，不新增色票（2026-09-14，預設灰圓鈕在深色模式像沒樣式的灰點）。2026-09-19 起圖示＋可見文字，不需要 aria-label。
           桌機限定——手機用上面那一列。 -->
      <el-button
        type="warning"
        :plain="!isFavorite"
        class="summary-card__favorite-btn"
        :aria-pressed="isFavorite"
        @click="emit('toggleFavorite')"
      >
        <el-icon aria-hidden="true"><component :is="isFavorite ? StarFilled : Star" /></el-icon>{{ isFavorite ? '已加最愛' : '加入最愛' }}
      </el-button>
    </div>

    <div class="summary-card__body">
      <!-- A FIXED HEIGHT and a flexible width, not the 48/64px square this card carried until the
           Brandfetch era ended. 443 of the 1,319 measurable logos（34%）are wordmarks wider than
           1.5:1 — mops now takes them from a company's own site, where JSON-LD/og:image/header
           artwork is routinely a horizontal lockup rather than an icon. A 400×80 wordmark inside a
           64×64 `contain` box renders 64×13 and cannot be read.
           `needs-dark` flips the chip behind the ~108 logos that are near-white on transparency:
           they are correct artwork, just drawn for a dark site footer, and on this app's light card
           they would be invisible. Measured per file by mops（mean luminance over opaque pixels
           plus the opaque ratio）— luminance alone would also flag the 211 bright logos that carry
           their own light background and look fine as they are. -->
      <img
        v-if="logo"
        :src="logo.url"
        :alt="`${shortName} 公司識別標誌`"
        :width="logo.width ?? undefined"
        :height="logo.height ?? undefined"
        class="summary-card__logo"
        :class="{ 'summary-card__logo--needs-dark': logo.needsDarkBackdrop }"
        loading="lazy"
        decoding="async"
      >
      <!-- Explicit spaces between the three spans: Vue's whitespace condensing drops the
           newline-only text between sibling elements, so without these the heading's own text
           (what a screen reader's heading list announces and what innerText returns) ran
           together as「2330台積電Piotroski F-Score」(measured 2026-09-19). The flex layout
           ignores whitespace text nodes, so nothing visual changes.
           Code BEFORE name since 2026-09-21（「summary-card__title 順序上 公司代碼要放前面」）—
           this heading only. The <title>, the meta description and the breadcrumb crumb all still
           lead with the name (useStockPageSeo.ts / stock-digest.ts build those); they were left
           alone deliberately rather than swept along, since those three are the SEO-facing
           strings and this was a request about the on-screen heading.
           The topic span was briefly pulled out of this heading 2026-09-20 and put back the same
           day once the reason for it came up: it is what makes each of a symbol's 7 sub-pages
           carry a DISTINCT <h1> (台積電 2330 配股配息 vs 台積電 2330 財務報表 …). Without it all
           seven headings read「台積電 2330」, which is the duplicate-heading shape this whole page
           set was built to avoid. The breadcrumb names the current page too now — that's
           deliberate overlap between a navigational trail and a page heading, not duplication to
           clean up (see useStockPageSeo.ts's own comment). -->
      <h1 class="summary-card__title">
        <span class="summary-card__code">{{ stock.code }}</span>{{ ' ' }}<span class="summary-card__name">{{ shortName }}</span>{{ ' ' }}<span class="summary-card__topic">{{ topic }}</span>
      </h1>
      <p v-if="stock.name !== shortName" class="summary-card__legal-name">{{ stock.name }}</p>
      <!-- Price stacked above change/percent at mobile width (2026-09-16, "股價變動放在股價下面"),
           side by side on one baseline at desktop width — same two elements, CSS only. -->
      <!-- 沒有股價就整塊不渲染，而不是印「－」與「－ (－%)」（2026-10-01）。三個破折號看起來像壞掉，
           而且會讓讀者以為我們有這個數字只是沒載到。
           原因只在 `isEmerging === true` 時才寫得出來（同日下午上游補了那個欄位）。`null` 不寫、
           `false` 不寫——前者是上游還沒送，後者的沒有行情可能是長期停止買賣或當天 ingest 缺漏，
           而那兩種我現在分不出來。寧可不解釋，也不要給一個可能錯的解釋：讀者會相信它。 -->
      <p v-if="stock.price === null && isEmerging === true" class="summary-card__no-quote">
        興櫃股票以議價方式交易，本站目前沒有這類公司的成交價。
      </p>
      <div v-if="stock.price !== null" class="summary-card__price">
        <span class="summary-card__price-value">{{ formatStockValue(stock, 'price') }}</span>
        <span class="summary-card__price-change" :class="priceDirectionClass(stock.change)">
          {{ formatStockValue(stock, 'change') }} ({{ formatStockValue(stock, 'changePercent') }}%)
        </span>
      </div>
    </div>

    <!-- Dimmed backdrop 2026-09-15 per direct follow-up ("QR Code打開時 要讓背景是灰色壟罩。避免
         視覺失焦") — replaces an earlier el-popover, which has no mask/backdrop at all (the rest
         of the page stayed fully visible and interactive behind it). el-dialog gives the same
         dimmed-mask behavior every other modal in this app already gets, no custom overlay
         needed. append-to-body for the same reason every other dialog in this app uses it (see
         GuruBadgeCard.vue's own comment) — this button sits inside an absolutely-positioned
         corner group, an ancestor's own overflow/stacking context could otherwise clip it. -->
    <el-dialog v-model="qrDialogVisible" title="掃描開啟此頁面" width="min(280px, 90vw)" align-center append-to-body>
      <img v-if="qrCodeUrl" :src="qrCodeUrl" width="200" height="200" alt="掃描 QR Code 開啟此頁面" class="summary-card__qr-image">
      <!-- Visible "關閉" button (2026-09-19, interface-complexity review) — see main.css's own
           .dialog-close-button comment. -->
      <template #footer>
        <el-button class="dialog-close-button" @click="qrDialogVisible = false">關閉</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
/* position:relative anchor for the two corner icon groups — el-card's own root is this
   component's outermost box, so absolute children measure top/left/right against the whole
   card's edge (including its own padding), landing them in the visual corners. */
.summary-card {
  position: relative;
  border-radius: 12px;
}

/* The condensed pinned bar that lived here from 2026-09-10 until 2026-09-21 is GONE — template,
   its IntersectionObserver, all its .summary-card__sticky-* rules, and the two @media blocks
   (max-width: 600px and print) that existed only to hide it. Removed per「summary-card__sticky-bar
   可以拿掉了，在最初始的卡片設定拿掉以後它的意義就不大了」, and the reasoning holds: it was
   introduced to keep logo/name/price/最愛 reachable after scrolling past a card that was then tall
   enough to be worth escaping (a logo row, a 40px price and a whole 6-field stat grid). That card
   has since been thinned twice — the PER/PBR/殖利率 stat row came out site-wide on 2026-09-21 —
   so the thing the bar was a shortcut PAST is now barely taller than the bar itself was.
   Restore from git if a taller card ever comes back; nothing else in the app referenced it. */

/* Mobile-only in-flow action row (2026-09-19) — replaces the old .summary-card__corner-left
   (absolutely-positioned share/QR icon circles). Sits above the title in document order so it
   reads as this card's toolbar, same visual role the old top-left corner group had, just no
   longer overlapping the text below it once each button gained real width from its own label. */
.summary-card__mobile-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

/* margin 歸零：Element Plus 的 `.el-button + .el-button { margin-left: 12px }` 在換行後還留著，375px
   時第三顆「加入最愛」掉到第二行、比上一行多縮 12px（2026-10-06 截圖量到）。間距交給 gap。 */
.summary-card__mobile-actions .summary-card__action-btn {
  min-height: 44px;
  margin: 0;
  padding: 0 12px;
  font-size: 1rem;
}

/* Desktop-only absolutely-positioned 最愛 button (2026-09-19) — the mobile-width equivalent now
   lives in .summary-card__mobile-actions above instead; kept as a separate element (not just a
   CSS-repositioned copy of the same one) so it can stay absolutely positioned in the corner at
   desktop without also having to solve the mobile-width overlap the in-flow row above exists to
   avoid. display:none is the mobile default; the ≥601px media query below turns it back on. */
.summary-card__corner-right {
  display: none;
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
}

.summary-card__favorite-btn {
  min-height: 44px;
  padding: 0 12px;
  font-size: 1rem;
}

/* Real WCAG failure found live via axe 2026-09-19, once these three favorite-toggle buttons
   gained visible "加入最愛"/"已加最愛" text: Element Plus's own default filled `type="warning"`
   button is white text on #e6a23c, 2.18:1 — an icon-only circle never tripped this (icons only
   need the 3:1 non-text floor), but 16px TEXT needs 4.5:1. Near-black clears ~9.6:1 against the
   same #e6a23c. Scoped to just these three toggle buttons, not a blanket .el-button--warning fix
   — other warning buttons elsewhere in the app haven't been individually re-checked for the same
   gap. `.el-button--warning` qualifier on the shared `.summary-card__action-btn` class keeps this
   from touching its sibling share/QR buttons, which aren't type="warning". */
.summary-card__favorite-btn:not(.is-plain),
.summary-card__action-btn.el-button--warning:not(.is-plain) {
  --el-button-text-color: #1a1a1a;
  --el-button-hover-text-color: #1a1a1a;
}

/* The PLAIN half of the same bug, found 2026-09-20 — the 2026-09-19 fix above scoped itself
   `:not(.is-plain)` and so only ever covered the filled 已加最愛 state. `:plain` is bound to
   `!isFavorite`, i.e. the not-yet-favourited state every first-time visitor sees, and Element
   Plus renders that as #e6a23c on #fdf6ec: 2.04:1 text (needs 4.5) AND a #e6a23c border at
   2.19:1 against the white card (SC 1.4.11 non-text needs 3:1). Both fail.
   #8a6823 is this app's own darkened GOLD accent (the 2026-09-19 pass that took the five light
   accents to 4.5:1 text contrast) rather than a new hex: 4.79:1 on the button's tinted fill and
   ~5:1 as a border on white, so one value clears both criteria.
   Why check-stock-pages.mjs never caught it: that script only loads 2330, where axe doesn't flag
   this node; it reproduces on 1101 and was confirmed pre-existing by re-running against a stash
   of unrelated work. */
/* **只在淺色模式**（2026-09-30）。#8a6823 是為了印在淺底上挑的，深色模式下按鈕的底色變成
   Element Plus 的 #292218，同一個金色掉到 3.06:1——低於 4.5:1，實測 axe 在深色模式會報
   color-contrast on .summary-card__favorite-btn > span。這是 2026-09-20 那次修正沒有涵蓋的另一半：
   當時只量了淺色。
   深色模式用 Element Plus 自己的 #e6a23c，不為深色另外發明一個色：文字在 #292218 上是 7.18:1。
   邊框要另外指定——EP 深色的 plain 邊框預設實測只有 3.03:1（非文字門檻剛好是 3:1，等於沒有餘裕），
   改用同一個 #e6a23c 之後是 8.56:1。 */
html:not(.dark) .summary-card__favorite-btn.is-plain,
html:not(.dark) .summary-card__action-btn.el-button--warning.is-plain {
  --el-button-text-color: #8a6823;
  --el-button-border-color: #8a6823;
  --el-button-hover-border-color: #8a6823;
}

html.dark .summary-card__favorite-btn.is-plain,
html.dark .summary-card__action-btn.el-button--warning.is-plain {
  --el-button-border-color: #e6a23c;
  --el-button-hover-border-color: #e6a23c;
}

.summary-card__favorite-btn.is-plain,
.summary-card__action-btn.el-button--warning.is-plain {
  /* hover 的字色跟 :not(.is-plain) 那條一樣用近黑，不是 #8a6823（2026-09-28）。plain warning 一
     hover，Element Plus 就把底填成實心的 #e6a23c，而上一版把 hover 字色留在 #8a6823——金字印在
     橘底上，實測 2.35:1，穩定不變（三個個股頁都有）。#1a1a1a 在同一個 #e6a23c 上是 ~9.6:1，那正是
     上面那條為已加入最愛的填滿狀態算過的值，所以 hover 與按下去之後看起來是同一種處理。 */
  --el-button-hover-text-color: #1a1a1a;
}

/* Height fixed, width free — the shape a mixed set of icons and wordmarks needs. `width`/`height`
   attributes on the element give the browser the intrinsic ratio so the row is the right size
   before the image arrives; without them a lazily-loaded logo would shift the whole card. */
.summary-card__logo {
  height: 40px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
  object-position: left center;
}

/* The chip for near-white artwork. Padded and rounded rather than a bare dark rectangle so it reads
   as a deliberate backdrop; the colour is the app's own inverse surface, not a new hex. */
.summary-card__logo--needs-dark {
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--el-color-info-dark-2, #303133);
}

/* `grid-column: 1 / -1` below spans the one column it now has — kept rather than deleted because
   it is what makes the title a full-width row independently of how many columns the body has.
   The two `grid-area` declarations that used to sit on the legal name and the price are GONE:
   they named areas from the logo-era template, and a grid-area naming an area that no longer
   exists does not no-op — it falls back to auto placement, which is what put 2330's price 683px
   to the right of its own heading after the logo came out（measured 2026-09-22）. */

/* Mobile-first arrangement (the 2026-09-16 phone redesign, confirmed "完美"): title centered on
   its own row, price centered under it. A grid (not nested flex wrappers) so the desktop rule
   below can re-place the SAME children — title / legal name / price — without any second markup
   tree. One column since the logo left（2026-09-22）: it was the other half of the pair the title
   used to sit above. */
.summary-card__body {
  display: grid;
  grid-template-columns: auto;
  justify-content: center;
  /* 欄本身置中還不夠，欄裡的 logo 與股價也要置中——少了這一行，股價與 logo 靠欄的左緣，
     整塊看起來偏左（2026-10-06 375px 截圖）。桌機的 min-width 區塊改回 start。 */
  justify-items: center;
  align-items: center;
  row-gap: 16px;
}

/* No side padding needed any more (2026-09-19) — the corner icon groups that used to sit
   absolutely over this title on the left AND right are gone at mobile width (moved into
   .summary-card__mobile-actions, a normal-flow row above this title instead — see that class's
   own comment); nothing overlaps the title here to clear space for. UA-default h1 margin zeroed —
   the grid's own row-gap handles spacing. */
.summary-card__title {
  grid-column: 1 / -1;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  gap: 4px 8px;
  text-align: center;
  font-size: 1rem;
}

.summary-card__name {
  font-weight: 700;
}

/* Weight-only de-emphasis, no colour step. The secondary colour this used to carry made sense
   while the code TRAILED the name; now that it leads the heading (2026-09-21), the first token a
   reader lands on would have been the faintest one on the line. The name keeps the 700 anchor. */
.summary-card__code {
  font-weight: 400;
}

/* Desktop-only (see the min-width rule below) — at phone width the short name is the whole
   point of the 2026-09-15 "名稱可以用短名嗎" request, so the full legal name stays out of the way. */
.summary-card__no-quote {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.summary-card__legal-name {
  display: none;
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.summary-card__price {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.summary-card__price-value {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.2;
}

.summary-card__price-change {
  font-size: 1rem;
}

/* Desktop arrangement — the pre-2026-09-16 left-aligned layout the user asked to keep for the
   computer ("電腦版請維持舊版靠左"): a left-aligned title / legal-name / price stack. A logo used
   to anchor its left, which is what the named grid areas were for; with the logo gone（2026-09-22）
   one column in source order says the same thing, and the areas would now name an element that
   does not exist. Same children, re-placed; the mobile-only action row is hidden here
   (per "電腦版不會有 share 與 QR Code" — the desktop-only 最愛 button below takes over), which
   stays top-right. The 600px split reuses stock/[code]'s own long-standing "手機版" convention. */
@media (min-width: 601px) {
  .summary-card__mobile-actions {
    display: none;
  }

  .summary-card__corner-right {
    display: flex;
    align-items: center;
  }

  /* Two columns again（2026-09-24,「請現在就還原成Logo在前面的原版排版」）: the logo leads and the
     text stacks beside it, which is what this card looked like before the logo was pulled out on
     2026-09-22 and the grid collapsed to one column.
     `auto 1fr` rather than a fixed first column, and the logo carries its own right margin instead
     of a column-gap — a company with no logo（still roughly a third of the market, and more once
     the squareness gate below takes effect）renders no element at all, so the auto column measures
     zero and the text starts flush left with no hole to clean up. No `:has()` needed. */
  .summary-card__body {
    grid-template-columns: auto 1fr;
    /* 三列必須是 EXPLICIT 的，否則下面 logo 的 `grid-row: 1 / -1` 是個 no-op：沒有宣告任何
       grid-template-rows 的時候所有列都是隱式的，`-1` 指回第 1 條線，logo 只佔第 1 列並且把那一
       列撐高——量到的是 body 高永遠等於「78px 文字 ＋ logo 高」，加法而不是填滿（2026-09-27）。
       三列是量出來的：7 檔在桌機都是 `112px 24px 42px`、body 固定四個子元素。 */
    grid-template-rows: auto auto auto;
    justify-content: start;
    justify-items: start;
    row-gap: 6px;
    /* Keeps the title's right edge clear of the absolutely-positioned favorite button — widened
       from 48px to 140px 2026-09-19 once that button gained visible text (was a 32px icon
       circle); "加入最愛"/"已加最愛" at min-height:44px with 12px side padding measures well past
       the old 48px reservation. */
    padding-right: 140px;
  }

  /* Nothing places this by name any more — one column, source order. The rule it replaces had
     `grid-area: title` followed by `grid-column: auto`, a leftover reset of the mobile
     `grid-column: 1 / -1` that silently undid the column half of the grid-area and left the title
     auto-placed; with a logo present it happened to land in column 2 and looked right, which is
     why /stock/1101 was the page that exposed it（2026-09-22「他的summary 看起來跑版了」）. */
  /* Column 1, spanning every row the text produces — the legal name appears only here at desktop
     and the price row is always present, so `1 / -1` beats counting them. */
  /* 佔滿 body 的高度（2026-09-27 直接指示「summary-card__logo 高度請佔滿 summary 的高度」）。
     `grid-row: 1 / -1` 本來就跨滿所有列，缺的只是 stretch——align-self: center 讓它縮回 40px 的
     固有高度。量到的是 40px → 118px，接近三倍。
     `object-fit: contain` 保證不會變形：寬版商標（1,319 個裡有 443 個是寬高比 > 1.5 的字標）會被
     max-width 卡住、在變高的框裡垂直置中，不會被拉長。
     只在桌機做。手機版是單欄置中版面，logo 自己一列而不是跨列，stretch 會讓它吃掉整個 body。 */
  .summary-card__logo {
    grid-column: 1;
    grid-row: 1 / -1;
    align-self: stretch;
    height: 0;
    min-height: 100%;
    margin-right: 16px;
  }

  /* Named by column, not by grid-area. The areas this card used to declare are what broke it when
     the logo left: a `grid-area` naming an area that no longer exists does not no-op, it falls
     back to auto placement — that is how 2330's price ended up 683px right of its own heading
     （measured 2026-09-22）. Columns cannot dangle that way. */
  .summary-card__title {
    grid-column: 2;
    padding: 0;
    justify-content: flex-start;
    text-align: left;
    font-size: 1.125rem;
  }

  .summary-card__legal-name {
    grid-column: 2;
    display: block;
  }

  .summary-card__price {
    grid-column: 2;
  }

  .summary-card__price {
    flex-direction: row;
    align-items: baseline;
    gap: 10px;
  }

  .summary-card__price-value {
    font-size: 2.5rem;
    line-height: 1;
  }
}

.summary-card__qr-image {
  display: block;
  margin: 0 auto;
}
</style>
