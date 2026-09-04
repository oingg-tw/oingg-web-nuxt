<script setup lang="ts">
import type { ExDividendNotice } from '~/composables/stock/useExDividendNotices'

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

// Raw-value display for the four subscription-group fields — their exact meaning is
// analysis-ts's own best-guess translation of twse-ts's raw columns, not confirmed against
// twse-ts directly (see useExDividendNotices.ts's own comment). No unit conversion (e.g. *100,
// *1000) is applied since guessing the wrong one would show a confidently-wrong number, which
// is worse than an honestly plain one.
interface FieldDef {
  label: string
  format: (notice: ExDividendNotice) => string | null
}

const FIELD_DEFS: FieldDef[] = [
  { label: '現金股利', format: n => (n.cashDividend === null ? null : `${n.cashDividend.toFixed(2)} 元`) },
  { label: '股票股利比例', format: n => (n.stockDividendRatio === null ? null : String(n.stockDividendRatio)) },
  { label: '認購比例', format: n => (n.subscriptionRatio === null ? null : String(n.subscriptionRatio)) },
  { label: '認購價', format: n => (n.subscriptionPricePerShare === null ? null : `${n.subscriptionPricePerShare} 元`) },
  { label: '提撥股數', format: n => (n.sharesOffered === null ? null : n.sharesOffered.toLocaleString('zh-TW')) },
  { label: '員工認購股數', format: n => (n.sharesEmpOwner === null ? null : n.sharesEmpOwner.toLocaleString('zh-TW')) },
  { label: '股東認購股數', format: n => (n.sharesholderOwner === null ? null : n.sharesholderOwner.toLocaleString('zh-TW')) },
  { label: '持股比例', format: n => (n.stockHoldingRatio === null ? null : String(n.stockHoldingRatio)) }
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
      <span class="ex-dividend-card__title">下次除權息</span>
    </template>

    <el-empty v-if="!nextNotice" description="目前查無排定的除權息" :image-size="64" />
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
      <!-- 認購比例/提撥股數/員工認購股數/股東認購股數/持股比例 field names are analysis-ts's own
           best-guess translation of twse-ts's raw columns, not yet confirmed directly against
           twse-ts (see useExDividendNotices.ts) — shown as plain raw numbers, no % or per-
           thousand-shares conversion applied, since guessing the wrong unit would be worse
           than an honestly plain number. -->
      <p v-if="nextNotice.exType !== '息'" class="ex-dividend-card__note">認購相關欄位為原始數值，尚未確認實際單位換算</p>
    </template>
  </el-card>
</template>

<style scoped>
.ex-dividend-card {
  border-radius: 12px;
}

.ex-dividend-card__title {
  font-weight: 600;
}

.ex-dividend-card__headline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.ex-dividend-card__date {
  font-size: 20px;
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
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.ex-dividend-card__value {
  font-size: 16px;
  font-weight: 600;
}

.ex-dividend-card__note {
  margin: 16px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
