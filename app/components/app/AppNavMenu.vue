<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import type { AppNavGroup } from '~/utils/app-features'
// 桌機頁首的導覽（AppHeaderMenu 裡）。2026-10-21 重寫（使用者：「app-header-menu 我懷疑 這邊的樣式也是不一致的 請重新設計 並確保 UIUX 使用
// 體驗順暢，手機優先並且要符合a11y」，選了「保留下拉分組」）：原本是 Element Plus 的水平選單（el-menu），量到三件事——
//   - 鍵盤打不開下拉：在「找股票」「我的股票」上按 Enter、空白鍵、方向鍵都沒反應，aria-expanded 也沒有值；只用鍵盤的人從頁首到不了
//     股票篩選、排行、產業索引、觀察清單、持股管理（WCAG 2.1.1）
//   - 語意錯：role="menubar"／menuitem 是應用程式的選單列，網站導覽應該是一組連結；目前頁也只標在藏起來的內層連結上
//   - 樣式自成一套：60px 高的純文字，跟同一列 44px 的按鈕、48px 的搜尋框、側欄的列都不一樣
// 現在照 ARIA 的「可展開的導覽」模式：<nav> 裡一份 <ul>，直接的目的地是連結，分組是 <button aria-expanded> 控制緊接在後的一份連結清單
//（Tab 順序自然走進去）。Enter／空白鍵開關（原生按鈕）、Esc 關閉並回到按鈕、焦點離開這一組或點外面就關、換頁或捲動也關（2026-09-20
// 「下拉選單點外面或是滾動卷軸要讓他自動收起」）、一次只開一個（2026-09-26）。只用點的、不用滑過（2026-09-20 起的規則）。
// 清單一直在伺服器輸出的 HTML 裡（v-show），check-click-depth 讀得到每一個 href。項目與順序在 app-features.ts（手機圖示格讀同一份）。
const route = useRoute()
const openKey = ref<string | null>(null)
const close = () => { openKey.value = null }

function toggle(key: string) {
  openKey.value = openKey.value === key ? null : key
}

// 分組裡任何一頁（含它底下的頁，例如 /industry/24 屬於產業索引）是目前頁：按鈕標成目前所在
const isCurrentGroup = (group: AppNavGroup) => group.items.some(item => route.path === item.to || route.path.startsWith(`${item.match ?? item.to}`))

function onKeydown(event: KeyboardEvent, key: string) {
  if (event.key !== 'Escape' || openKey.value !== key) return
  close()
  document.getElementById(`header-nav-${key}-button`)?.focus()
}

// 焦點移到這一組外面（Tab 走出清單）就收起
function onFocusout(event: FocusEvent, key: string) {
  const group = event.currentTarget as HTMLElement
  if (openKey.value === key && !group.contains(event.relatedTarget as Node | null)) close()
}

const navRef = ref<HTMLElement>()
function onPointerdown(event: PointerEvent) {
  if (openKey.value && !navRef.value?.contains(event.target as Node)) close()
}
watch(() => route.fullPath, close)
onMounted(() => {
  document.addEventListener('pointerdown', onPointerdown)
  window.addEventListener('scroll', close, { passive: true })
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerdown)
  window.removeEventListener('scroll', close)
})
</script>

<template>
  <nav ref="navRef" class="header-nav" aria-label="主要功能">
    <ul class="header-nav__list">
      <li v-for="entry in APP_NAV" :key="entry.key" class="header-nav__entry">
        <template v-if="isNavGroup(entry)">
          <div class="header-nav__group" @keydown="onKeydown($event, entry.key)" @focusout="onFocusout($event, entry.key)">
            <button
              :id="`header-nav-${entry.key}-button`"
              type="button"
              class="app-bar-item"
              :class="{ 'is-current': isCurrentGroup(entry) }"
              :aria-expanded="openKey === entry.key"
              :aria-controls="`header-nav-${entry.key}`"
              @click="toggle(entry.key)"
            >
              {{ entry.label }}
              <el-icon class="header-nav__chevron" :class="{ 'is-open': openKey === entry.key }" aria-hidden="true"><ArrowDown /></el-icon>
            </button>
            <ul v-show="openKey === entry.key" :id="`header-nav-${entry.key}`" class="rail-list header-nav__panel">
              <li v-for="item in entry.items" :key="item.key">
                <NuxtLink :to="item.to" class="rail-item">
                  <el-icon aria-hidden="true" class="header-nav__icon"><component :is="item.icon" /></el-icon>{{ item.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>
        </template>
        <NuxtLink v-else :to="entry.to" class="app-bar-item">{{ entry.label }}</NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.header-nav__list {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.header-nav__group {
  position: relative;
}

.header-nav__chevron {
  transition: transform 0.15s ease;
}

.header-nav__chevron.is-open {
  transform: rotate(180deg);
}

/* 下拉的那一份清單：列的樣子跟側欄一樣（.rail-item，48px），掛在按鈕正下方 */
.header-nav__panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1;
  min-width: 200px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
}

.header-nav__icon {
  flex-shrink: 0;
  font-size: 1.125rem;
  color: var(--el-color-primary-dark-2);
}
</style>
