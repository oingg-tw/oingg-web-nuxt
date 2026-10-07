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
// into --app-banner-height so AppNavRail and each layout's content padding shift down to
// clear it, same pattern as AppHeaderMenu does for --app-header-height.
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
    <span>目前無法連線到後端服務，部分資料暫時讀不到。</span>
    <!-- Real, focusable <button>（2026-09-19，原本是不可聚焦的 <el-icon>，鍵盤到不了、除了 hover 才
         看得到的 title 之外沒有任何可及名稱）。
         2026-09-30 依直接指示改回純 X（「請讓她是個單純的 X」）。這推翻了同一次 interface-complexity
         review 訂下的「icon 按鈕要配文字」——那條規則在這裡的代價是實測出來的：78px 寬的「✕ 關閉」
         逼得橫幅左右各留 100px，375px 下訊息只剩 136px 寬、被擠成四行、整條橫幅 112px 高。
         可及名稱改由 aria-label 提供，不是靠可見文字；點擊區維持 44×44。 -->
    <button type="button" class="app-system-health-banner__close" aria-label="關閉" @click="dismissed = true">
      <el-icon aria-hidden="true"><Close /></el-icon>
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
  /* 左右各 64px＝按鈕 44 ＋ 右邊距 12 ＋ 8 的呼吸空間（56 時實測訊息右緣與按鈕貼在一起，間距 0）。2026-09-19 因為關閉鈕帶了文字而放寬到 100px，2026-09-30 按鈕
     改回純 X 之後收回來——100px 在 375px 的畫面上吃掉 200px，訊息只剩 136px、被擠成四行。 */
  padding: 8px 64px;
  background: var(--el-color-warning-light-9);
  /* #8a6823, not --el-color-warning-dark-2（#b88230）— the SAME fix the close button below already
     carries, which this line was missed by（2026-09-23）. The token measures 3.12:1 on this
     banner's own #fdf6ec fill; the darkened GOLD accent measures 4.79:1. Fixing only the button
     in the 2026-09-20 pass left the sentence it sits next to failing, which is the larger target
     of the two. */
  color: #8a6823;
  /* 1rem, not 0.875rem. 14px here predates this app's 16px floor（--el-font-size-base is
     overridden globally）and this banner had been missed by it. The ResizeObserver above
     republishes --app-banner-height, so the taller banner still pushes the page down correctly. */
  font-size: 1rem;
  text-align: center;
}

/* 純 X：沒有外框、沒有底色、沒有文字，但點擊區仍是 44×44（圖示本身 20px，其餘是空白）。
   顏色留 #8a6823——圖示只需要 3:1（SC 1.4.11），而這個值在橫幅自己的 #fdf6ec 底上是 4.79:1，
   等於連文字的 4.5:1 都過，所以之後若又想加回文字不必重新挑色。 */
.app-system-health-banner__close {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: none;
  color: #8a6823;
  font-size: 1.25rem;
  cursor: pointer;
  flex-shrink: 0;
}

/* A darker gold, not `opacity: 0.7`. Opacity blended this text toward the fill and measured
   2.76:1 on hover — worse than the 4.79:1 resting state the 2026-09-20 pass had just fixed it to,
   and WCAG applies to every state, not just the resting one. #6f5219 measures 6.76:1. */
.app-system-health-banner__close:hover {
  color: #6f5219;
}
</style>
