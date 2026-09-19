<script setup lang="ts">
// Split back out of StockDividendInfoCardShell.vue 2026-09-15 alongside StockExDividendCard.vue
// itself (see that file's own comment) — loading-state placeholder shown while
// useExDividendNotices() at the page level hasn't resolved yet, same "只做版面結構，不放任何
// 數字" convention as StockChartShell.vue/StockProfileCardShell.vue. Not the same content as the
// old pre-merge StockExDividendCardShell.vue (that version predated a real API existing at all
// and said "資料尚未提供" — real data has been wired since, this one says "資料載入中" like every
// other loading shell in this app).
const FIELDS = ['除權息基準日', '類型', '現金股利', '股票股利比例']
</script>

<template>
  <el-card class="ex-dividend-shell" shadow="never">
    <template #header>
      <StockCardTitle title="下次除權息" />
    </template>

    <div class="ex-dividend-shell__grid">
      <div v-for="label in FIELDS" :key="label" class="ex-dividend-shell__field">
        <span class="ex-dividend-shell__label">{{ label }}</span>
        <span class="ex-dividend-shell__value" />
      </div>
    </div>

    <p class="ex-dividend-shell__note">資料載入中</p>
  </el-card>
</template>

<style scoped>
.ex-dividend-shell {
  border-radius: 12px;
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
  font-size: 1rem;
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
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
