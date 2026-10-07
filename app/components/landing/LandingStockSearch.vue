<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { NO_MATCH_SENTINEL } from '~/composables/stock/useStockSearch'

// 整個沿用 useStockSearch()（AppHeaderMenu 用的同一支），這裡只擁有自己的視覺外殼，不重做比對與選取後導覽的邏輯。
const { keyword, fetchSuggestions, handleSelect, handleEnter, isCompanyEntry } = useStockSearch()
const router = useRouter()

// Same aria-activedescendant clean-up as AppHeaderMenu.vue — see the composable's own comment.
const autocompleteRef = ref<{ $el?: Node } | null>(null)
useAutocompleteActiveDescendantFix(autocompleteRef)

// stacked added 2026-09-16 per direct request on the mobile header's own 搜尋彈窗 usage
// ("搜尋彈窗，立即查詢按鈕要放在input下面") — the landing page's own hero usage stays row-
// layout (input+button side by side, unchanged, not part of that request), while
// AppMobileHeader.vue's dialog passes this to stack the button below the input instead, where a
// narrow dialog width leaves less room for the two to sit comfortably side by side.
withDefaults(defineProps<{ stacked?: boolean }>(), { stacked: false })

// Landing-page-only behavior, not part of useStockSearch() itself — an empty query there just
// no-ops (see its own handleEnter), which is correct for the app-shell header (there's nowhere
// obvious to send an empty header search). Here on the homepage, an empty "立即查詢" click has
// an obvious destination: the app itself.
function handleSubmit() {
  if (!keyword.value.trim()) {
    router.push('/calendar')
    return
  }
  handleEnter()
}
</script>

<template>
  <div class="landing-stock-search" :class="{ 'landing-stock-search--stacked': stacked }">
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

/* stacked modifier — see this component's own `stacked` prop comment. Button goes full-width
   below the input instead of a fixed side width next to it, matching the input's own width
   rather than sizing itself off its own text. */
.landing-stock-search--stacked {
  flex-direction: column;
}

.landing-stock-search__input {
  flex: 1;
  min-width: 0;
}

.landing-stock-search__submit {
  height: 48px;
  padding: 0 20px;
  font-size: 1rem;
}

.landing-stock-search--stacked .landing-stock-search__submit {
  width: 100%;
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
