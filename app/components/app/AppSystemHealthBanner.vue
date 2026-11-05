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

// 量橫幅的實際高度寫進 --app-banner-height，AppNavRail 與版面內容的 padding 跟著下移（同 AppHeaderMenu 的 --app-header-height）。
// 跟著 ref 走、不是 onMounted：v-if 在根元素上，元件一直掛在版面裡，橫幅本身是之後才出現或被關掉——第一次健康檢查在 onNuxtReady
// 之後，所以掛載時永遠還沒有橫幅。原本在 onMounted 量，從來沒量到，橫幅一直蓋住頁面最上面 42px（手機 66px，2026-10-21 量到）
const bannerRef = ref<HTMLElement>()
let resizeObserver: ResizeObserver | undefined
const publishHeight = (height: number) => document.documentElement.style.setProperty('--app-banner-height', `${height}px`)

watch(bannerRef, (banner) => {
  resizeObserver?.disconnect()
  if (!banner) {
    publishHeight(0)
    return
  }
  resizeObserver ??= new ResizeObserver(([entry]) => {
    if (entry) publishHeight(entry.target.getBoundingClientRect().height)
  })
  resizeObserver.observe(banner)
}, { flush: 'post' })

onUnmounted(() => {
  resizeObserver?.disconnect()
  publishHeight(0)
})
</script>

<template>
  <div v-if="visible" ref="bannerRef" class="app-system-health-banner" role="alert">
    <el-icon aria-hidden="true"><WarningFilled /></el-icon>
    <span>目前連不上伺服器，部分資料暫時讀不到。</span>
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
  /* 字、圖示、底線都是 --el-color-warning，它自己分模式（淺 #8a6823、深 #e6a23c）。2026-10-21（使用者：「背景與網站主題背景顏色太近了
     難以區別輪廓 是否 符合 a11y?」）：原本寫死淺色的 #8a6823，深色模式的底上只有 3.06:1，不到 1.4.3 的 4.5:1；底色跟淺色頁面底
     只差 1.01:1，橫幅的下緣看不出來，所以加一條底線（上緣有頁首的陰影）。 */
  border-bottom: 2px solid var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  /* 1rem, not 0.875rem. 14px here predates this app's 16px floor（--el-font-size-base is
     overridden globally）and this banner had been missed by it. The ResizeObserver above
     republishes --app-banner-height, so the taller banner still pushes the page down correctly. */
  font-size: 1rem;
  text-align: center;
}

/* 純 X：沒有外框、沒有底色、沒有文字，但點擊區仍是 44×44（圖示本身 20px，其餘是空白）。顏色跟橫幅的字一樣（連文字的 4.5:1 都過，
   之後若又想加回文字不必重新挑色）。 */
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
  color: inherit;
  font-size: 1.25rem;
  cursor: pointer;
  flex-shrink: 0;
}

/* 換一個對比更高的色，不用 `opacity: 0.7`：透明度把字混向底色，hover 時只剩 2.76:1，WCAG 每個狀態都算。dark-2 也分模式
   （淺色更深、深色更亮）。 */
.app-system-health-banner__close:hover {
  color: var(--el-color-warning-dark-2);
}
</style>
