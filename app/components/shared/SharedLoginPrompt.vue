<script setup lang="ts">
// 還沒登入時放在內容位置的那張卡片（持股、清單管理）：標題、一句說明、登入鈕
defineProps<{ title: string; text: string }>()

const { open: openLogin } = useLoginDialog()
</script>

<template>
  <section class="shared-login-prompt app-card">
    <h2 class="app-page__h2">{{ title }}</h2>
    <p class="shared-login-prompt__text">{{ text }}</p>
    <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
  </section>
</template>

<style scoped>
.shared-login-prompt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
}

.shared-login-prompt__text {
  margin: 0;
  color: var(--el-text-color-regular);
}
</style>
