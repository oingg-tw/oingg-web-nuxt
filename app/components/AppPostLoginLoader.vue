<script setup lang="ts">
const { isVisible } = usePostLoginLoader()
</script>

<template>
  <Transition name="post-login-loader-fade">
    <div v-if="isVisible" class="post-login-loader" role="status" aria-live="polite">
      <span class="post-login-loader__badge">
        <img src="/images/logo-white.png" alt="" class="post-login-loader__mark">
      </span>
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

/* Same "colored badge behind a white glyph" treatment as AppLogo.vue's .app-logo__mark — the
   glyph asset itself (logo-white.png) is opaque white, invisible against this page's own
   light-mode background without a themed backdrop behind it. */
.post-login-loader__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 56px;
  height: 56px;
  padding: 4px;
  border-radius: 14px;
  background: var(--el-color-primary);
  animation: post-login-loader-pulse 1.4s ease-in-out infinite;
}

.post-login-loader__mark {
  width: 100%;
  height: 100%;
  object-fit: contain;
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
