<script setup lang="ts">
// 持股七頁共用的外殼（2026-10-08）：標題列（h1、副標、右側動作）、HoldingsNav、登入狀態還沒確定時的 loading 佔位、訪客的登入
// 提示卡，然後才是頁面內容。原本七頁各寫一份（每頁一組 mounted／authResolved／openLogin 加約 50 行 CSS）。
// 選元件不選父路由：持股總覽的動作區依頁面狀態變化、各頁標題不同，專案裡也沒有父路由的先例。
// 各頁自己的資料載入（watch([authResolved, uid, range])）留在頁面裡，這裡只管「畫哪一層」。
const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  guestTitle: string
  guestText?: string
}>(), { subtitle: undefined, guestText: '持股資料存在你的帳號裡，只有你看得到。' })

const hasHydrated = useHasHydrated()
const authResolved = useAuthResolved()
const currentUser = useCurrentUser()
const { open: openLogin } = useLoginDialog()
</script>

<template>
  <div class="app-page holdings-shell">
    <div class="holdings-shell__header">
      <div class="holdings-shell__heading">
        <h1 class="app-page__title app-page__title--app">{{ props.title }}</h1>
        <p v-if="props.subtitle" class="holdings-shell__subtitle">{{ props.subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="holdings-shell__actions"><slot name="actions" /></div>
    </div>

    <HoldingsNav />

    <!-- 登入狀態還沒確定：不畫訪客卡也不畫內容，免得重新整理時先閃一下錯的那一個。hasHydrated 而不是 authResolved
         單獨：Firebase 可能在 hydration 前就解析完，client 第一次渲染就會跟 SSR 的「還不知道」不同（2026-10-05 Hydration node mismatch） -->
    <div v-if="!hasHydrated || !authResolved" v-loading="true" class="app-loading-placeholder" />

    <section v-else-if="!currentUser" class="holdings-shell__guest">
      <h2 class="app-page__h2">{{ props.guestTitle }}</h2>
      <p class="holdings-shell__guest-text">{{ props.guestText }}</p>
      <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
    </section>

    <template v-else>
      <slot />
    </template>
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
