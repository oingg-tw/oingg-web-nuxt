<script setup lang="ts">
// Structural-only placeholder for a future "下次除權息" card — twse-ts's export.ex_dividend_notice
// is real (109 rows in prod, confirmed by analysis-ts 2026-09-04) but there's no public API for
// it yet, same situation 股本變化 was in before analysis-ts stood up a dedicated endpoint (see
// useCapitalStockHistory.ts's own history). Field labels here mirror the real schema exactly
// (ex_date/ex_type/cash_dividend/stock_dividend_ratio) so this shows the actual shape of the
// eventual card — only the values are skeleton blocks, per the same "只做版面結構，不放任何數字"
// direction as StockChartShell.vue/StockProfileCardShell.vue.
const FIELDS: string[] = ['除權息基準日', '類型', '現金股利', '股票股利比例']
</script>

<template>
  <el-card class="ex-dividend-shell" shadow="never">
    <template #header>
      <span class="ex-dividend-shell__title">下次除權息</span>
    </template>

    <div class="ex-dividend-shell__grid">
      <div v-for="label in FIELDS" :key="label" class="ex-dividend-shell__field">
        <span class="ex-dividend-shell__label">{{ label }}</span>
        <span class="ex-dividend-shell__value" />
      </div>
    </div>

    <p class="ex-dividend-shell__note">資料尚未提供</p>
  </el-card>
</template>

<style scoped>
.ex-dividend-shell {
  border-radius: 12px;
}

.ex-dividend-shell__title {
  font-weight: 600;
}

.ex-dividend-shell__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px 16px;
}

.ex-dividend-shell__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ex-dividend-shell__label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.ex-dividend-shell__value {
  height: 14px;
  width: 70%;
  border-radius: 4px;
  background: var(--el-fill-color);
}

.ex-dividend-shell__note {
  margin: 20px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
