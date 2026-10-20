<script setup lang="ts">
// 持股七頁共用的外殼（2026-10-08）：標題列（h1、副標、右側動作）、HoldingsNav、訪客的登入提示卡，然後才是頁面內容。原本七頁各寫
// 一份（每頁一組 mounted／authResolved／openLogin 加約 50 行 CSS）。
// 選元件不選父路由：持股總覽的動作區依頁面狀態變化、各頁標題不同，專案裡也沒有父路由的先例。
// 各頁自己的資料載入（watch([authResolved, uid, range])）留在頁面裡，這裡只管「畫哪一層」與「還在不在讀」。
const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  guestTitle: string
  guestText?: string
  // 頁面第一份資料還沒到。之後的重新讀取（換期間）照舊是頁面區塊自己的 v-loading
  pending?: boolean
}>(), { subtitle: undefined, guestText: '持股資料存在你的帳號裡，只有你看得到。', pending: false })

// 內容的 slot 拿到 loading：還在讀（登入狀態未定、帳戶清單或頁面第一份資料還沒到）時，頁面照樣畫標題、說明、表頭，只把資料換成同樣大小
// 的骨架（.app-skeleton）——2026-10-20 使用者：「載入之前，可以讓用戶看的出來畫面結構，確定自己沒跑錯地方」「然後不要閃動」。
// 原本整塊換成一個轉圈，內容到齊才一起出來
// 右上的動作區也拿得到（只有會員才是 true）：按鈕要從第一個畫面就在，手機上它們換行在標題下面，晚出現會把內容往下推
defineSlots<{ default?: (props: { loading: boolean }) => unknown; actions?: (props: { loading: boolean }) => unknown }>()

const authResolved = useAuthResolved()
const currentUser = useCurrentUser()
const { open: openLogin } = useLoginDialog()
// 登入狀態還沒確定時畫內容的骨架還是訪客卡：useMemberGate（觀察清單兩頁共用）
const { resolving, member } = useMemberGate()

// ---- 持股帳戶（2026-10-19，使用者：「持股（比如不同券商）」，選了「全部帳戶合併＋單一帳戶切換」）----
// 持股各頁都經過這裡，所以帳戶清單的載入、網址 ?account= 的同步只寫在這裡。切換在側欄（HoldingsNav 的 SharedScopeSwitch，同日搬過去：
// 「視覺上複雜度開始直線上升了」），新增、改名、刪除在「帳戶管理」頁。各頁的資料載入看 useHoldingsPortfolios 的 holdingsScope
//（誰＋哪個帳戶），換帳戶就跟換人一樣重新載入。帳戶清單讀到之前內容是骨架、頁面也還不抓（holdingsScope 是 undefined）：先抓的話
// 會先抓一次合併的
const { selectedPortfolioId, selected, ready, loadPortfolios, clearPortfolios } = useHoldingsPortfolios()
const route = useRoute()
const router = useRouter()
if (typeof route.query.account === 'string') selectedPortfolioId.value = route.query.account
watch([authResolved, () => currentUser.value?.uid], ([resolved, uid]) => {
  if (!resolved) return
  if (!uid) clearPortfolios()
  else if (!ready.value) void loadPortfolios()
}, { immediate: true })
// 側欄的連結不帶 ?account=：進到每一頁時把目前選的補回網址（可以分享、重新整理還在）。讀到帳戶清單之前不動網址
watch([ready, () => selected.value?.id ?? null], ([isReady, id]) => {
  if (!isReady || (route.query.account ?? null) === id) return
  const { account: _account, ...rest } = route.query
  void router.replace({ query: id ? { ...rest, account: id } : rest })
}, { immediate: true })
const loading = computed(() => resolving.value || !ready.value || props.pending)
</script>

<template>
  <div class="app-page holdings-shell">
    <div class="holdings-shell__header">
      <div class="holdings-shell__heading">
        <h1 class="app-page__title app-page__title--app">{{ props.title }}</h1>
        <p v-if="props.subtitle" class="holdings-shell__subtitle">{{ props.subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="holdings-shell__actions"><slot name="actions" :loading="member && loading" /></div>
    </div>

    <HoldingsNav />

    <section v-if="!member" class="holdings-shell__guest">
      <h2 class="app-page__h2">{{ props.guestTitle }}</h2>
      <p class="holdings-shell__guest-text">{{ props.guestText }}</p>
      <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
    </section>

    <slot v-else :loading="loading" />
  </div>
</template>

<style scoped>
.holdings-shell__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
}

/* 標題與副標用 gap 隔開，不用負 margin 把副標拉上來（2026-09-16 全站禁負 margin／padding） */
.holdings-shell__heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.holdings-shell__subtitle {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.holdings-shell__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.holdings-shell__guest {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.holdings-shell__guest-text {
  margin: 0;
  color: var(--el-text-color-regular);
}
</style>
