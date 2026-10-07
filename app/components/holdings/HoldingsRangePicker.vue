<script setup lang="ts">
// 持股各頁的「期間」選擇（報酬與大盤、已實現損益、績效統計、風險共用）。值存在 useHoldingsRange()，切頁不重設。
const range = useHoldingsRange()
const labelId = useId()
</script>

<template>
  <div class="holdings-range">
    <span :id="labelId" class="holdings-range__label">期間</span>
    <el-date-picker
      v-model="range"
      type="daterange"
      value-format="YYYY-MM-DD"
      format="YYYY/MM/DD"
      start-placeholder="開始日期"
      end-placeholder="結束日期"
      range-separator="～"
      unlink-panels
      :clearable="false"
      :shortcuts="HOLDINGS_RANGE_SHORTCUTS"
      :disabled-date="holdingsIsFutureDate"
      :aria-labelledby="labelId"
      size="large"
    />
  </div>
</template>

<style scoped>
.holdings-range {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.holdings-range__label {
  font-weight: 600;
}
</style>
