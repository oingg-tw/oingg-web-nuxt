<script setup lang="ts">
import type { RankingRow } from '#shared/types/hub'

// 排行的名次清單：/rank/[slug] 的手機清單（2026-11-02，使用者從三個方案選了 C）與 /rank 首頁的分類卡片（2026-11-03 方案 B）共用。
// 名次、名稱與代號、數值；下面一條長條＝數值 ÷ 這份清單的最大值，負數不畫。每一列日期都一樣就交給 #head 寫一次，各家不同才寫在數值下面
const props = defineProps<{ rows: RankingRow[]; page: RankPageDefinition }>()

const maxValue = computed(() => Math.max(0, ...props.rows.map(row => row.value ?? 0)))
const shareOf = (value: number | null) => (value !== null && value > 0 && maxValue.value > 0 ? value / maxValue.value : 0)
const sharedDate = computed(() => {
  const dates = new Set(props.rows.map(row => row.knowledgeDate))
  return dates.size === 1 ? [...dates][0] ?? null : null
})
// 上游的 ETF 篩選結果多半不帶逐列日期（資料月份寫在標題），沒有就不寫
const hasRowDates = computed(() => props.rows.some(row => row.knowledgeDate))
</script>

<template>
  <slot name="head" :shared-date="sharedDate" :has-row-dates="hasRowDates" />
  <ol class="rank-list__rows">
    <li v-for="row in rows" :key="row.symbol" class="rank-list__row" :style="{ '--share': shareOf(row.value) }">
      <span class="rank-list__rank">{{ row.rank }}</span>
      <span class="rank-list__name"><NuxtLink :to="securityPath(row.symbol)">{{ row.name }}</NuxtLink><span class="rank-list__code">{{ row.symbol }}</span></span>
      <span class="rank-list__value">{{ rankValueText(page, row.value) }}<span v-if="!sharedDate && row.knowledgeDate" class="rank-list__date">{{ row.knowledgeDate }}</span></span>
      <span class="rank-list__bar" aria-hidden="true" />
    </li>
  </ol>
</template>

<style scoped>
.rank-list__rows {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* 名次佔兩列；名稱、數值一列，長條在下面一列 */
.rank-list__row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--app-divider);
}

.rank-list__rank {
  grid-row: 1 / span 2;
  font-size: 1.25rem;
  font-weight: 700;
  text-align: right;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.rank-list__name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  a {
    font-weight: 600;
    color: var(--el-color-primary-dark-2);
    text-underline-offset: 3px;
  }
}

.rank-list__code {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}

.rank-list__value {
  text-align: right;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
}

.rank-list__date {
  display: block;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

/* 長條：長度＝數值 ÷ 清單裡的最大值（--share 是 0～1） */
.rank-list__bar {
  grid-column: 2 / span 2;
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: var(--el-color-primary-light-9);
  overflow: hidden;
}

.rank-list__bar::after {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--share) * 100%);
  border-radius: 3px;
  background: var(--el-color-primary);
}
</style>
