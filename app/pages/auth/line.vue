<script setup lang="ts">
import { signInWithCustomToken } from 'firebase/auth'
import type { LineIntent } from '~/utils/line-login'

// LINE Login 導回來的頁面（流程見 app/utils/line-login.ts）。只在瀏覽器做事：code 一次有效，SSR 不碰。
// 處理中只停 1～3 秒，畫面沿用 AppPostLoginLoader 的標誌與動畫：成功後它接手顯示「資料準備中…」，兩段看起來是同一個過程。
// 失敗分三種，各自說清楚發生了什麼，並給同一組出路（2026-10-18 使用者：「這一頁好好設計」）
//
// 綁定（2026-10-20，使用者：「之前用 gmail 登入，現在用 Line 登入卻沒看到任何交易紀錄…該如何綁定？」，與業務中台共同設計）：
//   - intent login：照舊換 custom token 登入。綁定過的 LINE 會進到綁定的帳號（業務中台照對應簽 token）。不做 email 自動對應
//     （使用者聽完風險後決定）。newAccount（這次才建立 LINE 專屬帳號）提示一次——那正是使用者卡住的情況
//   - intent link：個人資料頁按「綁定 LINE」來的。**不重新登入**（換使用者會讓已載入的觀察清單等留在舊帳號），用目前的 token 打
//     POST /auth/line/link，業務中台把這個 LINE 記到目前的帳號，之後用 LINE 登入就是這個帳號
type Failure = 'cancelled' | 'expired' | 'unavailable' | 'signedOut' | 'alreadyLinked' | 'accountLinked' | 'lineAccount' | 'hasData' | 'reauth'
const FAILURES: Record<Failure, { title: string; detail: string }> = {
  cancelled: { title: '已取消 LINE 登入', detail: '沒有登入，也沒有存取你的 LINE 資料。' },
  expired: { title: '這次登入已經失效', detail: '登入連結只能用一次，請重新登入。' },
  unavailable: { title: '暫時無法完成登入', detail: '請稍後再試；一直失敗的話，可以先改用其他方式登入。' },
  signedOut: { title: '沒有綁定 LINE', detail: '要先登入原本的帳號，才能把 LINE 綁上去。' },
  alreadyLinked: { title: '沒有綁定 LINE', detail: '這個 LINE 已經綁在另一個帳號上了。' },
  accountLinked: { title: '沒有綁定 LINE', detail: '你的帳號已經綁了另一個 LINE，一個帳號只能綁一個 LINE。' },
  lineAccount: { title: '沒有綁定 LINE', detail: '現在登入的是 LINE 帳號，請先改用 Google 或電子郵件登入原本的帳號，再綁定 LINE。' },
  hasData: { title: '沒有綁定 LINE', detail: '這個 LINE 帳號已經有自己的持股或觀察清單，兩個帳號的資料沒辦法合併。' },
  reauth: { title: '沒有綁定 LINE', detail: '為了安全，請在個人資料頁再按一次「綁定 LINE」，先驗證身分。' }
}

const route = useRoute()
const auth = useFirebaseAuth()
const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const authedFetch = useAuthedFetch()
const { arm: armPostLoginLoader } = usePostLoginLoader()
const { open: openLoginDialog } = useLoginDialog()
const failure = ref<Failure | null>(null)
const returnTo = ref('/')
const intent = ref<LineIntent>('login')
const linking = computed(() => intent.value === 'link')
const pageTitle = computed(() => (linking.value ? '綁定 LINE' : '用 LINE 登入'))
useSeoMeta({ title: pageTitle, robots: 'noindex, nofollow' })

// 綁定那條的共用失敗改成「綁定」的說法
const failureText = computed(() => {
  if (!failure.value) return null
  if (!linking.value) return FAILURES[failure.value]
  if (failure.value === 'cancelled') return { title: '已取消綁定 LINE', detail: '沒有綁定，也沒有存取你的 LINE 資料。' }
  if (failure.value === 'expired') return { title: '沒有綁定 LINE', detail: '這次的 LINE 連結已經失效，請重新綁定。' }
  if (failure.value === 'unavailable') return { title: '暫時無法完成綁定', detail: '請稍後再試。' }
  return { title: '沒有綁定 LINE', detail: FAILURES[failure.value].detail }
})

const statusOf = (caught: unknown) => (caught as { status?: number; statusCode?: number }).status ?? (caught as { statusCode?: number }).statusCode
const whenAuthResolved = () => new Promise<void>((resolve) => {
  if (authResolved.value) return resolve()
  watch(authResolved, resolved => resolved && resolve(), { once: true })
})

async function signIn(code: string, nonce: string) {
  const result = await $fetch<{ customToken: string; newAccount?: boolean }>('/api/core/auth/line', {
    method: 'POST',
    body: { code, redirectUri: lineRedirectUri(), nonce },
    timeout: BUSINESS_REQUEST_TIMEOUT_MS,
    retry: 0
  })
  await signInWithCustomToken(auth, result.customToken)
  armPostLoginLoader()
  await navigateTo(returnTo.value, { replace: true })
  if (result.newAccount) {
    // 對真正的新使用者先說歡迎；之前用過 Google／email 的人（使用者這次卡住的情況）接著告訴他怎麼回到原本的帳號
    showClosableMessage('已用 LINE 建立帳號。想換電腦也能登入，可以到「個人資料」加上 Google 登入。之前用 Google 或電子郵件登入過的話，請改用那個方式登入，再綁定 LINE。', 'info', 10000)
  }
}

async function link(code: string, nonce: string) {
  await whenAuthResolved()
  if (!currentUser.value) {
    failure.value = 'signedOut'
    return
  }
  try {
    await authedFetch('/auth/line/link', { method: 'POST', body: { code, redirectUri: lineRedirectUri(), nonce }, timeout: BUSINESS_REQUEST_TIMEOUT_MS })
  } catch (caught) {
    const code = businessErrorCode(caught)
    const byCode: Record<string, Failure> = {
      line_already_linked: 'alreadyLinked',
      account_already_linked: 'accountLinked',
      line_account_cannot_link: 'lineAccount',
      line_account_has_data: 'hasData',
      reauth_required: 'reauth'
    }
    failure.value = (code && byCode[code]) || (statusOf(caught) === 401 ? 'expired' : 'unavailable')
    return
  }
  await navigateTo(returnTo.value, { replace: true })
  ElMessage.success('已綁定 LINE，之後用 LINE 登入就是這個帳號。')
}

onMounted(async () => {
  const { code, state, error } = route.query
  const pending = takeLineLogin(state)
  if (pending) {
    returnTo.value = pending.returnTo
    intent.value = pending.intent
  }
  if (error === 'access_denied') {
    failure.value = 'cancelled'
    return
  }
  if (typeof code !== 'string' || !pending) {
    failure.value = 'expired'
    return
  }
  try {
    if (pending.intent === 'link') await link(code, pending.nonce)
    else await signIn(code, pending.nonce)
  } catch (caught) {
    failure.value = statusOf(caught) === 401 ? 'expired' : 'unavailable'
  }
})
</script>

<template>
  <div class="line-login-page">
    <div v-if="failure && failureText" class="line-login-page__panel">
      <h1 class="line-login-page__title">{{ failureText.title }}</h1>
      <p class="line-login-page__detail" role="alert">{{ failureText.detail }}</p>
      <!-- 綁定那條：重試或回個人資料（重新驗證、換帳號都在那裡做），不出現「改用其他方式登入」 -->
      <div v-if="linking" class="line-login-page__actions">
        <el-button v-if="failure === 'cancelled' || failure === 'expired' || failure === 'unavailable'" type="primary" size="large" @click="startLineLogin(returnTo, 'link')">重新綁定 LINE</el-button>
        <el-button size="large" @click="navigateTo(returnTo, { replace: true })">回到個人資料</el-button>
      </div>
      <template v-else>
        <div class="line-login-page__actions">
          <el-button type="primary" size="large" @click="startLineLogin(returnTo)">重新用 LINE 登入</el-button>
          <el-button size="large" @click="openLoginDialog">改用其他方式登入</el-button>
        </div>
        <NuxtLink :to="returnTo" class="line-login-page__back">回到剛才的頁面</NuxtLink>
      </template>
    </div>
    <div v-else class="line-login-page__pending">
      <h1 class="visually-hidden">{{ pageTitle }}</h1>
      <span class="line-login-page__badge">
        <img src="/images/logo-white.png" alt="" class="line-login-page__mark">
      </span>
      <p class="line-login-page__status" role="status">{{ linking ? '正在綁定 LINE…' : '正在用 LINE 登入…' }}</p>
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
