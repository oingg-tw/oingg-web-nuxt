<script setup lang="ts">
// 電子報不用登入的頁（退訂 /newsletter/opt-out、驗證 email /newsletter/verify，2026-11-16）共用的版面：標題、說明、放按鈕的卡片、註記、
// 錯誤訊息。插槽拿到 toSettings（「到帳號設定」）：帳號頁會把訪客送回首頁，所以沒登入的先開登入，在這一頁登入好了再過去
defineProps<{ title: string; message?: string }>()

const currentUser = useCurrentUser()
const { open: openLogin } = useLoginDialog()
const waiting = ref(false)
function toSettings() {
  if (currentUser.value) return navigateTo('/account/newsletter')
  waiting.value = true
  openLogin('登入後就能管理電子報。')
}
watch(currentUser, (user) => {
  if (user && waiting.value) void navigateTo('/account/newsletter')
})
</script>

<template>
  <div class="newsletter-result">
    <h1 class="app-page__title app-page__title--app">{{ title }}</h1>
    <slot :to-settings="toSettings" />
    <div v-if="$slots.actions" class="app-card newsletter-result__card">
      <slot name="actions" :to-settings="toSettings" />
    </div>
    <slot name="note" :to-settings="toSettings" />
    <p v-if="message" class="newsletter-result__message" role="alert">{{ message }}</p>
  </div>
</template>

<style scoped>
.newsletter-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

.newsletter-result :slotted(p),
.newsletter-result__message {
  margin: 0;
}

.newsletter-result :slotted(.newsletter-result__lead) {
  color: var(--el-text-color-regular);
}

.newsletter-result :slotted(.newsletter-result__note) {
  color: var(--el-text-color-secondary);
}

.newsletter-result__message {
  color: var(--el-color-danger);
}

.newsletter-result__card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 16px;
}

.newsletter-result :slotted(.newsletter-result__primary) {
  min-height: 48px;
  margin: 0;
}

/* 次要的動作（連結或按鈕）是一行金色的字，44px 高 */
.newsletter-result :slotted(.newsletter-result__link),
.newsletter-result :slotted(.newsletter-result__inline) {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--el-color-primary-dark-2);
  cursor: pointer;
}

.newsletter-result :slotted(.newsletter-result__link) {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}

.newsletter-result :slotted(.newsletter-result__inline) {
  text-decoration: underline;
}
</style>
