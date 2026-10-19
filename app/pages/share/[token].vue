<script setup lang="ts">
import type { ShareColumn } from '~/composables/share/useShares'

// 分享出去的觀察清單（2026-10-19，SharedShareButton 建的連結）：有連結就能看、免登入，內容即時——每次打開都讀
// 業務中台 的公開 API（GET /public/shares/{token}），只回分享時勾的欄位；擁有者是誰不顯示。不給搜尋引擎收錄、CDN 不快取
// （nuxt.config 的 routeRules '/share/**'）。畫法跟 /watchlist 同一個 WatchlistTable，只讀：沒有操作欄、不能拖欄位。
// 只陳述資料：沒有公開目錄、排行、追蹤或異動通知（避開「跟單」），只多一句這是使用者分享的。
interface PublicWatchlistShare {
  kind: 'watchlist'
  name: string
  columns: ShareColumn[]
  items: { symbol: string; note?: string | null }[]
}

const token = String(useRoute().params.token ?? '')
if (!SHARE_TOKEN_PATTERN.test(token)) throw createError({ statusCode: 404, statusMessage: '找不到這個分享連結', fatal: true })
const { data, error } = await useFetch<PublicWatchlistShare | { kind: string }>(`/api/core/public/shares/${token}`, { key: `share-${token}` })
// 關掉了、或網址不完整：同一個 404。持股的分享頁還沒做（第二階段），先當作找不到
if (error.value?.statusCode === 404 || (data.value && data.value.kind !== 'watchlist')) throw createError({ statusCode: 404, statusMessage: '這個分享連結已經關閉，或網址不完整', fatal: true })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '分享的清單暫時無法取得', fatal: true })
const share = computed(() => data.value as PublicWatchlistShare)

const columns = computed(() => share.value.columns.filter(column => column.key !== 'note').map(column => ({ field: column.key, label: column.label })))
const notes = computed(() => Object.fromEntries(share.value.items.flatMap(item => (item.note ? [[item.symbol, item.note]] : []))))
const codes = computed(() => share.value.items.map(item => item.symbol))
const { data: schema } = await useFilterSchema()
const { rows, priceDate } = useWatchlistStocks(codes, computed(() => watchlistCatalogFields(columns.value, schema.value.categories)))
const priceDateText = computed(() => (priceDate.value ? `${priceDate.value.slice(5).replace('-', '/')} 收盤` : null))

const title = computed(() => `${share.value.name}・分享的觀察清單`)
const description = computed(() => `安盈選股使用者分享的觀察清單，共 ${codes.value.length} 檔`)
useSeoMeta({ title, ogTitle: title, description, ogDescription: description, robots: 'noindex, nofollow' })
</script>

<template>
  <!-- 不用 .app-page：它是 24px 間距的 flex 欄，WatchlistTable 有好幾個根元素（工具列、表格、卡片），每一個之間都會多出 24px -->
  <div class="share-page">
    <h1 class="app-page__title share-page__title">
      {{ share.name }}
      <span v-if="codes.length" class="share-page__count">共 {{ codes.length }} 檔<template v-if="priceDateText">・{{ priceDateText }}</template></span>
    </h1>
    <p class="share-page__note">這份觀察清單由安盈選股的使用者分享。</p>

    <el-empty v-if="!codes.length" description="這份清單目前沒有股票" :image-size="64" />
    <WatchlistTable v-else :rows="rows" :columns="columns" :notes="notes" order-label="清單順序" storage-key="watchlist-share" />

    <p v-if="codes.length" class="share-page__note share-page__hint">想追蹤其中幾檔？點名稱進個股頁，按星號加到你的觀察清單。</p>
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
