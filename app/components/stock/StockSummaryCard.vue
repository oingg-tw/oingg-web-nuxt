<script setup lang="ts">
import { Star, StarFilled, Share } from '@element-plus/icons-vue'
import type { Stock } from '~/composables/stock/useStocks'
import { companyLogoUrl } from '~/utils/company-logo'

const props = defineProps<{
  stock: Stock
  // company_profile's website field, passed through from useCompanyProfile — null while
  // that's still loading/unavailable, same as any other unbacked field on this page.
  website: string | null
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

// Brandfetch's own URL 404s when it has no logo for a domain (see company-logo.ts) — logoFailed
// tracks that so the <img> just disappears instead of showing a broken-image icon, same
// "no fake-looking placeholder for missing real data" rule this app applies everywhere else.
// Reset whenever the underlying website changes (e.g. navigating between stocks client-side
// re-uses this component instance) so a previous stock's failure doesn't stick around.
const config = useRuntimeConfig()
const logoUrl = computed(() => (props.website ? companyLogoUrl(props.website, config.public.brandfetchClientId) : null))
const logoFailed = ref(false)
watch(() => props.website, () => {
  logoFailed.value = false
})

// Real bug root-caused 2026-09-15 (found live on a mobile viewport, then reproduced deliberately
// with page.route(...).abort() to rule out a rate-limiting fluke): this page is SSR-rendered, so
// the server already emits `<img src="...">` in the initial HTML — the BROWSER starts fetching
// that image the moment it parses the raw HTML, well before Vue's hydration JS has downloaded,
// run, and attached this component's `@error` listener. When the image fails fast (a redirect to
// a non-image response, an aborted request), its `error` event fires and is gone before any
// listener exists to catch it — confirmed live: manually re-dispatching `error` on the exact
// same <img> AFTER hydration works fine and correctly hides it, so the listener itself was never
// the problem, only its attach timing. `mounted` gates the img out of the SSR HTML entirely so
// the browser can't start that pre-hydration fetch race at all — the real fetch only starts once
// Vue mounts client-side with its own listeners already wired. Kept the `naturalWidth === 0`
// check on @load too, defense-in-depth for the (client-navigation, no SSR/hydration race
// involved) case of a response that "succeeds" with an empty/undecodable body.
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
function onLogoLoad(event: Event): void {
  const img = event.target as HTMLImageElement
  if (img.naturalWidth === 0) logoFailed.value = true
}

// QR code share added 2026-09-15 per direct request ("要有QR Code分享功能一樣放在左上角 一樣是個
// icon") alongside the existing navigator.share button — covers the "someone standing next to me
// wants this exact page, no chat app in common" case navigator.share can't (that always requires
// a target app to hand the link to). No QR-generation package in this app yet and one isn't worth
// adding for a single small image — reuses the same "trust an external CDN for a small generated
// image" pattern this card's own logo already established with Brandfetch. Gated on `mounted`
// (same reason as logoUrl below) since window.location.href doesn't exist during SSR.
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
       it, and the mobile-vs-desktop arrangement (centered title over a logo+price pair, vs. logo
       left of a left-aligned title/name/price stack) is purely a CSS grid `grid-template-areas`
       swap on `.summary-card__body` — same "no JS width check, no post-hydration DOM swap"
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
      <!-- Real QR icon 2026-09-15 per direct follow-up ("請找真正的qr code icon") — this app's
           icon set (@element-plus/icons-vue) has no dedicated QR glyph (Grid, used briefly, read
           as a generic grid, not recognizably "QR code"). @iconify/vue is already a dependency
           but unused elsewhere in this app and defaults to fetching icon SVGs from Iconify's own
           public API at runtime — a second external-CDN dependency alongside Brandfetch's logo
           fetch, for something this small. A plain inline SVG (three finder-pattern corner
           squares + scattered modules, the same visual grammar every real QR-reader icon uses)
           needs no network call and no new dependency. -->
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
      <!-- Recolored 2026-09-14 ("看起來醜" — the default `type` circle button read as an
           unstyled grey dot in dark mode, both `--el-button-bg-color`/`--el-button-border-color`
           sit too close to the card's own background at that lightness). `warning` (amber) is
           this app's existing star/favorite-adjacent color elsewhere (StockExDividendCard.vue/
           AttentionStockCard.vue) — `plain` gives a theme-correct tinted outline when
           unfavorited, full amber fill when favorited, without introducing a new color token.
           Icon + visible text (was icon-only circle) since 2026-09-19 — no `title`/`aria-label`
           needed any more, the button's own text is its accessible name. Desktop-only (mobile has
           the in-flow row above instead — see that row's own comment). -->
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
      <img
        v-if="mounted && logoUrl && !logoFailed"
        :src="logoUrl"
        :alt="`${stock.name} logo`"
        class="summary-card__logo"
        @error="logoFailed = true"
        @load="onLogoLoad"
      >
      <!-- Price stacked above change/percent at mobile width (2026-09-16, "股價變動放在股價下面"),
           side by side on one baseline at desktop width — same two elements, CSS only. -->
      <div class="summary-card__price">
        <span class="summary-card__price-value">{{ stock.price.toFixed(2) }}</span>
        <span class="summary-card__price-change" :class="(stock.change ?? 0) > 0 ? 'is-up' : (stock.change ?? 0) < 0 ? 'is-down' : ''">
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
  gap: 8px;
  margin-bottom: 12px;
}

.summary-card__action-btn {
  min-height: 44px;
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
.summary-card__favorite-btn.is-plain,
.summary-card__action-btn.el-button--warning.is-plain {
  --el-button-text-color: #8a6823;
  --el-button-hover-text-color: #8a6823;
  --el-button-border-color: #8a6823;
  --el-button-hover-border-color: #8a6823;
}

/* Mobile-first arrangement (the 2026-09-16 phone redesign, confirmed "完美"): title centered on
   its own full-width row, then the logo + price block side by side as one centered pair. A grid
   (not nested flex wrappers) so the desktop rule below can re-place the SAME four children —
   title / legal name / logo / price — without any second markup tree. */
.summary-card__body {
  display: grid;
  grid-template-columns: auto auto;
  justify-content: center;
  align-items: center;
  column-gap: 12px;
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
.summary-card__legal-name {
  display: none;
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

/* object-fit: contain (not cover) — a logo's own aspect ratio matters, unlike a photo where
   cropping to fill a fixed box is fine. border-radius softens the hard edge Brandfetch's own
   icon crop sometimes leaves, without going as far as a full circle (a wordmark-shaped logo
   would clip badly inside one). */
.summary-card__logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 10px;
  overflow: hidden;
}

.summary-card__price {
  display: flex;
  flex-direction: column;
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
   computer ("電腦版請維持舊版靠左"): logo anchoring the left of a title / legal-name / price
   stack. Same children, re-placed by named grid areas; the mobile-only action row is hidden here
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

  .summary-card__body {
    grid-template-columns: auto 1fr;
    grid-template-areas:
      'logo title'
      'logo legal'
      'logo price';
    justify-content: start;
    column-gap: 14px;
    row-gap: 6px;
    /* Keeps the title's right edge clear of the absolutely-positioned favorite button — widened
       from 48px to 140px 2026-09-19 once that button gained visible text (was a 32px icon
       circle); "加入最愛"/"已加最愛" at min-height:44px with 12px side padding measures well past
       the old 48px reservation. */
    padding-right: 140px;
  }

  /* NO `grid-column: auto` here. It was a leftover reset of the mobile `grid-column: 1 / -1`, and
     it silently undid the column half of `grid-area: title` — leaving the title auto-placed. With
     a logo present that happened to land it in column 2, which looks right, so the bug stayed
     invisible for every company Brandfetch has a logo for. With no logo（1101 台泥, found
     2026-09-22「他的summary 看起來跑版了」）column 1 row 1 is free, the title drops into the LOGO
     column and stretches it to the title's own width, shoving the legal name and the price ~250px
     to the right of a heading that stays at the left edge. `grid-area` already sets both axes. */
  .summary-card__title {
    grid-area: title;
    padding: 0;
    justify-content: flex-start;
    text-align: left;
    font-size: 1.125rem;
  }

  .summary-card__legal-name {
    display: block;
    grid-area: legal;
  }

  .summary-card__logo {
    grid-area: logo;
    width: 64px;
    height: 64px;
  }

  .summary-card__price {
    grid-area: price;
    flex-direction: row;
    align-items: baseline;
    gap: 10px;
  }

  .summary-card__price-value {
    font-size: 2.5rem;
    line-height: 1;
  }
}

/* Not --el-color-danger/success directly — which color means "up" vs "down" flips with
   the market convention (see main.css's --price-up-color/--price-down-color and
   useAppTheme.ts's MarketConvention). */
.is-up {
  color: var(--price-up-color);
}

.is-down {
  color: var(--price-down-color);
}

.summary-card__qr-image {
  display: block;
  margin: 0 auto;
}
</style>
