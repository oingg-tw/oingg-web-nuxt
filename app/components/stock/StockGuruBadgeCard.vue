<script setup lang="ts">
import { InfoFilled, Trophy } from '@element-plus/icons-vue'
import { GURU_BADGE_CATEGORIES, GURU_BADGE_DISCLAIMER, GURU_CATEGORY_COLOR, primaryGuruBadgeByCategory } from '~/utils/guru-badges'
import type { GuruBadge } from '~/utils/guru-badges'

const INFO_TEXT = '每個面向取一個代表性的公開學術方法論'

// Stock-detail page's own 8-dimension badge overview — per direct request ("個股瀏覽 要有一張
// 卡片，這張卡片有八個面向的徽章"). Shows one badge per GURU_BADGE_CATEGORIES slot, using
// whichever real methodology is "primary" for that category (see guru-badges.ts's own
// primaryGuruBadgeByCategory comment) — 3 categories currently have more than one real badge
// (獲利品質/財務韌性/市場評價), this card only surfaces one of each, not all of them; the full
// set is still browsable on the dedicated /guru-indicators gallery.
//
// Per direct confirmation (AskUserQuestion, 2026-09-09): this card queries THIS symbol's real
// live value for each populated category (via POST /screener/values, same mechanism as the
// dashboard's own 個股健檢 card — see useGuruBadgeScores.ts), not just a static category list.
// Categories with no real backing methodology yet (originally 4 — 成長動能/營運周轉 filled in
// 2026-09-09, leaving 股東回饋/大戶籌碼 — see guru-badges.ts's own comment for why those two
// specifically still have none) show an explicit "尚未提供" tile instead of being silently
// omitted or filled with a fabricated number — same "尚未提供" convention already established
// for non-2330 symbols on StockForeignShareholdingChart.vue.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)

const primaryByCategory = primaryGuruBadgeByCategory()
const fieldIds = Object.values(primaryByCategory).map(badge => badge!.fieldId)

const { data: scores, pending } = useGuruBadgeScores(symbolRef, fieldIds)

// Unit suffixes aren't available from GET /filters yet (every field's `unit` is currently null,
// see project_screener_backend_outage memory) — hardcoded here for the 4 badges this card
// actually renders, same conservative "only the ones I've confirmed" approach
// StockHealthCheckCard.vue already uses for its own PERCENT_FIELDS set. Re-verified live via
// curl against POST /screener/values for 2330 before writing these.
const UNIT_BY_BADGE_ID: Record<string, string> = {
  'piotroski-f-score': '/9分',
  'nissim-penman-rnoa': '%',
  'graham-number': '元',
  'sustainable-growth-rate': '%',
  'cash-conversion-cycle': '天'
}

function formatValue(badge: GuruBadge): string {
  const entry = scores.value?.[badge.fieldId]
  if (!entry || entry.value === null) return '尚無資料'
  return `${entry.value}${UNIT_BY_BADGE_ID[badge.id] ?? ''}`
}

function asOfDate(badge: GuruBadge): string | null {
  return scores.value?.[badge.fieldId]?.asOfDate ?? null
}

const dialogBadge = ref<GuruBadge | null>(null)
</script>

<template>
  <el-card class="stock-guru-badge-card" shadow="never">
    <template #header>
      <span class="stock-guru-badge-card__title">
        徽章總覽（八面向）
        <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
          <el-icon class="stock-guru-badge-card__info"><InfoFilled /></el-icon>
        </el-tooltip>
      </span>
    </template>

    <div v-loading="pending" class="stock-guru-badge-card__grid">
      <template v-for="category in GURU_BADGE_CATEGORIES" :key="category">
        <button
          v-if="primaryByCategory[category]"
          type="button"
          class="stock-guru-badge-card__tile"
          @click="dialogBadge = primaryByCategory[category]!"
        >
          <div class="stock-guru-badge-card__medal" :style="{ background: GURU_CATEGORY_COLOR[category] }">
            <el-icon><Trophy /></el-icon>
          </div>
          <p class="stock-guru-badge-card__category">{{ category }}</p>
          <p class="stock-guru-badge-card__name">{{ primaryByCategory[category]!.name }}</p>
          <p class="stock-guru-badge-card__value">{{ formatValue(primaryByCategory[category]!) }}</p>
          <p v-if="asOfDate(primaryByCategory[category]!)" class="stock-guru-badge-card__date">
            {{ asOfDate(primaryByCategory[category]!) }}
          </p>
        </button>
        <div v-else class="stock-guru-badge-card__tile stock-guru-badge-card__tile--empty">
          <p class="stock-guru-badge-card__category">{{ category }}</p>
          <p class="stock-guru-badge-card__empty-note">尚未提供</p>
        </div>
      </template>
    </div>
  </el-card>

  <el-dialog
    :model-value="dialogBadge !== null"
    :title="dialogBadge?.name"
    width="min(560px, 92vw)"
    align-center
    append-to-body
    @update:model-value="dialogBadge = null"
  >
    <template v-if="dialogBadge">
      <p class="stock-guru-badge-card__dialog-author">{{ dialogBadge.nameEn }}｜{{ dialogBadge.author }}</p>
      <p class="stock-guru-badge-card__dialog-value">
        {{ symbol }} 目前數值：{{ formatValue(dialogBadge) }}
        <span v-if="asOfDate(dialogBadge)" class="stock-guru-badge-card__dialog-date">（{{ asOfDate(dialogBadge) }}）</span>
      </p>
      <p class="stock-guru-badge-card__dialog-detail">{{ dialogBadge.detail }}</p>
      <p class="stock-guru-badge-card__dialog-disclaimer">{{ GURU_BADGE_DISCLAIMER }}</p>
    </template>
  </el-dialog>
</template>

<style scoped>
.stock-guru-badge-card {
  border-radius: 12px;
  grid-column: 1 / -1;
}

.stock-guru-badge-card__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.stock-guru-badge-card__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.stock-guru-badge-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.stock-guru-badge-card__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s ease;
}

.stock-guru-badge-card__tile:hover {
  border-color: var(--el-color-primary-light-5);
}

.stock-guru-badge-card__tile--empty {
  cursor: default;
  opacity: 0.6;
}

.stock-guru-badge-card__tile--empty:hover {
  border-color: var(--el-border-color-lighter);
}

.stock-guru-badge-card__medal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: #fff;
  font-size: 18px;
}

.stock-guru-badge-card__category {
  margin: 4px 0 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-card__name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.stock-guru-badge-card__value {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.stock-guru-badge-card__date {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.stock-guru-badge-card__empty-note {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.stock-guru-badge-card__dialog-author {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-card__dialog-value {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.stock-guru-badge-card__dialog-date {
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.stock-guru-badge-card__dialog-detail {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.stock-guru-badge-card__dialog-disclaimer {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
