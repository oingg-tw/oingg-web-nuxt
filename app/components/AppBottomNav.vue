<script setup lang="ts">
// 手機的區內導覽：底部固定一條「其他頁面　目前：XX」，點開往上展開這一區的清單（2026-10-07 全站統一，使用者在
// 「底部固定條＋展開清單／頁首按鈕排／併進全站選單」三個方案裡選了第一個）。個股頁（StockPageNav）、持股管理與
// 總經（SectionNav）、產業（IndustryNav）都用這一個外殼，各自只把清單放進 slot；寬螢幕仍是 AppNavRail。
//
// 為什麼是原生 <details>、不是 el-drawer：清單裡的連結是站內連結圖的一部分，必須在 SSR HTML 裡（收合的
// <details> 內容照樣在 markup 裡，drawer 沒打開就不在）。這段理由最早寫在 StockPageNav 2026-09-23 的註解。
//
// 這次補上的行為（原本只有個股頁有這條，而且以下都沒有）：
//   - 點外面、按 Esc 會收起來，Esc 收起時焦點回到這條（<details> 本身只能點 summary 開關）
//   - 換頁時收起來（同一個元件在不同路由間被重用時，<details> 會保持打開）
//   - 展開的清單可以用鍵盤捲動（tabindex=0＋名稱；AppNavRail 早就有同樣的處理）
//   - <body> 的底部留白與 scroll-padding 由這裡統一加（main.css 的 has-bottom-nav-bar），聚焦到底部的
//     控制項時瀏覽器會把它捲到這條上方，不會被蓋住
const props = defineProps<{
  // 目前所在的頁名；沒有就只顯示「其他頁面」
  current?: string | null
  // 展開後清單區的名稱（給螢幕閱讀器）
  label: string
}>()

const detailsRef = ref<HTMLDetailsElement>()
const summaryRef = ref<HTMLElement>()
const open = ref(false)

function close(returnFocus: boolean) {
  if (!detailsRef.value?.open) return
  detailsRef.value.open = false
  if (returnFocus) summaryRef.value?.focus()
}

function onPointerDown(event: PointerEvent) {
  if (open.value && detailsRef.value && !detailsRef.value.contains(event.target as Node)) close(false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close(true)
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})

const route = useRoute()
watch(() => route.fullPath, () => close(false))

useHead({ bodyAttrs: { class: 'has-bottom-nav-bar' } })
</script>

<template>
  <details ref="detailsRef" class="app-bottom-nav" @toggle="open = !!detailsRef?.open">
    <summary ref="summaryRef" class="app-bottom-nav__bar">
      <span class="app-bottom-nav__label">其他頁面</span>
      <span v-if="props.current" class="app-bottom-nav__current">目前：{{ props.current }}</span>
      <span class="app-bottom-nav__chevron" aria-hidden="true" />
    </summary>
    <div class="app-bottom-nav__sheet" tabindex="0" role="region" :aria-label="label">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.app-bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  background: var(--el-bg-color-overlay);
  border-top: 1px solid var(--el-border-color);
  box-shadow: 0 -2px 12px rgb(0 0 0 / 8%);
  /* nuxt.config 沒有 viewport-fit=cover，所以 env() 現在是 0、iOS 自己會把固定元素放在安全區之上。刻意不加 cover：
     加了之後 iPhone 橫拿時整站內容會延伸到瀏海底下，頁首與頁面左右都沒有對應的 safe-area 留白。這一行是為了
     哪天真的加 cover 時這條不用再改。 */
  padding-bottom: env(safe-area-inset-bottom);
}

/* 整條都是按鈕，所以由它撐 48px 觸控目標 */
.app-bottom-nav__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 16px;
  font-size: 1rem;
  cursor: pointer;
  list-style: none;
}

.app-bottom-nav__bar::-webkit-details-marker {
  display: none;
}

.app-bottom-nav__bar:focus-visible,
.app-bottom-nav__sheet:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.app-bottom-nav__label {
  font-weight: 600;
}

/* 截斷不換行：這條的高度就是頁面底部留白的依據 */
.app-bottom-nav__current {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
}

.app-bottom-nav__chevron {
  flex: none;
  width: 10px;
  height: 10px;
  margin-left: auto;
  border-right: 2px solid var(--el-text-color-secondary);
  border-bottom: 2px solid var(--el-text-color-secondary);
  transform: rotate(-135deg) translate(-2px, -2px);
  transition: transform 0.15s ease;
}

.app-bottom-nav[open] .app-bottom-nav__chevron {
  transform: rotate(45deg) translate(-2px, -2px);
}

/* dvh：iOS Safari 的網址列會改變可視高度，vh 卡在最大值會讓清單跑到瀏覽器工具列下面 */
.app-bottom-nav__sheet {
  max-height: 60dvh;
  overflow-y: auto;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* 寬螢幕交給 AppNavRail。斷點與站上其他七處一致（見 layouts/default.vue）。 */
@media (min-width: 1280px), (min-width: 1024px) and (orientation: landscape) {
  .app-bottom-nav {
    display: none;
  }
}

@media print {
  .app-bottom-nav {
    display: none;
  }
}
</style>
