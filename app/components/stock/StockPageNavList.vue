<script setup lang="ts">
import Sortable from 'sortablejs'
import type { StockNavNode } from '~/utils/stock-page-nav'

// 區內導覽的連結清單——個股頁面（STOCK_NAV_ITEMS＋使用者釘選的指標）與產業特區共用（2026-10-01「請使用共用元件。不可重造
// 車輪。」）。呼叫端各掛兩份：AppBottomNav（手機）與 AppNavRail（桌機），兩份都在 SSR HTML 裡，CSS 決定哪一份可見。
//
// 原生 <ul>／<a>，不是 el-menu（2026-10-08 重寫）：Element Plus 2.14 的 el-menu-item 寫死 tabindex="-1"，鍵盤處理只裝在水平
// 選單，直式選單裡的連結用 Tab 永遠到不了（WCAG 2.1.1 的阻斷項）；而且 role="menubar" 套在一份連結清單上本來就是錯的語意。
// 清單是平的——STOCK_NAV_ITEMS 與 INDUSTRY_ZONE_ITEMS 都沒有群組節點，釘選的也是葉節點——所以沒有群組的標記；哪天真的要分組，
// 用 <details>/<summary>（AppBottomNav 的做法），不要回去用 el-sub-menu。
//
// 留下來的鉤子都有別處在讀：<nav aria-label>（check-stock-pages 在 SSR HTML 裡找「個股頁面」）、每個目的地都是真的 <a href>
// （check-click-depth 讀 raw HTML 證明三步內可達）、目前頁由 NuxtLink 的 aria-current="page" 表達（check-macro-rail 斷言粗體＋
// 底線，不能只靠顏色）、≥48px 的列高（本站對年長讀者的下限，高於 WCAG 的 24×24）。
const props = withDefaults(defineProps<{
  code?: string
  items?: StockNavNode[]
  label?: string
  // 可以拖曳排序的那一段（2026-10-18 抽成共用，使用者：「這邊的 sidebar 要跟個股瀏覽那邊的 sidebar 一樣可以拖曳排序，請抽出共用元件重複使用」）。
  // 排在 items 的骨幹列後面、trailing 列前面；順序存在哪裡由呼叫端決定（個股的自選指標存帳號，ETF 的面向存瀏覽器），這裡只回報誰搬到哪
  sortableItems?: StockNavNode[]
  // 那一段的小標題（個股「自選指標」）；不給就只畫分隔線（ETF 的面向）
  sortableHeading?: string
}>(), { code: '', items: () => STOCK_NAV_ITEMS, label: '個股頁面', sortableItems: () => [], sortableHeading: '' })

const emit = defineEmits<{ reorder: [oldIndex: number, newIndex: number] }>()

// 三段：骨幹、使用者自己釘的（2026-09-26，有分隔線與小標題——沒有分界的話，釘選的列讀起來像網站少給了幾個入口）、
// 「找不到時去哪裡翻」的 trailing 列（2026-09-28 排在釘選後面，由 STOCK_NAV_ITEMS 的 trailing 旗標決定）。
const leadingItems = computed(() => props.items.filter(item => !item.trailing))
const trailingItems = computed(() => props.items.filter(item => item.trailing))

// 拖曳排序（2026-10-13 個股自選指標起，使用者：「sidebar 自選指標 希望可以用拖曳的方式就更新排序」）。sortablejs 的設定照
// PresetFolder.vue（篩選器分頁拖曳）調過的那一組：forceFallback（連結的原生拖曳會搶走手勢）、30ms 延遲、8px 容忍讓點連結仍是
// 點連結；粗指標（手機）不掛，免得跟捲動底部清單打架。鍵盤與單指替代路徑由呼叫端提供（個股是指標速覽表格的上移／下移，WCAG 2.5.7）。
// onEnd 先還原 sortable 自己搬的 DOM，交給 Vue 依呼叫端的新順序重畫，同 PresetFolder 的理由。
// 呼叫端指定目前位置時照它（物件綁定：undefined 也要蓋掉路由在完全符合那一列設的 aria-current，見 SectionNav）
const mark = (item: StockNavNode) => (item.current === undefined ? {} : { 'aria-current': item.current ? 'page' as const : undefined })
// 只有一列（或還在讀）就沒有東西可排：不畫握把、不掛拖曳
const draggable = computed(() => props.sortableItems.length > 1 && !props.sortableItems.some(item => item.skeleton))
const sortableList = ref<HTMLElement>()
let sortable: Sortable | undefined

watch([sortableList, draggable], ([el, enabled]) => {
  sortable?.destroy()
  sortable = undefined
  if (!el || !enabled || matchMedia('(pointer: coarse)').matches) return
  sortable = Sortable.create(el, {
    animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150,
    delay: 30,
    delayOnTouchOnly: false,
    forceFallback: true,
    fallbackTolerance: 8,
    onEnd({ oldIndex, newIndex, item, from }) {
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
      from.removeChild(item)
      from.insertBefore(item, from.children[oldIndex] ?? null)
      emit('reorder', oldIndex, newIndex)
    }
  })
})
onUnmounted(() => sortable?.destroy())
</script>

<template>
  <nav class="stock-page-nav" :aria-label="label">
    <!-- 釘選那一段不包 ClientOnly：useState 的預設值兩邊一致，那些列是帳號同步完成後才長出來的狀態變化，不是 hydration 不匹配。 -->
    <ul class="rail-list">
      <li v-for="item in leadingItems" :key="item.label">
        <NuxtLink :to="item.to!(code)" class="rail-item" v-bind="mark(item)">
          <el-icon v-if="item.icon" aria-hidden="true" class="stock-page-nav__icon"><component :is="item.icon" /></el-icon>{{ item.label }}
        </NuxtLink>
      </li>
      <template v-if="sortableItems.length">
        <li v-if="sortableHeading" class="rail-heading">{{ sortableHeading }}</li>
        <!-- 沒有小標題也要跟上面的骨幹隔一條線（2026-10-21，使用者：「etf sidebar 指標速覽下面要有橫線 這邊樣式全站沒有統一嗎」）：
             原本線畫在小標題上，ETF 不給小標題就連線也沒了。上面沒有骨幹列時不畫 -->
        <li :class="{ 'rail-divided': !sortableHeading && leadingItems.length }">
          <ul ref="sortableList" class="stock-page-nav__sublist">
            <li v-for="(item, index) in sortableItems" :key="item.skeleton ? `skeleton-${index}` : item.label" class="stock-page-nav__pinned" :aria-hidden="item.skeleton || undefined">
              <span v-if="item.skeleton" class="rail-item"><span class="app-skeleton app-skeleton--inline stock-page-nav__skeleton" /></span>
              <!-- draggable="false"：連結的原生拖曳（拖出網址）會搶走 sortable 的手勢 -->
              <NuxtLink v-else :to="item.to!(code)" class="rail-item" draggable="false" v-bind="mark(item)">
                <el-icon v-if="item.icon" aria-hidden="true" class="stock-page-nav__icon"><component :is="item.icon" /></el-icon>{{ item.label }}
                <!-- 靠右的拖曳記號（2026-10-13「sidebar 靠右加上 icon 讓用戶知道他可以操作」）：整列都能拖，這只是提示；
                     aria-hidden，title 給滑鼠停留的人。粗指標（手機）不能拖，所以 CSS 一起藏起來 -->
                <!-- 六點握把（同日「換一個 icon」：十字箭頭 Rank 讀起來像「移動畫面」）；Element Plus 沒有這個圖示，所以內嵌 -->
                <el-icon v-if="draggable" class="stock-page-nav__drag" aria-hidden="true" title="拖曳調整順序">
                  <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
                </el-icon>
              </NuxtLink>
            </li>
          </ul>
        </li>
      </template>
      <li v-for="(item, index) in trailingItems" :key="item.label" :class="{ 'rail-divided': index === 0 }">
        <NuxtLink :to="item.to!(code)" class="rail-item" v-bind="mark(item)">
          <el-icon v-if="item.icon" aria-hidden="true" class="stock-page-nav__icon"><component :is="item.icon" /></el-icon>{{ item.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* 列、組標題、分隔線、目前頁的樣子在 main.css 的 .rail-*（全站側欄共用，2026-10-20）；這裡只留個股側欄自己才有的東西 */
.stock-page-nav {
  width: 100%;
}

/* 釘選那一段是巢狀清單：不再加上下內距 */
.stock-page-nav__sublist {
  margin: 0;
  padding: 0;
  list-style: none;
}

.stock-page-nav__icon {
  flex-shrink: 0;
  font-size: 1.125rem;
}

/* 拖曳記號靠右、淡色，滑過那一列才加深 */
.stock-page-nav__drag {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 1.125rem;
  color: var(--el-text-color-secondary);
  cursor: grab;
}

.stock-page-nav__pinned:hover .stock-page-nav__drag {
  color: var(--el-text-color-primary);
}

@media (pointer: coarse) {
  .stock-page-nav__drag {
    display: none;
  }
}

/* 名稱還沒讀到的列 */
.stock-page-nav__skeleton {
  width: 5em;
}

/* 拖曳中留在原位的那一列（sortable 的預設 ghostClass） */
.stock-page-nav__pinned.sortable-ghost {
  opacity: 0.4;
}
</style>
