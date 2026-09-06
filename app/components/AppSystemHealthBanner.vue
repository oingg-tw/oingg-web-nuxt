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
    <el-icon><WarningFilled /></el-icon>
    <span>目前無法連線到後端服務，畫面顯示的是範例資料，並非即時資料。</span>
    <el-icon class="app-system-health-banner__close" title="關閉此提示" @click="dismissed = true"><Close /></el-icon>
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
  padding: 8px 44px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 14px;
  text-align: center;
}

.app-system-health-banner__close {
  position: absolute;
  right: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.app-system-health-banner__close:hover {
  opacity: 0.7;
}
</style>
