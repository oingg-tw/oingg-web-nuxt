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

const { columns } = useStocks()

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

// Real bug fixed 2026-09-11 (reported live: "上面有重複資訊，股價與漲跌") — price/change/
// changePercent are already shown, more prominently, by the big price number + inline change/
// percent line right above this row (.summary-card__price) — repeating them again down here as
// small labeled fields was pure duplication, not a second, more detailed view of the same
// numbers. Trading-volume and market-cap are separately excluded as technical/chip-flow metrics
// outside this app's fundamentals/valuation focus (unrelated to the duplication fix above).
// What's left — PER/PBR/殖利率 — are the only three genuinely new numbers this row adds.
const summaryColumns = computed(() =>
  columns.filter(column => !['price', 'change', 'changePercent', 'volume', 'marketCapB'].includes(column.key))
)

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

// Sticky compact header added 2026-09-10 per direct request ("希望 StockSummaryCard 可以重新
// 設計，未來我下拉到底的時候他會貼在頂部") — confirmed via AskUserQuestion the user wants a
// condensed bar (logo/name/price only, not the full 6-field quick-stats grid), not the entire
// card pinned — a stock detail page has 30+ cards below this one, so permanently reserving the
// full card's vertical space (logo row + 40px price + a whole stat grid) would eat a large,
// fixed chunk of every scroll position for the rest of the visit.
//
// IntersectionObserver on the full card's own root element (same pattern as
// EtfResultTable.vue's own load-more sentinel) rather than scroll-position math — toggles
// `showStickyBar` the moment the full card scrolls completely out of view, which also means it
// flips back off automatically the instant the user scrolls back up far enough to see the real
// card again, with no separate scroll-direction bookkeeping needed. Doesn't exist during SSR
// (browser-only API), so only ever constructed from onMounted, matching that file's own
// SSR-guard comment.
const cardRef = ref<{ $el: HTMLElement } | null>(null)
const showStickyBar = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  const el = cardRef.value?.$el
  if (!el) return
  observer = new IntersectionObserver(entries => {
    showStickyBar.value = !(entries[0]?.isIntersecting ?? true)
  })
  observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <!-- Condensed pinned bar — logo/name/code/price/change/actions only; the favorite button stays
       since toggling a watchlist star while browsing is common enough to be worth keeping one tap
       away. Own aria-label on the favorite button (not a plain duplicate of the real card's
       "加入最愛" button) so two buttons with identical accessible names don't both show up in a
       screen reader's list of page controls at the same time. top offset matches the fixed
       app-shell header's own height (--app-header-height/--app-banner-height, see
       desktop.vue/mobile.vue's own use of the same vars) so this bar sits flush beneath it
       instead of overlapping. Client-only by construction (`showStickyBar` is only ever flipped by
       the IntersectionObserver above), so nothing here is in the SSR HTML — deliberately: it's a
       duplicate of the real card for scrolling convenience, not content. -->
  <div v-if="showStickyBar" class="summary-card__sticky-bar">
    <!-- Moved to the very front 2026-09-14 per direct request ("我的最愛要往前面放。放到 公司
         Logo之前 但是要有明顯區隔") — used to sit last, after 顯示模式. Its own trailing border
         (see .summary-card__sticky-favorite's own style) is the "明顯區隔" — a plain gap alone
         would read as just another item in the row instead of a deliberately separate action. -->
    <el-button
      type="warning"
      :plain="!isFavorite"
      :icon="isFavorite ? StarFilled : Star"
      circle
      size="small"
      aria-label="加入最愛（頂部工具列）"
      :aria-pressed="isFavorite"
      class="summary-card__sticky-favorite"
      @click="emit('toggleFavorite')"
    />
    <img
      v-if="mounted && logoUrl && !logoFailed"
      :src="logoUrl"
      :alt="`${stock.name} logo`"
      class="summary-card__sticky-logo"
      @error="logoFailed = true"
      @load="onLogoLoad"
    >
    <span class="summary-card__sticky-name">{{ shortName }}<span class="summary-card__sticky-code">{{ stock.code }}</span></span>
    <span class="summary-card__sticky-price">
      {{ stock.price.toFixed(2) }}
      <span :class="(stock.change ?? 0) > 0 ? 'is-up' : (stock.change ?? 0) < 0 ? 'is-down' : ''">
        {{ formatStockValue(stock, 'change') }} ({{ formatStockValue(stock, 'changePercent') }}%)
      </span>
    </span>
    <div class="summary-card__sticky-actions">
      <el-button
        :icon="Share"
        circle
        size="small"
        aria-label="分享（頂部工具列）"
        @click="shareStock"
      />
    </div>
  </div>

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
  <el-card ref="cardRef" class="summary-card" shadow="never">
    <div class="summary-card__corner-left">
      <el-button :icon="Share" circle size="small" aria-label="分享" @click="shareStock" />
      <!-- Real QR icon 2026-09-15 per direct follow-up ("請找真正的qr code icon") — this app's
           icon set (@element-plus/icons-vue) has no dedicated QR glyph (Grid, used briefly, read
           as a generic grid, not recognizably "QR code"). @iconify/vue is already a dependency
           but unused elsewhere in this app and defaults to fetching icon SVGs from Iconify's own
           public API at runtime — a second external-CDN dependency alongside Brandfetch's logo
           fetch, for something this small. A plain inline SVG (three finder-pattern corner
           squares + scattered modules, the same visual grammar every real QR-reader icon uses)
           needs no network call and no new dependency. -->
      <el-button circle size="small" aria-label="顯示 QR Code" @click="qrDialogVisible = true">
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zM3 14h7v7H3v-7zm2 2v3h3v-3H5zM14 3h7v7h-7V3zm2 2v3h3V5h-3zM14 14h3v3h-3v-3zM19 14h2v2h-2v-2zM14 19h2v2h-2v-2zM19 19h2v2h-2v-2zM17 17h2v2h-2v-2z" />
        </svg>
      </el-button>
    </div>
    <div class="summary-card__corner-right">
      <!-- Recolored 2026-09-14 ("看起來醜" — the default `type` circle button read as an
           unstyled grey dot in dark mode, both `--el-button-bg-color`/`--el-button-border-color`
           sit too close to the card's own background at that lightness). `warning` (amber) is
           this app's existing star/favorite-adjacent color elsewhere (StockExDividendCard.vue/
           AttentionStockCard.vue) — `plain` gives a theme-correct tinted outline when
           unfavorited, full amber fill when favorited, without introducing a new color token. -->
      <el-button
        type="warning"
        :plain="!isFavorite"
        :icon="isFavorite ? StarFilled : Star"
        circle
        size="small"
        title="加入最愛"
        aria-label="加入最愛"
        :aria-pressed="isFavorite"
        @click="emit('toggleFavorite')"
      />
    </div>

    <div class="summary-card__body">
      <!-- Explicit spaces between the three spans: Vue's whitespace condensing drops the
           newline-only text between sibling elements, so without these the heading's own text
           (what a screen reader's heading list announces and what innerText returns) ran
           together as「台積電2330Piotroski F-Score」(measured 2026-09-19). The flex layout
           ignores whitespace text nodes, so nothing visual changes. -->
      <h1 class="summary-card__title">
        <span class="summary-card__name">{{ shortName }}</span>{{ ' ' }}<span class="summary-card__code">{{ stock.code }}</span>{{ ' ' }}<span class="summary-card__topic">{{ topic }}</span>
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

    <!-- A real definition list (2026-09-19) instead of label/value <span> pairs — screen readers
         announce「PER, 27.65倍」as a term/definition pair, and the three numbers become structured
         text in the SSR HTML rather than six unrelated spans. -->
    <dl class="summary-card__grid">
      <div v-for="column in summaryColumns" :key="column.key" class="summary-card__field">
        <dt class="summary-card__label">{{ column.label }}</dt>
        <!-- No unit suffix when the value itself is the '－' missing-data placeholder (per/pbr/
             dividendYield can now genuinely be null — see Stock's own comment in useStocks.ts) —
             "－%" reads like a broken value, not a clean placeholder. -->
        <dd class="summary-card__value">{{ formatStockValue(stock, column.key) }}{{ stock[column.key] !== null ? column.unit : '' }}</dd>
      </div>
    </dl>

    <!-- Dimmed backdrop 2026-09-15 per direct follow-up ("QR Code打開時 要讓背景是灰色壟罩。避免
         視覺失焦") — replaces an earlier el-popover, which has no mask/backdrop at all (the rest
         of the page stayed fully visible and interactive behind it). el-dialog gives the same
         dimmed-mask behavior every other modal in this app already gets, no custom overlay
         needed. append-to-body for the same reason every other dialog in this app uses it (see
         GuruBadgeCard.vue's own comment) — this button sits inside an absolutely-positioned
         corner group, an ancestor's own overflow/stacking context could otherwise clip it. -->
    <el-dialog v-model="qrDialogVisible" title="掃描開啟此頁面" width="min(280px, 90vw)" align-center append-to-body>
      <img v-if="qrCodeUrl" :src="qrCodeUrl" width="200" height="200" alt="掃描 QR Code 開啟此頁面" class="summary-card__qr-image">
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

/* Sticky, not fixed — same reasoning as landing.vue's own sticky header comment: stays in
   normal document flow (no compensating margin needed on whatever renders after it) while
   still pinning to the viewport once its own static position scrolls past. Semi-transparent +
   blur matches StockSearchBar.vue's own fixed app-shell header so content scrolling underneath
   stays legible instead of a hard edge. z-index below the app-shell header/banner's own 10 (see
   AppSystemHealthBanner.vue) since this bar renders below them, never overlapping. */
.summary-card__sticky-bar {
  position: sticky;
  top: calc(var(--app-header-height) + var(--app-banner-height));
  z-index: 5;
  display: flex;
  /* Real bug fixed 2026-09-14: at ~400px this row previously had no wrap, and .sticky-price's
     own `flex:1; min-width:0` let it get squeezed all the way down to 0 width once the trailing
     buttons didn't fit — the price/change simply vanished, not just truncated, since
     min-width:0 has no floor. Wrapping lets the actions drop to their own second row instead of
     stealing the price's space on the first. */
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  margin-bottom: 16px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: color-mix(in srgb, var(--el-bg-color) 85%, transparent);
  backdrop-filter: blur(8px);
  /* per直接要求（"貼頂 bar 請上陰影"）— without this the bar's own translucent background let
     content scrolling underneath show straight through the border alone, reading as if it were
     just another row in the page instead of a distinct pinned layer floating above everything
     else. */
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.1);
}

.summary-card__sticky-logo {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  object-fit: contain;
  border-radius: 4px;
  /* Defense-in-depth alongside the @error handler above — a failed load briefly renders broken
     before Vue reacts to the error event, and a fixed-size img with overflowing alt text (a real
     bug seen live: "愛地雅工業股份有限公司 logo" wrapping across 3 lines out of a 24px box) looks
     broken even after the handler fires. overflow: hidden keeps that text clipped to the box. */
  overflow: hidden;
}

.summary-card__sticky-name {
  flex-shrink: 0;
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
}

.summary-card__sticky-code {
  margin-left: 6px;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.summary-card__sticky-price {
  flex: 1;
  min-width: 140px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-card__sticky-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Real, visible separation from the logo/name that now follows it — a plain flex gap alone (same
   10px every other item in this row already gets) wouldn't read as deliberately distinct from
   "just the next item in the row." A `::after` divider line (not padding/border directly on the
   button itself, which is `circle` — adding padding there would distort its round shape) draws a
   real vertical rule in the gap after it. */
.summary-card__sticky-favorite {
  position: relative;
  flex-shrink: 0;
  margin-right: 6px;
}

.summary-card__sticky-favorite::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -9px;
  width: 1px;
  height: 20px;
  transform: translateY(-50%);
  background: var(--el-border-color);
}

.summary-card__corner-left,
.summary-card__corner-right {
  position: absolute;
  top: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 1;
}

.summary-card__corner-left {
  left: 12px;
}

.summary-card__corner-right {
  right: 12px;
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

/* Side padding clears the two absolutely-positioned corner icon groups so a long name+code+topic
   combination centers within the remaining space instead of visually colliding with either
   icon group — sized to the WIDER (left, share+QR = 12px inset + 2×32px buttons + 6px gap) group
   on both sides so the title stays centered; at 375px that leaves ~170px, so a long topic wraps
   to a second centered line (flex-wrap) rather than being clipped. Real bug caught live
   2026-09-19: the previous 40px was sized for the old, shorter「台積電 2330」title, and the QR
   button overlapped the first character once the page topic joined the heading. UA-default h1
   margin zeroed — the grid's own row-gap handles spacing. */
.summary-card__title {
  grid-column: 1 / -1;
  margin: 0;
  padding: 0 84px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  gap: 4px 8px;
  text-align: center;
  font-size: 1rem;
}

.summary-card__name,
.summary-card__topic {
  font-weight: 700;
}

.summary-card__code {
  font-weight: 400;
  color: var(--el-text-color-secondary);
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
   stack. Same children, re-placed by named grid areas; the mobile-only share/QR corner group is
   hidden here (per "電腦版不會有 share 與 QR Code"), the favorite star stays top-right. The 600px
   split reuses stock/[code]'s own long-standing "手機版" convention. */
@media (min-width: 601px) {
  .summary-card__corner-left {
    display: none;
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
    /* Keeps the title's right edge clear of the absolutely-positioned favorite button. */
    padding-right: 48px;
  }

  .summary-card__title {
    grid-area: title;
    grid-column: auto;
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

/* Compact, left-aligned row (not a stretched grid) per direct request 2026-09-11 — down to just
   3 fields (see summaryColumns' own comment on why), a grid that stretched to fill the card's
   full width left two large fields floating in mostly-empty space on anything wider than a
   phone. flex-wrap so it still degrades gracefully on a narrow viewport instead of overflowing.
   UA-default dl/dd margins zeroed — this row's own padding/border does the spacing. */
.summary-card__grid {
  display: flex;
  flex-wrap: wrap;
  margin: 24px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.summary-card__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 24px;
}

.summary-card__field:first-child {
  padding-left: 0;
}

/* Thin dividers between fields instead of a gap — same decorative-separator role (not a UI
   component conveying its own information) as this card's own border-top just above, so it
   reuses that same border token rather than introducing a second one. */
.summary-card__field:not(:last-child) {
  border-right: 1px solid var(--el-border-color-lighter);
}

.summary-card__label {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.summary-card__value {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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

@media (max-width: 600px) {
  .summary-card__grid {
    gap: 12px 0;
  }

  .summary-card__field {
    flex: 1 1 33%;
    padding: 0 12px;
  }

  /* Sticky pinned bar removed on mobile 2026-09-15 per direct request ("個股瀏覽 手機版不要貼頂的
     bar") — the condensed bar's own horizontal row has even less room to work with than the full
     card already struggled with, and mobile.vue's own floating Home button already gives a way
     back up. showStickyBar's own IntersectionObserver logic is untouched — it still flips
     true/false the same as before, this just stops it from rendering anything at this width. */
  .summary-card__sticky-bar {
    display: none;
  }
}

.summary-card__qr-image {
  display: block;
  margin: 0 auto;
}
</style>
