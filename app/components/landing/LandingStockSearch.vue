<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import type { StockSuggestion } from '~/composables/stock/useStockSearch'
// 整個沿用 useStockSearch()（AppHeaderMenu 用的同一支），這裡只擁有自己的視覺外殼，不重做比對與選取後導覽的邏輯。
const { keyword, fetchSuggestions, handleSelect, handleEnter, isCompanyEntry, routeFor } = useStockSearch()
const router = useRouter()

// Same aria-activedescendant clean-up as AppHeaderMenu.vue — see the composable's own comment.
const autocompleteRef = ref<{ $el?: Node } | null>(null)
useAutocompleteActiveDescendantFix(autocompleteRef)

// inLayer：手機的搜尋層（整個畫面）。不放「立即查詢」（2026-10-22，使用者：「手機版 搜尋 立即查詢按鈕是多的可以拿掉」），按鍵盤的搜尋鍵
// （enterkeyhint="search"）就是第一筆；建議直接列在輸入框下面，不用浮出來的下拉（同日：「輸入的時候 底下就可以提示了 不需要在下拉選單，
// 因為我們空間夠顯示」）。每一筆是真的連結：點了就去、長按可以另開、Tab 走得到。首頁的大搜尋框照舊是輸入框＋按鈕＋下拉
const props = withDefaults(defineProps<{ inLayer?: boolean }>(), { inLayer: false })

// 比對跟下拉同一支（fetchSuggestions 是同步的）。只打一兩個字可能上百筆：先列 50 筆，其餘請讀者多打幾個字
const RESULT_LIMIT = 50
const results = computed(() => {
  let found: StockSuggestion[] = []
  fetchSuggestions(keyword.value, (items) => { found = items })
  return found.filter(isCompanyEntry)
})

// Landing-page-only behavior, not part of useStockSearch() itself — an empty query there just
// no-ops (see its own handleEnter), which is correct for the app-shell header (there's nowhere
// obvious to send an empty header search). Here on the homepage, an empty "立即查詢" click has
// an obvious destination: the app itself. 搜尋層空的按 Enter 不做事
function handleSubmit() {
  if (!keyword.value.trim()) {
    if (!props.inLayer) router.push('/calendar')
    return
  }
  handleEnter()
}
</script>

<template>
  <!-- 手機的搜尋層：輸入框下面直接列結果（見 inLayer 的註解）。沒有浮出來的下拉，所以也沒有 el-autocomplete 的 SSR 問題、不用 ClientOnly -->
  <div v-if="inLayer" class="landing-stock-search landing-stock-search--layer">
    <el-input
      v-model="keyword"
      class="landing-stock-search__input"
      placeholder="輸入股票代號或名稱，例如 2330 或 台積電"
      aria-label="輸入股票代號或名稱"
      aria-describedby="layer-search-status"
      enterkeyhint="search"
      clearable
      @keyup.enter="handleSubmit"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>
    <!-- 符合幾筆唸出來（4.1.3）；畫面上的提示在清單裡 -->
    <p id="layer-search-status" class="visually-hidden" role="status">{{ keyword.trim() ? `${results.length} 筆符合` : '' }}</p>
    <ul v-if="keyword.trim()" class="landing-stock-search__results">
      <li v-for="item in results.slice(0, RESULT_LIMIT)" :key="item.code">
        <NuxtLink :to="routeFor(item)" class="landing-stock-search__result" @click="keyword = ''">
          <span class="landing-stock-search__option-name">
            {{ item.name }}
            <el-tag v-if="item.kind === 'etf'" size="small" effect="plain">ETF</el-tag>
            <el-tag v-else-if="item.kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
          </span>
          <span class="landing-stock-search__option-code">{{ item.code }}</span>
        </NuxtLink>
      </li>
      <li v-if="!results.length" class="landing-stock-search__hint">找不到符合的股票代號或名稱</li>
      <li v-else-if="results.length > RESULT_LIMIT" class="landing-stock-search__hint">還有 {{ results.length - RESULT_LIMIT }} 筆，再多打幾個字縮小範圍</li>
    </ul>
  </div>

  <div v-else class="landing-stock-search">
    <!-- ClientOnly + fallback：el-autocomplete 的 popper 在 SSR 與第一次瀏覽器繪製時節點形狀不同（Element Plus 自己的 SSR
         問題），實測會 hydration mismatch——同 AppHeaderMenu 的修法，同一個底層元件。 -->
    <ClientOnly>
      <el-autocomplete
        ref="autocompleteRef"
        v-model="keyword"
        class="landing-stock-search__input"
        :fetch-suggestions="fetchSuggestions"
        popper-class="landing-stock-search__popper"
        placeholder="輸入股票代號或名稱，例如 2330 或 台積電"
        aria-label="輸入股票代號或名稱"
        enterkeyhint="search"
        clearable
        @select="handleSelect"
        @keyup.enter="handleSubmit"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
        <template #default="{ item }">
          <p v-if="item.code === NO_MATCH_SENTINEL" class="landing-stock-search__no-match">{{ item.name }}</p>
          <div v-else class="landing-stock-search__option">
            <span class="landing-stock-search__option-name">
              {{ item.name }}
              <!-- ETF／特別股導到的不是一般的 /stock/{code}，這個標籤兼作提示，不是裝飾（同 AppHeaderMenu）。 -->
              <el-tag v-if="isCompanyEntry(item) && item.kind === 'etf'" size="small" effect="plain">ETF</el-tag>
              <el-tag v-else-if="isCompanyEntry(item) && item.kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
            </span>
            <span class="landing-stock-search__option-code">{{ item.code }}</span>
          </div>
        </template>
      </el-autocomplete>

      <template #fallback>
        <el-input
          class="landing-stock-search__input"
          placeholder="輸入股票代號或名稱，例如 2330 或 台積電"
          aria-label="輸入股票代號或名稱"
          disabled
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </template>
    </ClientOnly>

    <!-- plain, not a solid fill — a full-saturation --el-color-primary background right next
         to a plain dark input read as too bright/glaring ("太亮了點"). plain keeps the same
         accent color as a border + tinted text instead of a solid block, same visual weight
         reduction Element Plus's own plain variant is meant for. -->
    <el-button type="primary" plain class="landing-stock-search__submit" @click="handleSubmit">
      立即查詢
    </el-button>
  </div>
</template>

<style scoped>
.landing-stock-search {
  display: flex;
  width: 100%;
  gap: 8px;
}

.landing-stock-search__input {
  flex: 1;
  min-width: 0;
}

/* 手機的搜尋層：輸入框在上、結果一列一列在下面，整列是連結 */
.landing-stock-search--layer {
  flex-direction: column;
  gap: 12px;
}

.landing-stock-search__results {
  margin: 0;
  padding: 0;
  list-style: none;
}

.landing-stock-search__result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-primary);
  font-size: 1rem;
  text-decoration: none;
}

.landing-stock-search__result:hover {
  background: var(--el-fill-color-light);
}

.landing-stock-search__result .landing-stock-search__option-name {
  font-weight: 600;
}

.landing-stock-search__hint {
  padding: 12px 4px;
  color: var(--el-text-color-secondary);
}

.landing-stock-search__submit {
  height: 48px;
  padding: 0 20px;
  font-size: 1rem;
}

.landing-stock-search__option {
  display: flex;
  justify-content: space-between;
}

.landing-stock-search__option-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.landing-stock-search__option-code {
  color: var(--el-text-color-secondary);
}

.landing-stock-search__no-match {
  margin: 0;
  text-align: center;
  color: var(--el-text-color-placeholder);
  cursor: default;
}
</style>

<style>
/* 不加 scoped，同 AppHeaderMenu 的同一條規則：el-autocomplete 把 class 轉到內部的 el-input 根元素，而那個根元素沒有這個元件的
   data-v-*，scoped 的 :deep() 會靜默不命中。16px 是全站輸入文字下限，不是 Element Plus 預設的 14px。 */
.landing-stock-search__input .el-input__inner {
  font-size: 1rem;
}

/* height on .landing-stock-search__input itself (the el-autocomplete/el-input ROOT) only sizes
   that root element — the actual visible box is the nested .el-input__wrapper, which Element
   Plus sizes to its own default (32px) regardless of the root's height. Confirmed live via
   getBoundingClientRect(): root read 44px while the wrapper still measured 32px, next to a 44px
   submit button. Setting it here instead is what actually changes the rendered height.
   48px, not 44px — 首頁.md §4's touch-target floor (≥48×48px) for this page specifically;
   44px was under that minimum. */
.landing-stock-search__input .el-input__wrapper {
  height: 48px;
}

/* 同 AppHeaderMenu 的修法：Element Plus 預設的 .el-autocomplete-suggestion__wrap padding 留了一塊「下拉看起來開著但滑鼠點不到」
   的死區（「我剛誤以為我滑鼠壞掉」）。 */
.landing-stock-search__popper .el-autocomplete-suggestion__wrap {
  padding: 0;
}
</style>
