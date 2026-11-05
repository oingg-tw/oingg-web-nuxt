<script setup lang="ts">
import type { AnalyticsConsent } from '~/composables/app/useAnalyticsConsent'
// Google Analytics 的同意橫幅（2026-10-18）。選擇與載入的規則在 useAnalyticsConsent。
//
// 貼在畫面底部、不是對話框：不擋操作、不搶焦點（瀏覽本站不需要先回答這個問題）。橫幅出現時，頁面底部與捲動預留同樣的高度
//（body padding-bottom＋html scroll-padding-bottom）：否則頁尾最後一行會被蓋住，鍵盤移到底部的元素也會落在橫幅後面（WCAG 2.4.11）。
// 按完橫幅消失，焦點不能掉到 body：移到頁面的 h1（同 undoToast 的做法）。頁尾的「Cookie 設定」把選擇清掉，橫幅會再出現、焦點移到橫幅。
const { consent, asks, setConsent } = useAnalyticsConsent()
const visible = computed(() => asks && consent.value === null)
const bar = ref<HTMLElement | null>(null)

let observer: ResizeObserver | null = null
// --app-consent-height：黏在畫面底部的元素（篩選結果表的橫向捲軸）跟著讓開——2026-10-18 量到橫幅蓋住捲軸把手，訪客做選擇之前拖不動
function reserve(height: number) {
  document.body.style.paddingBottom = height ? `${height}px` : ''
  document.documentElement.style.scrollPaddingBottom = height ? `${height}px` : ''
  document.documentElement.style.setProperty('--app-consent-height', `${height}px`)
}
watch(bar, (element) => {
  observer?.disconnect()
  observer = null
  if (!element) return reserve(0)
  observer = new ResizeObserver(() => reserve(element.offsetHeight))
  observer.observe(element)
}, { flush: 'post' })
onBeforeUnmount(() => {
  observer?.disconnect()
  reserve(0)
})

function choose(value: AnalyticsConsent) {
  setConsent(value)
  // 沒有 h1 的頁（例如個股總覽）落到 main
  const heading = document.querySelector<HTMLElement>('main h1, h1') ?? document.querySelector<HTMLElement>('main')
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.focus()
}
</script>

<template>
  <section v-if="visible" ref="bar" class="consent-banner" aria-label="Cookie 使用說明">
    <p class="consent-banner__text">
      我們用 Google Analytics 了解哪些頁面有人看、哪裡需要改進，會在您的瀏覽器存放 Cookie。不用於廣告，也不會傳送您的帳號或持股資料。
    </p>
    <div class="consent-banner__actions">
      <el-button type="primary" @click="choose('granted')">接受</el-button>
      <el-button @click="choose('denied')">拒絕</el-button>
    </div>
  </section>
</template>

<style scoped>
.consent-banner {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2100;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px 24px;
  padding: 16px;
  border-top: 1px solid var(--el-border-color);
  background: var(--el-bg-color-overlay);
  box-shadow: 0 -2px 12px rgb(0 0 0 / 8%);
  color: var(--el-text-color-primary);
}

.consent-banner__text {
  max-width: 720px;
  margin: 0;
  line-height: 1.6;
}

.consent-banner__actions {
  display: flex;
  gap: 12px;
}

.consent-banner__actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}
</style>
