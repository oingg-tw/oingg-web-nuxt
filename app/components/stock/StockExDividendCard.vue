<script setup lang="ts">
import type { ExDividendNotice } from '~/composables/stock/useExDividendNotices'

// 2026-09-15 從合併的股利卡拆回獨立檔案（「股利卡片幫我拆開，另外建立」）；這一半的內容與邏輯在合併期間沒改過，原樣還原。
const props = defineProps<{
  notices: ExDividendNotice[]
}>()

// Multiple future entries are possible in principle, but the nearest one is what's actually
// actionable right now — show that, not a full list. Entries aren't guaranteed sorted by the
// API, so sort explicitly rather than assuming array order.
const nextNotice = computed<ExDividendNotice | null>(() => {
  if (!props.notices.length) return null
  return [...props.notices].sort((a, b) => a.exDate.localeCompare(b.exDate))[0]!
})

// 0 跟沒有值一樣不寫：櫃買預告表沒有現增的列填 0（月曆 2026-11-24 同一條）。只寫股利（2026-11-26 現金增資頁上線，使用者 11-25「好 案照建議」）：
// 純現增不會到這裡（useExDividendNotices 濾掉），配股又現增的那一筆也只寫配股，現增的認購價、繳款期間在現金增資頁
interface FieldDef {
  label: string
  format: (notice: ExDividendNotice) => string | null
}

const FIELD_DEFS: FieldDef[] = [
  { label: '現金股利', format: n => (n.cashDividend ? `${n.cashDividend.toFixed(2)} 元` : null) },
  { label: '股票股利比例', format: n => (n.stockDividendRatio ? String(n.stockDividendRatio) : null) }
]

const visibleFields = computed(() => {
  if (!nextNotice.value) return []
  const notice = nextNotice.value
  return FIELD_DEFS.map(def => ({ label: def.label, value: def.format(notice) })).filter((field): field is { label: string; value: string } => field.value !== null)
})
</script>

<template>
  <el-card class="ex-dividend-card" shadow="never">
    <template #header>
      <StockCardTitle title="下次除權息" />
    </template>

    <SharedEmptyState v-if="!nextNotice" description="目前查無排定的除權息" />
    <template v-else>
      <div class="ex-dividend-card__headline">
        <span class="ex-dividend-card__date">{{ nextNotice.exDate }}</span>
        <el-tag size="small" type="warning">{{ nextNotice.exType }}</el-tag>
      </div>
      <div class="ex-dividend-card__grid">
        <div v-for="field in visibleFields" :key="field.label" class="ex-dividend-card__field">
          <span class="ex-dividend-card__label">{{ field.label }}</span>
          <span class="ex-dividend-card__value">{{ field.value }}</span>
        </div>
      </div>
    </template>
  </el-card>
</template>

<style scoped>
.ex-dividend-card {
  border-radius: 12px;
}

.ex-dividend-card__headline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.ex-dividend-card__date {
  font-size: 1.25rem;
  font-weight: 600;
}

.ex-dividend-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px 16px;
}

.ex-dividend-card__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ex-dividend-card__label {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.ex-dividend-card__value {
  font-size: 1rem;
  font-weight: 600;
}
</style>
