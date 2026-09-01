<script setup lang="ts">
// Card shell for 加權指數 (TAIEX) 今日開高低收 — the one card here that's a single index
// snapshot rather than a per-stock ranking/list. No backend source wired up yet — fixture
// data only.
const FIXTURE = {
  open: 23_148.32,
  high: 23_302.11,
  low: 23_095.67,
  close: 23_260.85,
  change: 112.53,
  changePercent: 0.49
}
</script>

<template>
  <el-card class="taiex-index-card" shadow="never">
    <template #header>
      <span>加權指數</span>
    </template>

    <div class="taiex-index-card__headline">
      <span class="taiex-index-card__close">{{ FIXTURE.close.toLocaleString('zh-TW') }}</span>
      <span class="taiex-index-card__change" :class="FIXTURE.change >= 0 ? 'is-buy' : 'is-sell'">
        {{ FIXTURE.change > 0 ? '+' : '' }}{{ FIXTURE.change.toFixed(2) }}
        （{{ FIXTURE.changePercent > 0 ? '+' : '' }}{{ FIXTURE.changePercent.toFixed(2) }}%）
      </span>
    </div>

    <div class="taiex-index-card__ohlc">
      <div class="taiex-index-card__field">
        <span class="taiex-index-card__label">開盤</span>
        <span>{{ FIXTURE.open.toLocaleString('zh-TW') }}</span>
      </div>
      <div class="taiex-index-card__field">
        <span class="taiex-index-card__label">最高</span>
        <span class="is-buy">{{ FIXTURE.high.toLocaleString('zh-TW') }}</span>
      </div>
      <div class="taiex-index-card__field">
        <span class="taiex-index-card__label">最低</span>
        <span class="is-sell">{{ FIXTURE.low.toLocaleString('zh-TW') }}</span>
      </div>
      <div class="taiex-index-card__field">
        <span class="taiex-index-card__label">收盤</span>
        <span>{{ FIXTURE.close.toLocaleString('zh-TW') }}</span>
      </div>
    </div>

    <p class="taiex-index-card__note">示意資料，尚未串接即時加權指數</p>
  </el-card>
</template>

<style scoped>
.taiex-index-card__headline {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.taiex-index-card__close {
  font-size: 28px;
  font-weight: 700;
}

.taiex-index-card__change {
  font-size: 16px;
  font-weight: 600;
}

.taiex-index-card__ohlc {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.taiex-index-card__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-size: 16px;
  font-weight: 600;
}

.taiex-index-card__label {
  font-size: 16px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.is-buy {
  color: var(--price-up-color);
}

.is-sell {
  color: var(--price-down-color);
}

.taiex-index-card__note {
  margin: 16px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
