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
}>(), { code: '', items: () => STOCK_NAV_ITEMS, label: '個股頁面' })

const pinnedNodes = useStockPinnedMetricNodes()
// 釘選的指標只屬於個股頁面那一份清單；別的區域傳自己的 items 時不該長出「自選指標」那一段。
const showPinned = computed(() => props.items === STOCK_NAV_ITEMS)

// 三段：骨幹、使用者自己釘的（2026-09-26，有分隔線與小標題——沒有分界的話，釘選的列讀起來像網站少給了幾個入口）、
// 「找不到時去哪裡翻」的 trailing 列（2026-09-28 排在釘選後面，由 STOCK_NAV_ITEMS 的 trailing 旗標決定）。
const leadingItems = computed(() => props.items.filter(item => !item.trailing))
const trailingItems = computed(() => props.items.filter(item => item.trailing))

// 自選指標拖曳排序（2026-10-13，使用者：「sidebar 自選指標 希望可以用拖曳的方式就更新排序」）。sortablejs 的設定照
// PresetFolder.vue（篩選器分頁拖曳）調過的那一組：forceFallback（連結的原生拖曳會搶走手勢）、30ms 延遲、8px 容忍讓點連結仍是
// 點連結；粗指標（手機）不掛，免得跟捲動底部清單打架。鍵盤與單指替代路徑是指標速覽表格的上移／下移（WCAG 2.5.7）。
// onEnd 先還原 sortable 自己搬的 DOM，交給 Vue 依新的 pinnedSlugs 重畫，同 PresetFolder 的理由。
const { pinnedSlugs } = useStockPinnedMetrics()
const pinnedList = ref<HTMLElement>()
let sortable: Sortable | undefined

function reorder(oldIndex: number, newIndex: number) {
  // 清單上看得到的才參與排序；存了但已下架的 slug（pinnedNodes 濾掉的）原樣留在後面
  const visible = pinnedSlugs.value.filter(slug => METRIC_INDEX_BY_SLUG.has(slug))
  const [moved] = visible.splice(oldIndex, 1)
  visible.splice(newIndex, 0, moved!)
  pinnedSlugs.value = [...visible, ...pinnedSlugs.value.filter(slug => !METRIC_INDEX_BY_SLUG.has(slug))]
}

watch(pinnedList, (el) => {
  sortable?.destroy()
  sortable = undefined
  if (!el || matchMedia('(pointer: coarse)').matches) return
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
      reorder(oldIndex, newIndex)
    }
  })
})
onUnmounted(() => sortable?.destroy())
</script>

<template>
  <nav class="stock-page-nav" :aria-label="label">
    <!-- 釘選那一段不包 ClientOnly：useState 的預設值兩邊一致，那些列是帳號同步完成後才長出來的狀態變化，不是 hydration 不匹配。 -->
    <ul class="stock-page-nav__list">
      <li v-for="item in leadingItems" :key="item.label">
        <NuxtLink :to="item.to!(code)" class="stock-page-nav__link">
          <el-icon v-if="item.icon" aria-hidden="true" class="stock-page-nav__icon"><component :is="item.icon" /></el-icon>{{ item.label }}
        </NuxtLink>
      </li>
      <template v-if="showPinned && pinnedNodes.length">
        <li class="stock-page-nav__heading">自選指標</li>
        <li>
          <ul ref="pinnedList" class="stock-page-nav__list">
            <li v-for="item in pinnedNodes" :key="item.label" class="stock-page-nav__pinned">
              <!-- draggable="false"：連結的原生拖曳（拖出網址）會搶走 sortable 的手勢 -->
              <NuxtLink :to="item.to!(code)" class="stock-page-nav__link" draggable="false">
                <el-icon v-if="item.icon" aria-hidden="true" class="stock-page-nav__icon"><component :is="item.icon" /></el-icon>{{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </li>
      </template>
      <li v-for="(item, index) in trailingItems" :key="item.label" :class="{ 'stock-page-nav__divided': index === 0 }">
        <NuxtLink :to="item.to!(code)" class="stock-page-nav__link">
          <el-icon v-if="item.icon" aria-hidden="true" class="stock-page-nav__icon"><component :is="item.icon" /></el-icon>{{ item.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.stock-page-nav {
  width: 100%;
}

.stock-page-nav__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 整列可點（連結撐滿 li），48px 是本站的觸控下限 */
.stock-page-nav__link {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px 20px;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.stock-page-nav__link:hover {
  background: var(--el-fill-color-light);
}

/* 側欄與底部清單都是 overflow 容器，全站的 2px 外框會被邊緣裁掉，所以往內畫 */
.stock-page-nav__link:focus-visible {
  outline-offset: -2px;
  border-radius: 0;
}

/* 目前頁：粗體＋底線＋底色一起上——顏色從來不是唯一的線索 */
.stock-page-nav__link[aria-current='page'] {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-9);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}

.stock-page-nav__icon {
  flex-shrink: 0;
  font-size: 1.125rem;
}

/* 兩條分隔線長得一樣，因為分的是同一種東西：骨幹｜自己釘的｜找不到時去翻的 */
.stock-page-nav__heading {
  margin-top: 8px;
  padding: 12px 20px 4px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

/* 拖曳中留在原位的那一列（sortable 的預設 ghostClass） */
.stock-page-nav__pinned.sortable-ghost {
  opacity: 0.4;
}

.stock-page-nav__divided {
  margin-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
