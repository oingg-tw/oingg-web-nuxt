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
  // [code].vue's own stockShortName already established for StockBetaComparisonChart.vue's title
  // (see that computed's own comment) — not derived independently here, so both places stay in
  // sync automatically. Falls back to the full name itself at the call site, same "graceful
  // degrade" convention as stockShortName's own definition.
  shortName: string
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
  const title = `${props.stock.name} ${props.stock.code}`
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

// The --app-stock-summary-bar-height publishing ResizeObserver that used to live here (added
// 2026-09-14 for the tab strip's own sticky-top calc) is gone 2026-09-15 along with that tab
// strip itself (see stock/[code].vue's own comment — "tabs 貼頂機制還是拿掉，佔用太多顯示空間
// 了") — this bar had no other reason to measure/publish its own height, so removed rather than
// left computing a var nothing reads anymore.
</script>

<template>
  <!-- Condensed pinned bar — logo/name/code/price/change/actions only; the favorite button stays
       since toggling a watchlist star while browsing is common enough to be worth keeping one tap
       away. Own aria-label on the favorite button (not a plain duplicate of the real card's
       "加入最愛" button) so two buttons with identical accessible names don't both show up in a
       screen reader's list of page controls at the same time. top offset matches the fixed
       app-shell header's own height (--app-header-height/--app-banner-height, see
       desktop.vue/mobile.vue's own use of the same vars) so this bar sits flush beneath it
       instead of overlapping.

       #actions slot invoked a SECOND time here 2026-09-15 per direct request ("顯示設定 也要加到
       貼頂的 bar 我認為 summary右上角那邊可以做成元件，免得兩邊跑") — until now this bar hand-
       mounted its own bare `<StockExperienceModeSelect size="small" />`, missing the 顯示設定 gear
       (StockDetailActions.vue) the full card's own header has. Rather than duplicating
       StockDetailActions' markup/props here too, this just calls the SAME named slot the parent
       page already fills once (see stock/[code].vue's own `<template #actions>`) — Vue renders a
       slot's content fresh at every call site, so the caller still only ever authors this control
       group once, and both places (full header + sticky bar) automatically stay in sync with
       whatever that slot contains, present or future. Each render is its own component instance
       with independent local dialog state (same pattern the favorite button next to it already
       uses) — opening 顯示設定 from the sticky bar doesn't also pop it open in the real header. -->
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
    <span class="summary-card__sticky-name">{{ stock.name }}<span class="summary-card__sticky-code">{{ stock.code }}</span></span>
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
      <slot name="actions" />
    </div>
  </div>

  <el-card ref="cardRef" class="summary-card" shadow="never">
    <!-- Mobile-only redesign 2026-09-16, worked out via an Artifact mockup review before touching
         this file (see that conversation for the step-by-step: "summary 想把代碼與公司名稱移動到
         卡片置頂" → "分享 QR Code 我的最愛 如果位置固定呢？" → "PER PBR 殖利率放上去呢" → "Logo
         左邊 其他右邊 股價變動放在股價下面" → "公司名稱用短名不用全名" → "中間那塊水平置中" →
         "字最小要 16px", confirmed "完美") — THEN scoped to mobile only per further direct
         follow-ups ("summary 在電腦版與手機板不同。電腦版不會有share 與QR Code。所以電腦版請維持
         舊版靠左。" then "電腦版不會有share btn"): desktop (`.summary-card__desktop` below)
         reverts to the pre-redesign markup with the share button dropped too (logo left,
         name+code+favorite only on top, price below, left-aligned — no share, no QR button,
         both mobile-only), while the new title/corner-icon/centered layout
         (`.summary-card__mobile` further down) only applies at mobile width. Both trees render
         in the SSR/hydration payload and a CSS media query (not v-if) picks which one is visible
         — same "no JS width check" convention this card's own 全名/短名 toggle already
         established, avoiding a full DOM swap after hydration a JS width-based v-if would cause. -->
    <div class="summary-card__desktop">
      <div class="summary-card__header">
        <div class="summary-card__desktop-identity">
          <img
            v-if="mounted && logoUrl && !logoFailed"
            :src="logoUrl"
            :alt="`${stock.name} logo`"
            class="summary-card__desktop-logo"
            @error="logoFailed = true"
            @load="onLogoLoad"
          >
          <div class="summary-card__identity-text">
            <h1 class="summary-card__desktop-name">
              {{ stock.name }}
              <span class="summary-card__name-meta">
                <span class="summary-card__code">{{ stock.code }}</span>
                <el-button
                  type="warning"
                  :plain="!isFavorite"
                  :icon="isFavorite ? StarFilled : Star"
                  circle
                  size="small"
                  title="加入最愛"
                  :aria-pressed="isFavorite"
                  class="summary-card__favorite"
                  @click="emit('toggleFavorite')"
                />
              </span>
            </h1>
            <div class="summary-card__desktop-price">
              <span class="summary-card__desktop-price-value">{{ stock.price.toFixed(2) }}</span>
              <span :class="(stock.change ?? 0) > 0 ? 'is-up' : (stock.change ?? 0) < 0 ? 'is-down' : ''">
                {{ formatStockValue(stock, 'change') }} ({{ formatStockValue(stock, 'changePercent') }}%)
              </span>
            </div>
          </div>
        </div>
        <div class="summary-card__actions">
          <slot name="actions" />
        </div>
      </div>
    </div>

    <div class="summary-card__mobile">
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
           unfavorited, full amber fill when favorited, without introducing a new color token.
           Sticky-bar's own favorite button below gets the identical treatment for the same
           reason. -->
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
      <slot name="actions" />
    </div>

    <!-- 短名＋代碼, 置頂置中, per "summary 想把代碼與公司名稱移動到卡片置頂" then "公司名稱用
         短名不用全名" — shortName already falls back to the full legal name at the call site
         (see this component's own prop comment) when no normalized short name is available, so
         this never renders empty. Real <h1> so a screen reader's own "jump by heading"
         navigation still lands here (this page's own long-standing a11y requirement). -->
    <h1 class="summary-card__title">
      <span class="summary-card__name">{{ shortName }}</span>
      <span class="summary-card__code">{{ stock.code }}</span>
    </h1>

    <!-- Logo (left) + price block (right) as one group, the group itself centered in the card
         per "Logo 左邊 其他右邊" then "中間那塊水平置中" — price/change stacked (漲跌幅換到股價
         正下方) per "股價變動放在股價下面". -->
    <div class="summary-card__identity">
      <img
        v-if="mounted && logoUrl && !logoFailed"
        :src="logoUrl"
        :alt="`${stock.name} logo`"
        class="summary-card__logo"
        @error="logoFailed = true"
        @load="onLogoLoad"
      >
      <div class="summary-card__price">
        <span class="summary-card__price-value">{{ stock.price.toFixed(2) }}</span>
        <span class="summary-card__price-change" :class="(stock.change ?? 0) > 0 ? 'is-up' : (stock.change ?? 0) < 0 ? 'is-down' : ''">
          {{ formatStockValue(stock, 'change') }} ({{ formatStockValue(stock, 'changePercent') }}%)
        </span>
      </div>
    </div>
    </div>

    <div class="summary-card__grid">
      <div v-for="column in summaryColumns" :key="column.key" class="summary-card__field">
        <span class="summary-card__label">{{ column.label }}</span>
        <!-- No unit suffix when the value itself is the '－' missing-data placeholder (per/pbr/
             dividendYield can now genuinely be null — see Stock's own comment in useStocks.ts) —
             "－%" reads like a broken value, not a clean placeholder. -->
        <span class="summary-card__value">{{ formatStockValue(stock, column.key) }}{{ stock[column.key] !== null ? column.unit : '' }}</span>
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
    </el-dialog>
  </el-card>
</template>

<style scoped>
.summary-card {
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
  /* Real bug fixed 2026-09-14 (caught live while verifying the new 顯示模式 toggle added below):
     at ~400px this row previously had no wrap, and .sticky-price's own `flex:1; min-width:0`
     let it get squeezed all the way down to 0 width once the new 3-button radio-group + the
     favorite button didn't fit — the price/change simply vanished, not just truncated, since
     min-width:0 has no floor. Wrapping lets 顯示模式/加入最愛 drop to their own second row
     instead of stealing the price's space on the first. */
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

/* Wraps the #actions slot content (StockExperienceModeSelect + 顯示設定 gear, see this bar's own
   template comment) so it sits inline with everything else in the row without its own internal
   gap collapsing into the bar's outer flex-wrap gap. */
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
   real vertical rule in the gap after it, same "explicit divider, not just extra whitespace"
   choice this app already made for its tab strip (see stock/[code].vue's own tab border-right). */
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

/* Desktop/mobile split 2026-09-16 ("summary 在電腦版與手機板不同...電腦版請維持舊版靠左") — both
   trees render in the SSR/hydration payload (see this pair's own template comment), a plain CSS
   media query decides which is visible so there's no JS width check or post-hydration DOM swap.
   Desktop is the default (this card's own overall visible width is well above 600px in the
   desktop shell — see stock/[code].vue's own "手機版" 600px convention this reuses); the mobile
   block only takes over inside the mobile shell's own narrow width. */
.summary-card__desktop {
  display: block;
}

.summary-card__mobile {
  display: none;
}

@media (max-width: 600px) {
  .summary-card__desktop {
    display: none;
  }

  .summary-card__mobile {
    display: block;
  }
}

/* Restructured 2026-09-14 per direct request ("個股summary 公司 logo 請更大" then, once a plain
   size bump wasn't what was meant, "logo放在左邊 公司名稱與股價放右邊 公司名稱在股價上面") — logo
   enlarged and moved to anchor the left side of a two-line identity block (name+code+favorite on
   top, price+change below), instead of sitting inline in a single name row with price as a
   separate section underneath. This is now the DESKTOP-only version of that layout (see the
   split comment above) — reverted here to exactly this pre-2026-09-16-redesign shape per direct
   request. */
.summary-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.summary-card__desktop-identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

/* Stacks name (with code/favorite) above price+change — see .summary-card__header's own comment
   for the 2026-09-14 restructure this belongs to. */
.summary-card__identity-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* object-fit: contain (not cover) — a logo's own aspect ratio matters, unlike a photo where
   cropping to fill a fixed box is fine. border-radius softens the hard edge Brandfetch's own icon
   crop sometimes leaves, without going as far as a full circle (a wordmark-shaped logo would clip
   badly inside one). Enlarged 32px→64px 2026-09-14 per direct request ("個股summary 公司 logo
   請更大") — anchors the left side of the identity block as a real avatar, not an inline icon
   next to the name text. */
.summary-card__desktop-logo {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  object-fit: contain;
  border-radius: 10px;
  overflow: hidden;
}

.summary-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Real <h1> (docs/ui-ux/Taiwan Web Accessibility Guidelines.md — stock/[code].vue was the one
   page in the app with no heading at all, so a screen reader's own "jump by heading" navigation
   had nowhere to land), so the browser's UA-default h1 margin needs zeroing out here — this
   component's own layout already handles spacing via .summary-card__header's flex gap. */
.summary-card__desktop-name {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-size: 1.125rem;
  font-weight: 600;
}

/* 代碼＋收藏按鈕 grouped so they wrap onto a new line TOGETHER once the name doesn't leave room
   for them (see .summary-card__desktop-name's own template comment) — flex-shrink:0 keeps this
   whole group from being squeezed/wrapped internally, it either fits on the name's own line or
   moves as one unit. */
.summary-card__name-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.summary-card__desktop-price {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.summary-card__desktop-price-value {
  font-size: 2.5rem;
  font-weight: 600;
  line-height: 1;
}

/* position:relative anchor for the two mobile-only corner icon groups below — el-card's own root
   is this component's outermost box, so absolute children here measure top/left/right against
   the whole card's edge (including its own padding), landing them in the visual corners rather
   than relative to some inner content box. Harmless at desktop width even though the corner
   groups themselves are display:none there (see the desktop/mobile split above). */
.summary-card {
  position: relative;
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

/* 短名＋代碼置頂置中 — 2026-09-16 redesign. Real <h1> (docs/ui-ux/Taiwan Web Accessibility
   Guidelines.md — stock/[code].vue was the one page in the app with no heading at all, so a
   screen reader's own "jump by heading" navigation had nowhere to land). Side padding clears the
   two absolutely-positioned corner icon groups so a long name+code combination centers within
   the remaining space instead of visually colliding with either icon group. */
.summary-card__title {
  margin: 0 0 16px;
  padding: 0 40px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  gap: 4px 8px;
  text-align: center;
}

.summary-card__name {
  font-size: 1rem;
  font-weight: 700;
}

.summary-card__code {
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

/* Logo (left) + price block (right) as one group, the group itself centered in the card —
   2026-09-16 redesign ("Logo 左邊 其他右邊" then "中間那塊水平置中"). */
.summary-card__identity {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* object-fit: contain (not cover) — a logo's own aspect ratio matters, unlike a photo where
   cropping to fill a fixed box is fine. border-radius softens the hard edge Brandfetch's own
   icon crop sometimes leaves, without going as far as a full circle (a wordmark-shaped logo
   would clip badly inside one). One size at every width since the 2026-09-16 redesign unified
   the layout itself across breakpoints — the previous 64px desktop/40px mobile split existed
   only to fit the old, differently-structured layouts each width used to have. */
.summary-card__logo {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 10px;
  overflow: hidden;
}

/* Price stacked above change/percent (2026-09-16 redesign, "股價變動放在股價下面") — replaces the
   previous same-line baseline-aligned pair. */
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

/* Compact, left-aligned row (not a stretched grid) per direct request 2026-09-11 — down to just
   3 fields (see summaryColumns' own comment on why), a grid that stretched to fill the card's
   full width left two large fields floating in mostly-empty space on anything wider than a
   phone. flex-wrap so it still degrades gracefully on a narrow viewport instead of overflowing. */
.summary-card__grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 24px;
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

/* PER/PBR/殖利率 grid still gets its own tighter mobile layout — unrelated to the 2026-09-16
   identity/title redesign above (that one now applies at every width, no @media split needed),
   this narrower 3-way flex-wrap split predates it and wasn't part of that mockup review, so left
   as-is. */
@media (max-width: 600px) {
  .summary-card__grid {
    gap: 12px 0;
  }

  .summary-card__field {
    flex: 1 1 33%;
    padding: 0 12px;
  }
}

/* Sticky pinned bar removed on mobile 2026-09-15 per direct request ("個股瀏覽 手機版不要貼頂的
   bar") — the condensed bar's own horizontal row (logo/name/price/顯示模式/齒輪) has even less
   room to work with than the full card already struggled with above, and mobile.vue's own shell
   doesn't have the same "30+ cards below, want the identity visible while scrolling" pressure a
   desktop pinned sidebar layout does (its own floating Home button already gives a way back up).
   showStickyBar's own IntersectionObserver logic is untouched — it still flips true/false the
   same as before, this just stops it from rendering anything at this width. */
@media (max-width: 600px) {
  .summary-card__sticky-bar {
    display: none;
  }
}

.summary-card__qr-image {
  display: block;
  margin: 0 auto;
}
</style>
