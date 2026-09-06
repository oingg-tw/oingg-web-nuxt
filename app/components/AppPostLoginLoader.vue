<script setup lang="ts">
const { isVisible } = usePostLoginLoader()
</script>

<template>
  <Transition name="post-login-loader-fade">
    <div v-if="isVisible" class="post-login-loader" role="status" aria-live="polite">
      <img src="/images/logo.png" alt="" class="post-login-loader__mark">
      <p class="post-login-loader__text">資料準備中…</p>
    </div>
  </Transition>
</template>

<style scoped>
.post-login-loader {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--el-bg-color-page);
}

.post-login-loader__mark {
  width: 56px;
  height: 56px;
  object-fit: contain;
  animation: post-login-loader-pulse 1.4s ease-in-out infinite;
}

.post-login-loader__text {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

@keyframes post-login-loader-pulse {
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

.post-login-loader-fade-enter-active,
.post-login-loader-fade-leave-active {
  transition: opacity 0.2s ease;
}

.post-login-loader-fade-enter-from,
.post-login-loader-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .post-login-loader__mark {
    animation: none;
  }
}
</style>
