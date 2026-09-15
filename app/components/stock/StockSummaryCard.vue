<script setup lang="ts">
import { Star, StarFilled } from '@element-plus/icons-vue'
import type { Stock } from '~/composables/stock/useStocks'
import { companyLogoUrl } from '~/utils/company-logo'

const props = defineProps<{
  stock: Stock
  // company_profile's website field, passed through from useCompanyProfile — null while
  // that's still loading/unavailable, same as any other unbacked field on this page.
  website: string | null
  isFavorite: boolean
}>()

const emit = defineEmits<{
  toggleFavorite: []
}>()

const { columns } = useStocks()

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
      v-if="logoUrl && !logoFailed"
      :src="logoUrl"
      :alt="`${stock.name} logo`"
      class="summary-card__sticky-logo"
      @error="logoFailed = true"
    >
    <span class="summary-card__sticky-name">{{ stock.name }}<span class="summary-card__sticky-code">{{ stock.code }}</span></span>
    <span class="summary-card__sticky-price">
      {{ stock.price.toFixed(2) }}
      <span :class="(stock.change ?? 0) > 0 ? 'is-up' : (stock.change ?? 0) < 0 ? 'is-down' : ''">
        {{ formatStockValue(stock, 'change') }} ({{ formatStockValue(stock, 'changePercent') }}%)
      </span>
    </span>
    <div class="summary-card__sticky-actions">
      <slot name="actions" />
    </div>
  </div>

  <el-card ref="cardRef" class="summary-card" shadow="never">
    <!-- Restructured 2026-09-14 per direct request ("個股summary 公司 logo 請更大" then, once a
         plain size bump wasn't what was meant, "logo放在左邊 公司名稱與股價放右邊 公司名稱在股價
         上面") — logo enlarged and moved to anchor the left side of a two-line identity block
         (name+code+favorite on top, price+change below), instead of sitting inline in a single
         name row with price as a separate section underneath. -->
    <div class="summary-card__header">
      <div class="summary-card__identity">
        <img
          v-if="logoUrl && !logoFailed"
          :src="logoUrl"
          :alt="`${stock.name} logo`"
          class="summary-card__logo"
          @error="logoFailed = true"
        >
        <div class="summary-card__identity-text">
          <h1 class="summary-card__name">
            {{ stock.name }}
            <span class="summary-card__code">{{ stock.code }}</span>
            <!-- Moved here, right after the code, per direct request 2026-09-12 ("加入最愛 放到
                 公司代碼後面") — was previously grouped with StockDetailActions' own controls in
                 .summary-card__actions. Recolored the same day ("看起來醜" — the default `type`
                 circle button read as an unstyled grey dot in dark mode, both `--el-button-bg-
                 color`/`--el-button-border-color` sit too close to the card's own background at
                 that lightness). `warning` (amber) is this app's existing star/favorite-adjacent
                 color elsewhere (StockExDividendCard.vue/AttentionStockCard.vue) — `plain` gives a
                 theme-correct tinted outline when unfavorited, full amber fill when favorited,
                 without introducing a new color token. Sticky-bar's own favorite button below gets
                 the identical treatment for the same reason. -->
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
          </h1>
          <div class="summary-card__price">
            <span class="summary-card__price-value">{{ stock.price.toFixed(2) }}</span>
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

    <div class="summary-card__grid">
      <div v-for="column in summaryColumns" :key="column.key" class="summary-card__field">
        <span class="summary-card__label">{{ column.label }}</span>
        <!-- No unit suffix when the value itself is the '－' missing-data placeholder (per/pbr/
             dividendYield can now genuinely be null — see Stock's own comment in useStocks.ts) —
             "－%" reads like a broken value, not a clean placeholder. -->
        <span class="summary-card__value">{{ formatStockValue(stock, column.key) }}{{ stock[column.key] !== null ? column.unit : '' }}</span>
      </div>
    </div>
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
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.summary-card__sticky-code {
  margin-left: 6px;
  font-size: 16px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.summary-card__sticky-price {
  flex: 1;
  min-width: 140px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 16px;
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

.summary-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.summary-card__identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

/* Stacks name (with code/favorite) above price+change — see .summary-card__header's own template
   comment for the 2026-09-14 restructure this belongs to. */
.summary-card__identity-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* object-fit: contain (not cover) — a logo's own aspect ratio matters, unlike a photo where
   cropping to fill a fixed box is fine. border-radius softens the hard edge Brandfetch's own
   icon crop sometimes leaves, without going as far as a full circle (a wordmark-shaped logo
   would clip badly inside one). Enlarged 32px→64px 2026-09-14 per direct request ("個股summary
   公司 logo 請更大") — now anchors the left side of the identity block as a real avatar, not an
   inline icon next to the name text, so it needed to be sized to match that role. */
.summary-card__logo {
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

/* Real <h1> now (docs/ui-ux/Taiwan Web Accessibility Guidelines.md — stock/[code].vue was
   the one page in the app with no heading at all, so a screen reader's "jump by heading"
   navigation had nowhere to land), so the browser's UA-default h1 margin needs zeroing out
   here — this component's own layout already handles spacing via .summary-card__header's
   flex gap. */
.summary-card__name {
  margin: 0;
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
}

.summary-card__code {
  font-size: 16px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  margin-left: 6px;
}

.summary-card__favorite {
  margin-left: 16px;
}

.summary-card__price {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.summary-card__price-value {
  font-size: 40px;
  font-weight: 600;
  line-height: 1;
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
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.summary-card__value {
  font-size: 16px;
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
</style>
