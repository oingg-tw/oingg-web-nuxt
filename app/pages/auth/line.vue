<script setup lang="ts">
import { signInWithCustomToken } from 'firebase/auth'

// LINE Login 導回來的頁面（流程見 app/utils/line-login.ts）。只在瀏覽器做事：code 一次有效，SSR 不碰
useSeoMeta({ title: '用 LINE 登入', robots: 'noindex, nofollow' })

const route = useRoute()
const auth = useFirebaseAuth()
const { arm: armPostLoginLoader } = usePostLoginLoader()
const failed = ref('')
let returnTo = '/'

onMounted(async () => {
  const { code, state, error } = route.query
  const pending = takeLineLogin(state)
  if (pending) returnTo = pending.returnTo
  if (error === 'access_denied') {
    failed.value = '已取消 LINE 登入。'
    return
  }
  if (typeof code !== 'string' || !pending) {
    failed.value = 'LINE 登入沒有完成，請再試一次。'
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
    await navigateTo(returnTo, { replace: true })
  } catch (caught) {
    const status = (caught as { status?: number; statusCode?: number }).status ?? (caught as { statusCode?: number }).statusCode
    failed.value = status === 401 ? 'LINE 登入已逾時或用過了，請再試一次。' : '暫時無法用 LINE 登入，請稍後再試。'
  }
})
</script>

<template>
  <div class="line-login-page">
    <h1 class="app-page__title">用 LINE 登入</h1>
    <template v-if="failed">
      <p role="alert">{{ failed }}</p>
      <div class="line-login-page__actions">
        <el-button type="primary" @click="startLineLogin(returnTo)">再試一次</el-button>
        <NuxtLink to="/">回首頁</NuxtLink>
      </div>
    </template>
    <p v-else role="status">正在登入…</p>
  </div>
</template>

<style scoped>
.line-login-page {
  max-width: 480px;
  margin: 0 auto;
}

.line-login-page__actions {
  display: flex;
  gap: 16px;
  align-items: center;
}
</style>
