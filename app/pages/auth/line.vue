<script setup lang="ts">
import { signInWithCustomToken } from 'firebase/auth'

// LINE Login 導回來的頁面（流程見 app/utils/line-login.ts）。只在瀏覽器做事：code 一次有效，SSR 不碰。
// 處理中只停 1～3 秒，畫面沿用 AppPostLoginLoader 的標誌與動畫：成功後它接手顯示「資料準備中…」，兩段看起來是同一個過程。
// 失敗分三種，各自說清楚發生了什麼，並給同一組出路（2026-10-18 使用者：「這一頁好好設計」）
useSeoMeta({ title: '用 LINE 登入', robots: 'noindex, nofollow' })

type Failure = 'cancelled' | 'expired' | 'unavailable'
const FAILURES: Record<Failure, { title: string; detail: string }> = {
  cancelled: { title: '已取消 LINE 登入', detail: '沒有登入，也沒有存取你的 LINE 資料。' },
  expired: { title: '這次登入已經失效', detail: '登入連結只能用一次，請重新登入。' },
  unavailable: { title: '暫時無法完成登入', detail: '請稍後再試；一直失敗的話，可以先改用其他方式登入。' }
}

const route = useRoute()
const auth = useFirebaseAuth()
const { arm: armPostLoginLoader } = usePostLoginLoader()
const { open: openLoginDialog } = useLoginDialog()
const failure = ref<Failure | null>(null)
const returnTo = ref('/')

onMounted(async () => {
  const { code, state, error } = route.query
  const pending = takeLineLogin(state)
  if (pending) returnTo.value = pending.returnTo
  if (error === 'access_denied') {
    failure.value = 'cancelled'
    return
  }
  if (typeof code !== 'string' || !pending) {
    failure.value = 'expired'
    return
  }
  try {
    const { customToken } = await $fetch<{ customToken: string }>('/api/core/auth/line', {
      method: 'POST',
      body: { code, redirectUri: lineRedirectUri(), nonce: pending.nonce },
      timeout: BUSINESS_REQUEST_TIMEOUT_MS,
      retry: 0
    })
    await signInWithCustomToken(auth, customToken)
    armPostLoginLoader()
    await navigateTo(returnTo.value, { replace: true })
  } catch (caught) {
    const status = (caught as { status?: number; statusCode?: number }).status ?? (caught as { statusCode?: number }).statusCode
    failure.value = status === 401 ? 'expired' : 'unavailable'
  }
})
</script>

<template>
  <div class="line-login-page">
    <div v-if="failure" class="line-login-page__panel">
      <h1 class="line-login-page__title">{{ FAILURES[failure].title }}</h1>
      <p class="line-login-page__detail" role="alert">{{ FAILURES[failure].detail }}</p>
      <div class="line-login-page__actions">
        <el-button type="primary" size="large" @click="startLineLogin(returnTo)">重新用 LINE 登入</el-button>
        <el-button size="large" @click="openLoginDialog">改用其他方式登入</el-button>
      </div>
      <NuxtLink :to="returnTo" class="line-login-page__back">回到剛才的頁面</NuxtLink>
    </div>
    <div v-else class="line-login-page__pending">
      <h1 class="visually-hidden">用 LINE 登入</h1>
      <span class="line-login-page__badge">
        <img src="/images/logo-white.png" alt="" class="line-login-page__mark">
      </span>
      <p class="line-login-page__status" role="status">正在用 LINE 登入…</p>
    </div>
  </div>
</template>

<style scoped>
.line-login-page {
  display: flex;
  justify-content: center;
  padding: 64px 16px;
}

.line-login-page__pending {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

/* ponytail: 標誌色塊與脈動跟 AppPostLoginLoader.vue 各寫一份（約 10 行）——兩處要一起改；第三個地方要用時再抽元件 */
.line-login-page__badge {
  display: flex;
  box-sizing: border-box;
  width: 56px;
  height: 56px;
  padding: 4px;
  border-radius: 14px;
  background: var(--el-color-primary);
  animation: line-login-pulse 1.4s ease-in-out infinite;
}

.line-login-page__mark {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@keyframes line-login-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.55;
    transform: scale(0.92);
  }
}

@media (prefers-reduced-motion: reduce) {
  .line-login-page__badge {
    animation: none;
  }
}

.line-login-page__status {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.line-login-page__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 420px;
  padding: 32px 24px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-bg-color);
  text-align: center;
}

.line-login-page__title {
  margin: 0;
  font-size: 1.375rem;
}

.line-login-page__detail {
  margin: 0;
  color: var(--el-text-color-regular);
}

.line-login-page__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

/* el-button 相鄰時預設 margin-left 12px，直排時會讓第二顆往右偏 */
.line-login-page__actions .el-button {
  width: 100%;
  margin: 0;
}

.line-login-page__back {
  color: var(--el-color-primary-dark-2);
}
</style>
