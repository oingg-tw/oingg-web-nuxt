<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'
import type { ExDividendNotice } from '~/composables/stock/useExDividendNotices'

// Merged from StockDividendStabilityCard.vue (配息穩定度) + StockExDividendCard.vue
// (下次除權息) into one "股利資訊" card per direct request 2026-09-14 ("股東回饋 下次除權息
// 希望可以跟 配息穩定度 合併呈現，卡片要更名") — both cards live in 股東回饋 and describe the
// same underlying thing (this stock's dividend behavior) from two angles: the stability tiles
// are "how has it behaved historically," the ex-dividend section is "what's coming up next."
// Kept as two clearly-labeled sub-sections rather than one flattened list — the tiles are
// snapshot/TTM/FY metrics from useDividendStabilitySnapshot, the ex-dividend section is a
// separate notice feed passed in as a prop (same as before, sourced from useExDividendNotices at
// the page level) — different data shapes, no reason to force them into one visual unit beyond
// living in the same card.
const INFO_TEXT = '殖利率／發放率／連續年數／總回饋率／除權息'

const props = defineProps<{
  symbol: string
  notices: ExDividendNotice[]
}>()

const symbolRef = computed(() => props.symbol)
const { data, units, pending } = useDividendStabilitySnapshot(symbolRef)

interface Tile {
  key: string
  label: string
  raw: ScreenerFieldValue | null | undefined
}

const tiles = computed<Tile[]>(() => [
  { key: 'dividendYield.EOD', label: '殖利率', raw: data.value?.['dividendYield.EOD'] },
  { key: 'dividendPayoutRatio.TTM', label: '盈餘發放率', raw: data.value?.['dividendPayoutRatio.TTM'] },
  { key: 'consecutiveDividendYears.FY', label: '連續配息年數', raw: data.value?.['consecutiveDividendYears.FY'] },
  // Added 2026-09-14 — the one genuinely new number this card gained (see
  // useDividendStabilitySnapshot.ts's own comment): (股利+買回)/市值，涵蓋現金股利以外的
  // 買回庫藏股回饋，前 3 個 tile 都只涵蓋股利本身這一半。
  { key: 'shareholderYield.TTM', label: '股東總回饋率', raw: data.value?.['shareholderYield.TTM'] }
])

const hasStabilityData = computed(() => tiles.value.some(tile => tile.raw?.value !== null && tile.raw?.value !== undefined))

function formatValue(tile: Tile): string {
  if (!tile.raw || tile.raw.value === null) return '—'
  const unit = units.value[tile.key] ?? ''
  return `${tile.raw.value}${unit}`
}

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
  <el-card class="dividend-info-card" shadow="never">
    <template #header>
      <div class="dividend-info-card__header">
        <span class="dividend-info-card__title">
          股利資訊
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dividend-info-card__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>

    <el-empty v-if="!pending && !hasStabilityData && !nextNotice" description="這檔股票尚無配息相關資料" :image-size="64" />
    <template v-else>
      <div v-loading="pending" class="dividend-info-card__section">
        <p class="dividend-info-card__section-title">配息穩定度</p>
        <div v-if="hasStabilityData" class="dividend-info-card__tiles">
          <div v-for="tile in tiles" :key="tile.key" class="dividend-info-card__tile">
            <span class="dividend-info-card__tile-label">{{ tile.label }}</span>
            <span class="dividend-info-card__tile-value">{{ formatValue(tile) }}</span>
            <span v-if="tile.raw?.knowledgeDate" class="dividend-info-card__tile-date">{{ tile.raw.knowledgeDate }}</span>
          </div>
        </div>
        <p v-else class="dividend-info-card__empty-note">尚無配息穩定度相關資料</p>
      </div>

      <el-divider class="dividend-info-card__divider" />

      <div class="dividend-info-card__section">
        <p class="dividend-info-card__section-title">下次除權息</p>
        <p v-if="!nextNotice" class="dividend-info-card__empty-note">目前查無排定的除權息</p>
        <!-- Wrapped in the same tinted box the 配息穩定度 tiles above already use — real gap
             fixed 2026-09-14 (reported live: "看起來有點醜") — this section used to render as
             plain text floating directly on the card's own background, visually disconnected
             from (and a full step down in weight from) the boxed tiles right above it, even
             though both sections describe the same underlying thing. One shared box style now
             covers both halves of this merged card. -->
        <div v-else class="dividend-info-card__next">
          <div class="dividend-info-card__headline">
            <span class="dividend-info-card__date">{{ nextNotice.exDate }}</span>
            <el-tag size="small" type="warning">{{ nextNotice.exType }}</el-tag>
          </div>
          <div class="dividend-info-card__grid">
            <div v-for="field in visibleFields" :key="field.label" class="dividend-info-card__field">
              <span class="dividend-info-card__label">{{ field.label }}</span>
              <span class="dividend-info-card__value">{{ field.value }}</span>
            </div>
          </div>
          <!-- 認購比例/提撥股數/員工認購股數/股東認購股數/持股比例 field names are analysis-ts's own
               best-guess translation of twse-ts's raw columns, not yet confirmed directly against
               twse-ts (see useExDividendNotices.ts) — shown as plain raw numbers, no % or per-
               thousand-shares conversion applied, since guessing the wrong unit would be worse
               than an honestly plain number. -->
          <p v-if="nextNotice.exType !== '息'" class="dividend-info-card__note">認購相關欄位為原始數值，尚未確認實際單位換算</p>
        </div>
      </div>
    </template>
  </el-card>
</template>

<style scoped>
.dividend-info-card {
  border-radius: 12px;
}

.dividend-info-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dividend-info-card__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dividend-info-card__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.dividend-info-card__section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dividend-info-card__divider {
  margin: 20px 0;
}

.dividend-info-card__empty-note {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.dividend-info-card__tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.dividend-info-card__tile {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dividend-info-card__tile-label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.dividend-info-card__tile-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dividend-info-card__tile-date {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.dividend-info-card__next {
  padding: 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dividend-info-card__headline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.dividend-info-card__date {
  font-size: 20px;
  font-weight: 600;
}

.dividend-info-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px 16px;
}

.dividend-info-card__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dividend-info-card__label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.dividend-info-card__value {
  font-size: 16px;
  font-weight: 600;
}

.dividend-info-card__note {
  margin: 16px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
