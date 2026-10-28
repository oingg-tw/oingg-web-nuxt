<script setup lang="ts">
import type { ShareColumn } from '~/composables/share/useShares'
import type { PublicHolding } from '~/components/holdings/HoldingsSharedView.vue'
import type { HoldingsTraitsResult } from '~/utils/holdings-traits'

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
  // 分享者自己填的名稱（業務中台 40b115c，2026-10-20），null 是沒填
  displayName: string | null
  columns: ShareColumn[]
  // 算占比、報酬率用的收盤日；兩欄都沒勾時是 null
  asOf: string | null
  holdings: PublicHolding[]
  // 勾了「持股特色」才有（2026-10-19）：跟擁有者在持股分析頁看到的同一份
  traits?: HoldingsTraitsResult
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
// 分享時存的欄位也換成留下來的那一支（replaced-metrics.ts，例如殖利率 2026-10-24 改讀自算），同觀察清單
const columns = computed(() => (watchlist.value?.columns ?? []).filter(column => column.key !== 'note').map(column => ({ field: replacedField(column.key), label: column.label })))
const notes = computed(() => Object.fromEntries((watchlist.value?.items ?? []).flatMap(item => (item.note ? [[item.symbol, item.note]] : []))))
const codes = computed(() => (watchlist.value?.items ?? []).map(item => item.symbol))
const { data: schema } = await useFilterSchema()
const { rows, priceDate } = useWatchlistStocks(codes, computed(() => watchlistCatalogFields(columns.value, schema.value.categories)))

// ---- 標題列：檔數與收盤日 ----
const count = computed(() => (holdings.value ? holdings.value.holdings.length : codes.value.length))
const shortDate = (date: string | null | undefined) => (date ? `${date.slice(5).replace('-', '/')} 收盤` : null)
const dateText = computed(() => shortDate(holdings.value ? holdings.value.asOf : priceDate.value))
const subject = computed(() => (holdings.value ? '持股' : '觀察清單'))

// 持股的標題是「○○分享的持股」（使用者 2026-10-20：「頁面要加上 XXX分享的持股 標題，好把整個分享持股放到觀察清單自動命名」），
// 名字是分享者在分享對話框自己填的，沒填就是「分享的持股」。存成觀察清單時也用這個當清單名
const heading = computed(() => (watchlist.value ? watchlist.value.name : `${holdings.value?.displayName ?? ''}分享的持股`))
const title = computed(() => (watchlist.value ? `${watchlist.value.name}・分享的觀察清單` : heading.value))
const description = computed(() => `安盈選股使用者分享的${subject.value}，共 ${count.value} 檔`)
useSeoMeta({ title, ogTitle: title, description, ogDescription: description, robots: 'noindex, nofollow' })

// ---- 存成我的觀察清單（2026-10-20，使用者：「分享的持股開放一個誘導註冊的按鈕，這個按鈕功能是把這個分享加到觀察清單」）----
// 有帳號就按一下存好；沒有就開登入（對話框寫明登入或註冊後會存好），登入回來接著存——LINE 登入會離開再回到這一頁、Email 註冊要先
// 驗證信箱，所以「要存」記在 sessionStorage。一次複製、之後不跟著分享變（使用者選的）。整批一次送，業務中台記住是從哪一條分享
// 存的（sourceShareToken）：存過、清單也還在，換台電腦來也直接連過去，不會存兩份
const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { open: openLogin } = useLoginDialog()
const { watchlists, importToWatchlist } = useStocks()
const PENDING_KEY = 'share-import-pending'
const symbols = computed(() => (holdings.value ? holdings.value.holdings.map(holding => holding.symbol) : codes.value))
const importing = ref(false)
const savedList = computed(() => watchlists.value.find(list => list.sourceShareToken === token) ?? null)

async function saveToWatchlist() {
  if (importing.value) return
  importing.value = true
  const result = await importToWatchlist(heading.value, symbols.value, token)
  importing.value = false
  if (result === 'signed-out') {
    try {
      sessionStorage.setItem(PENDING_KEY, token)
    } catch { /* 存不了就只是登入回來不會自動存 */ }
    openLogin(`免費註冊或登入後，這份${subject.value}會存成你的觀察清單「${heading.value}」。`)
    return
  }
  if (!result) return
  if (!result.created) ElMessage.info(`這份分享已經存過了：觀察清單「${result.list.name}」`)
  else ElMessage.success(`已存成觀察清單「${result.list.name}」，共 ${result.added} 檔${result.skipped.length ? `（${result.skipped.join('、')} 已下市或查不到，沒有加入）` : ''}`)
}

onMounted(() => {
  watch([authResolved, currentUser], ([resolved, user]) => {
    if (!resolved || !user) return
    let pending: string | null = null
    try {
      pending = sessionStorage.getItem(PENDING_KEY)
      if (pending === token) sessionStorage.removeItem(PENDING_KEY)
    } catch { /* 讀不到就不接著存 */ }
    if (pending === token) void saveToWatchlist()
  }, { immediate: true })
})
</script>

<template>
  <!-- 不用 .app-page：它是 24px 間距的 flex 欄，WatchlistTable 有好幾個根元素（工具列、表格、卡片），每一個之間都會多出 24px -->
  <!-- 2026-10-20 重新排（使用者：「share 頁面請再設計一下，讓他 UIUX 邏輯是通暢的」）：這是什麼 → 裡面有什麼 → 接下來做什麼。
       頁首同持股管理：標題與一行基本資料在左，整份存起來的動作在右（手機上換到下面、整行寬）；最後一句只講「挑幾檔」，跟整份分開 -->
  <div class="share-page">
    <header class="share-page__header">
      <div class="share-page__heading">
        <h1 class="app-page__title">{{ heading }}</h1>
        <p class="share-page__meta">安盈選股使用者分享<template v-if="count">・共 {{ count }} 檔</template><template v-if="dateText">・{{ dateText }}</template></p>
      </div>
      <!-- 存過的連到那一組；高度固定，按鈕換成連結時不推動下面的內容 -->
      <div v-if="count" class="share-page__actions">
        <NuxtLink v-if="savedList" :to="`/watchlist?list=${savedList.id}`" class="share-page__saved">已存成觀察清單「{{ savedList.name }}」</NuxtLink>
        <el-button v-else type="primary" class="share-page__save" :loading="importing" @click="saveToWatchlist">加到我的觀察清單</el-button>
      </div>
    </header>

    <el-empty v-if="!count" :description="`這份${subject}目前沒有股票`" :image-size="64" />
    <template v-else-if="holdings">
      <!-- 持股特色在表格上面（2026-10-19，使用者：「造訪的人就可以看出這一組持股的特色」），之後才是各檔 -->
      <HoldingsTraits v-if="holdings.traits" class="share-page__traits" :traits="traitsFromGo(holdings.traits)" heading-id="share-traits-title" />
      <h2 v-if="holdings.traits" class="share-page__section-title">持有哪幾檔？</h2>
      <HoldingsSharedView :columns="holdings.columns" :holdings="holdings.holdings" />
    </template>
    <WatchlistTable v-else :rows="rows" :columns="columns" :notes="notes" order-label="清單順序" storage-key="watchlist-share" />

    <p v-if="count" class="share-page__hint">只想追蹤其中幾檔？點名稱進個股頁，按星號加入。</p>
  </div>
</template>

<style scoped>
/* 頁首：同持股管理的頁首（標題在左、動作在右，放不下就換行） */
.share-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 24px;
}

.share-page__meta {
  margin: 4px 0 0;
  color: var(--el-text-color-regular);
}

.share-page__actions {
  display: flex;
  align-items: center;
  min-height: 44px;
}

.share-page__save {
  min-height: 44px;
}

/* 手機：整份存起來是這一頁唯一的主要動作，換到標題下面、整行寬 */
@media (max-width: 639px) {
  .share-page__actions {
    flex: 1 1 100%;
  }

  .share-page__save {
    width: 100%;
  }
}

.share-page__hint {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
}

.share-page__saved {
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.share-page__traits {
  margin-bottom: 32px;
}

.share-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}
</style>
