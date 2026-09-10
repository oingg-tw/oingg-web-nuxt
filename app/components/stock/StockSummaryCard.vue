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
</script>

<template>
  <!-- Condensed pinned bar — logo/name/code/price/change only, no #actions slot (the "顯示卡片"
       settings popover a caller may pass in there) to keep this from becoming a second full
       toolbar competing with the real card's own once both exist in the DOM at once; the
       favorite button stays since toggling a watchlist star while browsing is common enough to
       be worth keeping one tap away. Own aria-label (not a plain duplicate of the real card's
       "加入最愛" button) so two buttons with identical accessible names don't both show up in a
       screen reader's list of page controls at the same time. top offset matches the fixed
       app-shell header's own height (--app-header-height/--app-banner-height, see
       desktop.vue/mobile.vue's own use of the same vars) so this bar sits flush beneath it
       instead of overlapping. -->
  <div v-if="showStickyBar" class="summary-card__sticky-bar">
    <img
      v-if="logoUrl && !logoFailed"
      :src="logoUrl"
      :alt="`${stock.name} logo`"
      class="summary-card__sticky-logo"
    >
    <span class="summary-card__sticky-name">{{ stock.name }}<span class="summary-card__sticky-code">{{ stock.code }}</span></span>
    <span class="summary-card__sticky-price">
      {{ stock.price.toFixed(2) }}
      <span :class="stock.change > 0 ? 'is-up' : stock.change < 0 ? 'is-down' : ''">
        {{ formatStockValue(stock, 'change') }} ({{ formatStockValue(stock, 'changePercent') }}%)
      </span>
    </span>
    <el-button
      :type="isFavorite ? 'primary' : 'default'"
      :icon="isFavorite ? StarFilled : Star"
      circle
      size="small"
      aria-label="加入最愛（頂部工具列）"
      class="summary-card__sticky-favorite"
      @click="emit('toggleFavorite')"
    />
  </div>

  <el-card ref="cardRef" class="summary-card" shadow="never">
    <div class="summary-card__header">
      <div class="summary-card__identity">
        <img
          v-if="logoUrl && !logoFailed"
          :src="logoUrl"
          :alt="`${stock.name} logo`"
          class="summary-card__logo"
          @error="logoFailed = true"
        >
        <h1 class="summary-card__name">
          {{ stock.name }}
          <span class="summary-card__code">{{ stock.code }}</span>
        </h1>
      </div>
      <div class="summary-card__actions">
        <!-- Favorite button first, then caller-supplied extras (e.g. StockDetailActions'
             "顯示卡片" picker on the stock detail page) — order swapped per direct request
             ("顯示卡片與加入最愛的icon位置調換"). This card stays a plain summary/favorite-toggle
             component with no knowledge of what a caller chooses to add alongside it. -->
        <el-button
          :type="isFavorite ? 'primary' : 'default'"
          :icon="isFavorite ? StarFilled : Star"
          circle
          title="加入最愛"
          @click="emit('toggleFavorite')"
        />
        <slot name="actions" />
      </div>
    </div>
    <div class="summary-card__price">
      <span class="summary-card__price-value">{{ stock.price.toFixed(2) }}</span>
      <span :class="stock.change > 0 ? 'is-up' : stock.change < 0 ? 'is-down' : ''">
        {{ formatStockValue(stock, 'change') }} ({{ formatStockValue(stock, 'changePercent') }}%)
      </span>
    </div>

    <div class="summary-card__grid">
      <div v-for="column in summaryColumns" :key="column.key" class="summary-card__field">
        <span class="summary-card__label">{{ column.label }}</span>
        <span class="summary-card__value">{{ formatStockValue(stock, column.key) }}{{ column.unit }}</span>
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
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  margin-bottom: 16px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: color-mix(in srgb, var(--el-bg-color) 85%, transparent);
  backdrop-filter: blur(8px);
}

.summary-card__sticky-logo {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  object-fit: contain;
  border-radius: 4px;
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
  min-width: 0;
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

.summary-card__sticky-favorite {
  flex-shrink: 0;
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
  gap: 10px;
  min-width: 0;
}

/* object-fit: contain (not cover) — a logo's own aspect ratio matters, unlike a photo where
   cropping to fill a fixed box is fine. border-radius softens the hard edge Brandfetch's own
   icon crop sometimes leaves, without going as far as a full circle (a wordmark-shaped logo
   would clip badly inside one). */
.summary-card__logo {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 6px;
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
  font-size: 18px;
  font-weight: 600;
}

.summary-card__code {
  font-size: 16px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  margin-left: 6px;
}

.summary-card__price {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 6px;
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
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.summary-card__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 20px;
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
