<script setup lang="ts">
import { Search, Setting } from '@element-plus/icons-vue'
// 桌機頁首——layouts/default.vue 在每個寬度都掛它（CSS 在桌機版面以外藏起來、改顯示 AppMobileHeader），landing.vue 也掛。
// 2026-09-06 從單一共用元件拆成桌機／手機兩支；2026-09-19 根元素是 <header>（el-menu 當根時 logo 與搜尋列落在 role="menubar" 裡，
// axe 每頁報 critical）。
//
// 2026-10-21 重新設計（使用者：「app-header-menu 我懷疑 這邊的樣式也是不一致的 請重新設計 並確保 UIUX 使用體驗順暢，手機優先並且要符合
// a11y」，選了「保留下拉分組」）。量到的不一致：同一列四種高度（選單 60、搜尋框 48、按鈕 44、頭像 32）、三種外觀（Element 選單的純文字、
// 框線輸入框、框線按鈕）、登入前後右上角寬度不同（「登入」86px → 頭像 32px，搜尋框跟著移位）、1024 寬（平板橫放）時搜尋框被擠到約
// 120px；鍵盤打不開下拉（見 AppNavMenu）。現在：
//   - 一列從左到右是 logo、導覽、搜尋、外觀設定、登入／帳號，全部在正常的排版流裡（logo 不再絕對定位、不再靠 140px 左內距閃開它）
//   - 每個控制項都是 .app-bar-item（main.css）：44px、沒有框線、同一套滑過與目前所在；搜尋框也是 44px
//   - 登入／帳號一樣寬（UserMenuButton 的 bar 版），登入狀態換掉時搜尋框不動
//   - 桌機版面但不到 1280 寬（平板橫放）時搜尋框收成一個「搜尋」按鈕，開跟手機同一個搜尋滑層（AppSlideLayer 在這個寬度只開放搜尋那一層）
const { keyword, fetchSuggestions, handleSelect, handleEnter, isCompanyEntry } = useStockSearch()
const { toggle: toggleSlideLayer } = useSlideLayer()

const barRef = ref<HTMLElement>()
useHeaderHeightMeasure(barRef)

// Accesskey 快速鍵 (Alt+S)：el-autocomplete 的 focus() 是它公開的方法；$el 給下面的 aria 修正讀
const searchInputRef = ref<{ focus: () => void; $el?: Node } | null>(null)
// el-autocomplete 沒有反白項目時把 aria-activedescendant 指到不存在的 "…-item--1"（axe critical），見那個 composable
useAutocompleteActiveDescendantFix(searchInputRef)
// 搜尋框收起來的寬度（見上面最後一點）沒有框可以聚焦，改開搜尋滑層
function focusSearch() {
  if (matchMedia('(min-width: 1280px)').matches) searchInputRef.value?.focus()
  else toggleSlideLayer('search')
}
</script>

<template>
  <header ref="barRef" class="app-header-menu">
    <AppLogo class="app-header-menu__logo" home-accesskey />
    <AppNavMenu />

    <!-- 跳至搜尋（Alt+S，配置見 pages/sitemap.vue）：平常藏起來、鍵盤聚焦才出現（main.css 的 .skip-link） -->
    <button type="button" class="app-header-menu__accesskey skip-link" accesskey="s" title="搜尋區塊" @click="focusSearch">
      跳至搜尋
    </button>

    <div class="app-header-menu__center">
      <!-- ClientOnly：el-autocomplete 的建議清單是 popper，伺服器與瀏覽器第一次渲染的節點不同（Hydration node mismatch，實測）。
           下面的 fallback 長得跟真的一樣（同高、同圖示、同提示字），接手前不會是一塊空白 -->
      <ClientOnly>
        <el-autocomplete
          ref="searchInputRef"
          v-model="keyword"
          class="app-header-menu__input"
          :fetch-suggestions="fetchSuggestions"
          popper-class="app-header-menu__popper"
          placeholder="搜尋股票代號或名稱，例如 2330 或 台積電"
          aria-label="搜尋股票代號或名稱"
          clearable
          @select="handleSelect"
          @keyup.enter="handleEnter"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #default="{ item }">
            <p v-if="item.code === NO_MATCH_SENTINEL" class="app-header-menu__no-match">{{ item.name }}</p>
            <div v-else class="app-header-menu__option">
              <span class="app-header-menu__option-name">
                {{ item.name }}
                <!-- ETF／特別股標出來：選了會到別的頁（useStockSearch 的 routeFor），不只是裝飾 -->
                <el-tag v-if="isCompanyEntry(item) && item.kind === 'etf'" size="small" effect="plain">ETF</el-tag>
                <el-tag v-else-if="isCompanyEntry(item) && item.kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
              </span>
              <span class="app-header-menu__option-code">{{ item.code }}</span>
            </div>
          </template>
        </el-autocomplete>
        <template #fallback>
          <el-input class="app-header-menu__input" placeholder="搜尋股票代號或名稱，例如 2330 或 台積電" aria-label="搜尋股票代號或名稱" disabled>
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </template>
      </ClientOnly>
    </div>
    <!-- 平板橫放（桌機版面、不到 1280 寬）時取代上面的搜尋框 -->
    <button type="button" class="app-bar-item app-header-menu__search-button" @click="toggleSlideLayer('search')">
      <el-icon aria-hidden="true"><Search /></el-icon>搜尋
    </button>

    <!-- 外觀設定（2026-09-17 自己一顆，不收進帳號選單：「帳號選單暗示需要帳號」） -->
    <NuxtLink to="/appearance" class="app-bar-item">
      <el-icon aria-hidden="true"><Setting /></el-icon>外觀設定
    </NuxtLink>
    <!-- 登入／帳號（「登入放到右上角」「右上角至少登入前要有文字呈現」；登入後只要頭像、不顯示名稱，2026-09-24） -->
    <UserMenuButton layout="bar" />
  </header>
</template>

<style scoped>
.app-header-menu {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  /* 60px：44px 的控制項上下各 8px（同手機頁首） */
  min-height: 60px;
  box-sizing: border-box;
  padding: 8px 16px;
  /* 半透明＋模糊：固定在捲動的內容上，透一點但字還清楚（2026-09-02 誤刪後還原，「searchbar跑版了」） */
  background: color-mix(in srgb, var(--el-bg-color) 65%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgb(0 0 0 / 40%);
}

/* logo 跟導覽之間比其他控制項多留一點，品牌與功能分開 */
.app-header-menu__logo {
  margin-right: 16px;
}

/* 搜尋框在剩下的空間裡置中、最寬 640（2026-09-23 無上限時跟右邊的按鈕只剩 8px；09-26 由 520 放寬到 640「太短了我不習慣」） */
.app-header-menu__center {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
  margin: 0 8px;
}

.app-header-menu__search-button {
  display: none;
  margin-left: auto;
}

/* 平板橫放：桌機版面但寬度不夠放一個像樣的搜尋框，收成按鈕 */
@media (max-width: 1279px) {
  .app-header-menu__center {
    display: none;
  }

  .app-header-menu__search-button {
    display: inline-flex;
  }
}

.app-header-menu__option {
  display: flex;
  justify-content: space-between;
}

.app-header-menu__option-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.app-header-menu__option-code {
  color: var(--el-text-color-secondary);
}

/* 「找不到」那一列（useStockSearch 的 NO_MATCH_SENTINEL）是一句說明，不是可選的選項 */
.app-header-menu__no-match {
  margin: 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  cursor: default;
}
</style>

<style>
/* Unscoped, not :deep() — el-autocomplete forwards the class it's given onto its own internal
   <el-input> root, but neither picks up this component's scoped data-v-* attribute, so a scoped
   :deep() rule here compiles to a selector that never matches; the popper content is teleported
   besides. */

/* Small breathing-room gap between the suggestion dropdown and whatever page content sits
   directly below the header (reported live "searchbar跑版了" on the stock detail page, where the
   summary card's title row starts with zero gap right after the fixed header). */
.app-header-menu__popper {
  margin-top: 8px;
}

/* Element Plus's own .el-autocomplete-suggestion__wrap default ships `padding: 10px 0` — a
   vertical dead zone above/below the option list where the dropdown is still visually open but
   nothing is hoverable/clickable (reported live: "我剛誤以為我滑鼠壞掉"). */
.app-header-menu__popper .el-autocomplete-suggestion__wrap {
  padding: 0;
}

/* 高度要設在裡面的 .el-input__wrapper（根元素的高度只管根元素；Element 的 small 尺寸約 27px，2026-09-20「高度怪怪」）。
   44px，跟同一列的每個控制項一樣（2026-10-21 由 48 改；48 是首頁大搜尋框的高度，放在頁首就是唯一一個比別人高的） */
.app-header-menu__input .el-input__wrapper {
  height: 44px;
  border-radius: 8px;
}

/* Width, and it has to live in this unscoped block like the height above（2026-09-23,「這塊有點醜
   請調整間距啥的」）. There WAS a `.app-header-menu__input { min-width: 0 }` in the scoped block,
   and it had never matched anything: probed live, the el-autocomplete root carries the class but
   NO data-v-* attribute at all — it is inside <ClientOnly>, so the scope id never reaches it —
   which makes every scoped selector for this element a no-op. Deleted rather than left as a rule
   that looks like it does something.
   max-width: a search box has no reason to grow without limit. Uncapped it took every pixel the
   menu and the buttons did not — 693px at 1440, wider on a larger monitor — so the bar read as one
   enormous field with things stuck to its ends, and its right border sat 8px from 外觀設定's left
   border. 520px fits the placeholder「搜尋股票代號或名稱，例如 2330 或 台積電」with room to spare
   （~380px at 16px）; the leftover width becomes symmetric margin, since .app-header-menu__center
   already centres it.
   RAISED 520 → 640 on 2026-09-26（「搜尋股票代號或名稱 input 現在太短了我不習慣」）。沒有回到無上限：
   上面那段記的是實測結果——無上限時 1440 寬會長到 693px，右邊界離「外觀設定」只剩 8px，整條 bar 讀起來
   像一個巨大的欄位兩端黏著東西。640 是在「不習慣的短」與「那個 8px」之間，實測 1440 寬下離按鈕還有
   餘裕。使用者選的是「只把搜尋框加寬，不動其他」，所以 header 其他元素的對齊沒有跟著改。
   min-width restated here for the reason the dead rule gave: the flex default is min-width:auto,
   not 0, so without it this child refuses to shrink below its content's intrinsic width. */
.app-header-menu__input {
  min-width: 0;
  max-width: 640px;
}
</style>
