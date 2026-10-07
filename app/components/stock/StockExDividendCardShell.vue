<script setup lang="ts">
// StockExDividendCard 的載入中骨架：頁面層的 useExDividendNotices() 還沒回來時顯示。同 StockProfileCardShell 的
// 「只做版面結構，不放任何數字」慣例；文字是「資料載入中」，不是早期沒有 API 時的「資料尚未提供」。
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
