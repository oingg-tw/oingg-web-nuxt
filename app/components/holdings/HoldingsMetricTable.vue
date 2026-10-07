<script setup lang="ts">
// 投資組合指標表（2026-10-07，交易績效與風險頁共用五張）：指標｜你的持股｜（同期加權指數）｜意思。
// 原生 <table> 而不是 el-table：mobile first——窄的時候每一列是一張小卡片（名稱與數值一行、大盤一行、意思一行），
// 表格區塊夠寬才是四欄表格。只改 CSS 不出第二份 DOM，作法同指標速覽的表格。
// 數值一律中性色（不用漲跌色暗示好壞，投信投顧法）。
withDefaults(defineProps<{
  caption: string
  rows: { name: string; value: string; market?: string; meaning?: string }[]
  valueLabel?: string
  // 有給才多一欄（例如「同期加權指數」）
  marketLabel?: string
}>(), { valueLabel: '你的持股', marketLabel: undefined })
</script>

<template>
  <div class="holdings-metric-table">
    <table class="seo-table holdings-metric-table__table">
      <caption class="visually-hidden">{{ caption }}</caption>
      <thead>
        <tr>
          <th scope="col">指標</th>
          <th scope="col" class="seo-table__num">{{ valueLabel }}</th>
          <th v-if="marketLabel" scope="col" class="seo-table__num">{{ marketLabel }}</th>
          <th v-if="rows.some(row => row.meaning)" scope="col">意思</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.name">
          <th scope="row">{{ row.name }}</th>
          <td class="seo-table__num holdings-metric-table__value">{{ row.value }}</td>
          <td v-if="marketLabel" class="seo-table__num" :data-label="marketLabel">{{ row.market ?? '－' }}</td>
          <td v-if="rows.some(item => item.meaning)" class="holdings-metric-table__meaning">{{ row.meaning }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.holdings-metric-table {
  container-type: inline-size;
}

/* 窄：每一列一張小卡片 */
.holdings-metric-table__table {
  display: block;
  background: none;
}

.holdings-metric-table__table thead {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.holdings-metric-table__table tbody {
  display: grid;
  gap: 8px;
}

.holdings-metric-table__table tbody tr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  align-items: baseline;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-card-border-radius, 4px);
  background: var(--el-bg-color);
}

.holdings-metric-table__table tbody th,
.holdings-metric-table__table tbody td {
  position: static;
  padding: 0;
  border: 0;
  white-space: normal;
  background: none;
}

.holdings-metric-table__table tbody th {
  font-weight: 600;
}

.holdings-metric-table__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.holdings-metric-table__table td[data-label],
.holdings-metric-table__meaning {
  grid-column: 1 / -1;
  text-align: left;
  color: var(--el-text-color-secondary);
}

.holdings-metric-table__table td[data-label]::before {
  content: attr(data-label) '：';
}

/* 寬：還原成表格 */
@container (min-width: 640px) {
  .holdings-metric-table__table {
    display: table;
    background: var(--el-bg-color);
  }

  .holdings-metric-table__table thead {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip-path: none;
  }

  .holdings-metric-table__table tbody {
    display: table-row-group;
  }

  .holdings-metric-table__table tbody tr {
    display: table-row;
    padding: 0;
    border: 0;
    border-radius: 0;
  }

  .holdings-metric-table__table tbody th,
  .holdings-metric-table__table tbody td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    vertical-align: top;
  }

  .holdings-metric-table__table tbody th {
    font-weight: 500;
    white-space: nowrap;
  }

  .holdings-metric-table__value {
    font-size: 1rem;
    font-weight: 600;
  }

  .holdings-metric-table__table td[data-label] {
    text-align: right;
    color: var(--el-text-color-primary);
  }

  .holdings-metric-table__table td[data-label]::before {
    content: none;
  }

  .holdings-metric-table__meaning {
    white-space: normal;
  }
}
</style>
