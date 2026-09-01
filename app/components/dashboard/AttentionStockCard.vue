<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'

// Card shell for 注意股票 (attention_stock) — NOT a ranking, a warning list (TWSE/TPEx's own
// 「處置股」/「注意股」 mechanism: a stock trips a threshold — e.g. abnormal volume, three
// consecutive days of large swings — and gets flagged, sometimes with actual trading
// restrictions attached). No backend source wired up yet — fixture data only.
export interface AttentionStockRow {
  code: string
  name: string
  reason: string // 注意原因，e.g. "連續三日達注意標準"
  announcedAt: string // 公告日期
}

const FIXTURE_ROWS: AttentionStockRow[] = [
  { code: '6547', name: '高端疫苗', reason: '最近六個營業日內累積漲幅達 32%，達注意標準', announcedAt: '2026-08-31' },
  { code: '3661', name: '世芯-KY', reason: '本益比為負數，且當日成交量放大達 5 倍以上', announcedAt: '2026-08-31' },
  { code: '2489', name: '瑞軒', reason: '連續三個營業日達注意標準且累積成交量占已發行股數比率過高', announcedAt: '2026-08-30' }
]
</script>

<template>
  <el-card class="attention-stock-card" shadow="never">
    <template #header>
      <span>今日注意股票</span>
    </template>

    <ul class="attention-stock-card__list">
      <li v-for="row in FIXTURE_ROWS" :key="row.code" class="attention-stock-card__item">
        <el-icon class="attention-stock-card__icon"><WarningFilled /></el-icon>
        <div class="attention-stock-card__body">
          <div class="attention-stock-card__stock">
            <span class="attention-stock-card__name">{{ row.name }}</span>
            <span class="attention-stock-card__code">{{ row.code }}</span>
          </div>
          <p class="attention-stock-card__reason">{{ row.reason }}</p>
          <span class="attention-stock-card__date">{{ row.announcedAt }}</span>
        </div>
      </li>
    </ul>

    <p class="attention-stock-card__note">示意資料，尚未串接即時注意股票清單</p>
  </el-card>
</template>

<style scoped>
.attention-stock-card__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.attention-stock-card__item {
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.attention-stock-card__item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.attention-stock-card__icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 18px;
  color: var(--el-color-warning);
}

.attention-stock-card__body {
  min-width: 0;
}

.attention-stock-card__stock {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.attention-stock-card__name {
  font-weight: 600;
}

.attention-stock-card__code {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.attention-stock-card__reason {
  margin: 2px 0;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

.attention-stock-card__date {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.attention-stock-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
