<script setup lang="ts">
import type { ShareColumn } from '~/composables/share/useShares'
import type { PublicHolding } from '~/components/holdings/HoldingsSharedView.vue'

// 分享出去的觀察清單或持股（2026-10-19，SharedShareButton 建的連結）：有連結就能看、免登入，內容即時——每次打開都讀
// 業務中台 的公開 API（GET /public/shares/{token}），只回分享時勾的欄位推得出來的東西；擁有者是誰不顯示。不給搜尋引擎收錄、
// CDN 不快取（nuxt.config 的 routeRules '/share/**'）。
// 觀察清單跟 /watchlist 同一個 WatchlistTable、持股跟持股總覽同一張表（HoldingsSharedView），都是只讀。
// 只陳述資料：沒有公開目錄、排行、追蹤或異動通知（避開「跟單」），只多一句這是使用者分享的。
interface PublicWatchlistShare {
  kind: 'watchlist'
  name: string
  columns: ShareColumn[]
  items: { symbol: string; note?: string | null }[]
}
interface PublicHoldingsShare {
  kind: 'holdings'
  columns: ShareColumn[]
  // 算占比、報酬率用的收盤日；兩欄都沒勾時是 null
  asOf: string | null
  holdings: PublicHolding[]
}

const token = String(useRoute().params.token ?? '')
if (!SHARE_TOKEN_PATTERN.test(token)) throw createError({ statusCode: 404, statusMessage: '找不到這個分享連結', fatal: true })
const { data, error } = await useFetch<PublicWatchlistShare | PublicHoldingsShare>(`/api/core/public/shares/${token}`, { key: `share-${token}` })
// 關掉了、或網址不完整：同一個 404
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: '這個分享連結已經關閉，或網址不完整', fatal: true })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '分享的內容暫時無法取得', fatal: true })
const share = computed(() => data.value!)
const watchlist = computed(() => (share.value.kind === 'watchlist' ? share.value : null))
const holdings = computed(() => (share.value.kind === 'holdings' ? share.value : null))

// ---- 觀察清單 ----
const columns = computed(() => (watchlist.value?.columns ?? []).filter(column => column.key !== 'note').map(column => ({ field: column.key, label: column.label })))
const notes = computed(() => Object.fromEntries((watchlist.value?.items ?? []).flatMap(item => (item.note ? [[item.symbol, item.note]] : []))))
const codes = computed(() => (watchlist.value?.items ?? []).map(item => item.symbol))
const { data: schema } = await useFilterSchema()
const { rows, priceDate } = useWatchlistStocks(codes, computed(() => watchlistCatalogFields(columns.value, schema.value.categories)))

// ---- 標題列：檔數與收盤日 ----
const count = computed(() => (holdings.value ? holdings.value.holdings.length : codes.value.length))
const shortDate = (date: string | null | undefined) => (date ? `${date.slice(5).replace('-', '/')} 收盤` : null)
const dateText = computed(() => shortDate(holdings.value ? holdings.value.asOf : priceDate.value))
const subject = computed(() => (holdings.value ? '持股' : '觀察清單'))

const title = computed(() => (watchlist.value ? `${watchlist.value.name}・分享的觀察清單` : '分享的持股'))
const description = computed(() => `安盈選股使用者分享的${subject.value}，共 ${count.value} 檔`)
useSeoMeta({ title, ogTitle: title, description, ogDescription: description, robots: 'noindex, nofollow' })
</script>

<template>
  <!-- 不用 .app-page：它是 24px 間距的 flex 欄，WatchlistTable 有好幾個根元素（工具列、表格、卡片），每一個之間都會多出 24px -->
  <div class="share-page">
    <h1 class="app-page__title share-page__title">
      {{ watchlist ? watchlist.name : '分享的持股' }}
      <span v-if="count" class="share-page__count">共 {{ count }} 檔<template v-if="dateText">・{{ dateText }}</template></span>
    </h1>
    <p class="share-page__note">這份{{ subject }}由安盈選股的使用者分享。</p>

    <el-empty v-if="!count" :description="`這份${subject}目前沒有股票`" :image-size="64" />
    <HoldingsSharedView v-else-if="holdings" :columns="holdings.columns" :holdings="holdings.holdings" />
    <WatchlistTable v-else :rows="rows" :columns="columns" :notes="notes" order-label="清單順序" storage-key="watchlist-share" />

    <p v-if="count" class="share-page__note share-page__hint">想追蹤其中幾檔？點名稱進個股頁，按星號加到你的觀察清單。</p>
  </div>
</template>

<style scoped>
.share-page__title {
  margin-bottom: 8px;
}

.share-page__count {
  margin-left: 8px;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

.share-page__note {
  margin: 0 0 16px;
  color: var(--el-text-color-regular);
}

.share-page__hint {
  margin: 16px 0 0;
}
</style>
