<script setup lang="ts">
import type { MacroPageData } from '#shared/types/hub'

// 消費者物價頁的分項（2026-11-24，使用者 11-23「CPI 可以點開分項」）：七大類最新一期的年增率一類一列，點開看那一類的各分項（往下一層縮排）。
// 伺服器只給最新一期（81 項的完整歷史約 2.8 MB 留在伺服器）
const props = defineProps<{ items: NonNullable<MacroPageData['cpiItems']> }>()

const pct = (value: number | null) => (value === null ? '－' : minusSign(`${value.toFixed(2)}%`))
// 七大類，各自帶著它底下的分項（照主計總處的順序，下一個七大類之前的都是它的）
const groups = computed(() => {
  const list: { item: (typeof props.items)[number]; children: typeof props.items }[] = []
  for (const item of props.items) {
    if (item.depth === 0) list.push({ item, children: [] })
    else if (item.depth > 0) list.at(-1)?.children.push(item)
  }
  return list
})
const month = computed(() => props.items.find(item => item.depth === 0)?.yearMonth ?? null)
// 年增率最高與最低的大類
const answer = computed(() => {
  const ranked = groups.value.map(group => group.item).filter(item => item.yoyChangePct !== null).sort((a, b) => b.yoyChangePct! - a.yoyChangePct!)
  if (!ranked.length) return ''
  const top = ranked[0]!
  const bottom = ranked.at(-1)!
  return `${month.value} 七大類裡年增率最高的是${top.name}（${pct(top.yoyChangePct)}），最低的是${bottom.name}（${pct(bottom.yoyChangePct)}）。`
})
</script>

<template>
  <section class="stock-page-section" aria-labelledby="macro-cpi-items-heading">
    <h2 id="macro-cpi-items-heading" class="stock-page-section__title">哪一類的物價漲得多？</h2>
    <p class="hub-answer">{{ answer }}</p>
    <div class="app-card macro-cpi-items">
      <details v-for="group in groups" :key="group.item.name" class="app-disclosure macro-cpi-items__group">
        <summary class="macro-cpi-items__summary">
          <span class="macro-cpi-items__name">{{ group.item.name }}</span>
          <span class="macro-cpi-items__value">{{ pct(group.item.yoyChangePct) }}</span>
        </summary>
        <ul class="macro-cpi-items__list">
          <li v-for="child in group.children" :key="child.name" class="macro-cpi-items__row" :style="{ paddingInlineStart: `calc(23px + ${(child.depth - 1) * 1.25}rem)` }">
            <span>{{ child.name }}</span>
            <span class="macro-cpi-items__value">{{ pct(child.yoyChangePct) }}<template v-if="child.yearMonth && child.yearMonth !== group.item.yearMonth">（{{ child.yearMonth }}）</template></span>
          </li>
        </ul>
      </details>
    </div>
  </section>
</template>

<style scoped>
.macro-cpi-items {
  padding: 4px 16px;
}

.macro-cpi-items__group + .macro-cpi-items__group {
  border-top: 1px solid var(--app-divider);
}

/* 摘要列的箭頭（.app-disclosure 的 ::before）也是一個 flex 項目：名字撐開，數字靠右；分項從名字那一欄開始（箭頭 7px＋左右 3px＋間距 10px） */
.macro-cpi-items__name {
  flex: 1;
}

.macro-cpi-items__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.macro-cpi-items__value {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.macro-cpi-items__list {
  list-style: none;
  max-width: none;
  margin: 0 0 12px;
  padding: 0;
}

.macro-cpi-items__row {
  padding-block: 6px;
  color: var(--el-text-color-regular);
}
</style>
