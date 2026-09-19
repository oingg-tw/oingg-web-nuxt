<script setup lang="ts">
import { Close, WarningFilled } from '@element-plus/icons-vue'

const { healthy } = useSystemHealth()

// Dismissible per direct request — but NOT a one-time-forever dismissal: reset back to false
// whenever healthy recovers, so a later, separate outage still shows the banner fresh instead
// of staying silently suppressed by a dismissal from a previous, unrelated episode. useState
// (not a local ref) so mounting the banner more than once shares one dismissal, same as
// useSystemHealth.ts's own shared-state reasoning.
const dismissed = useState('system-health-banner-dismissed', () => false)
watch(healthy, isHealthy => {
  if (isHealthy) dismissed.value = false
})

const visible = computed(() => !healthy.value && !dismissed.value)

// Only ever mounted while unhealthy AND not dismissed (v-if below), so onMounted/onUnmounted
// line up exactly with when it needs to occupy space — measure the real height and push it
// into --app-banner-height so AppPinnedSidebar and each layout's content padding shift down to
// clear it, same pattern as StockSearchBar does for --app-header-height.
const bannerRef = ref<HTMLElement>()
let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) document.documentElement.style.setProperty('--app-banner-height', `${entry.target.getBoundingClientRect().height}px`)
  })
  if (bannerRef.value) resizeObserver.observe(bannerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  document.documentElement.style.setProperty('--app-banner-height', '0px')
})
</script>

<template>
  <div v-if="visible" ref="bannerRef" class="app-system-health-banner" role="alert">
    <el-icon aria-hidden="true"><WarningFilled /></el-icon>
    <span>目前無法連線到後端服務，畫面顯示的是範例資料，並非即時資料。</span>
    <!-- Real, focusable <button> with visible text (2026-09-19, interface-complexity review) —
         was a non-focusable <el-icon>, unreachable by keyboard and with no accessible name at
         all beyond a hover-only `title` attribute. -->
    <button type="button" class="app-system-health-banner__close" @click="dismissed = true">
      <el-icon aria-hidden="true"><Close /></el-icon>關閉
    </button>
  </div>
</template>

<style scoped>
/* Fixed, right below the header — matches StockSearchBar's own positioning so the two stack
   cleanly; see the ResizeObserver above for how everything below this clears its height. */
.app-system-health-banner {
  position: fixed;
  top: var(--app-header-height);
  /* also the positioning context for .app-system-health-banner__close below */
  left: 0;
  right: 0;
  z-index: 9;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  /* Side padding widened from 44px to 100px 2026-09-19 (icon+text close button, was a bare 24px
     icon) so the centered message text still clears the now-wider absolutely-positioned button. */
  padding: 8px 100px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 0.875rem;
  text-align: center;
}

/* Icon + visible "關閉" text, ≥44px tall (2026-09-19, replacing a non-focusable <el-icon> — see
   this file's own template comment). */
.app-system-health-banner__close {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--el-color-warning-dark-2);
  border-radius: 8px;
  background: none;
  color: var(--el-color-warning-dark-2);
  font-size: 1rem;
  cursor: pointer;
  flex-shrink: 0;
}

.app-system-health-banner__close:hover {
  opacity: 0.7;
}
</style>
