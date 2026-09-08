<script setup lang="ts">
import { Trophy } from '@element-plus/icons-vue'
import { GURU_BADGE_CATEGORIES, GURU_BADGE_DISCLAIMER, GURU_CATEGORY_COLOR, primaryGuruBadgeByCategory } from '~/utils/guru-badges'
import type { GuruBadge } from '~/utils/guru-badges'

// Stock-detail page's own multi-dimension badge overview — per direct request ("個股瀏覽 要有一張
// 卡片，這張卡片有八個面向的徽章"). Shows one badge per GURU_BADGE_CATEGORIES slot, using
// whichever real methodology is "primary" for that category (see guru-badges.ts's own
// primaryGuruBadgeByCategory comment) — 3 categories currently have more than one real badge
// (獲利品質/財務韌性/市場評價), this card only surfaces one of each, not all of them; the full
// set is still browsable on the dedicated /guru-indicators gallery.
//
// Per direct confirmation (AskUserQuestion, 2026-09-09): this card queries THIS symbol's real
// live value for each populated category (via POST /screener/values, same mechanism as the
// dashboard's own 個股健檢 card — see useGuruBadgeScores.ts), not just a static category list.
//
// Categories with no real backing methodology (股東回饋/大戶籌碼 — see guru-badges.ts's own
// comment for why) render no tile at all — `displayedCategories` below filters to only
// categories that actually have a badge, so this naturally scales back up the moment a real
// methodology + field is found for either, with no further code change needed here.
//
// Rebuilt several times the same day (2026-09-09) before landing here:
// 1. Each badge as its own tile with name/fraction/raw value/date all visible on the overview
//    itself — rejected ("方向不對，因為用戶如果看到 8/9 代表有九個徽章，用戶滿足8個。用戶一眼不
//    會看到模型名稱與計分標準，甚至日期"): Piotroski F-Score's own 0-9 scale next to five other
//    badges' 1-point fractions read as "N out of TOTAL BADGES," not "N out of THIS ONE model's
//    own scale."
// 2. Collapsed into one combined headline ("幾個徽章符合標準（N/總徽章數）") plus small plain
//    icons with no numbers — rejected ("不是這樣。六個面向的徽章要分開計分"): merging every
//    category into one number lost the per-dimension information the card exists to show.
// 3. Small icons each showing their own fraction, but too small/compact — corrected ("樣式要改成
//    舊版，大的，均勻占滿整個row"): back to big tiles that fill the row evenly, like design #1's
//    own layout, just without the name/date text on the tile itself.
// 4. Each tile opened the SAME shared list dialog — corrected ("每個面向的指標，彈窗不共用"):
//    every tile now opens its OWN dialog again (matching GuruBadgeCard.vue's own per-badge
//    dialog on the /guru-indicators gallery), not one combined list.
//
// Landed on: big tiles filling the row (like #1), each showing only its category + fraction (not
// #1's name/value/date clutter), each opening its own individual dialog (not #2/#3's shared one)
// with the full detail (name, author, threshold, raw value, date) — the fraction is the only
// thing visible at a glance, everything else is one click away.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)

const primaryByCategory = primaryGuruBadgeByCategory()
const displayedCategories = GURU_BADGE_CATEGORIES.filter(category => primaryByCategory[category])
const displayedBadges = displayedCategories.map(category => primaryByCategory[category]!)
// Every field a threshold might need: each badge's own fieldId plus any extraFieldIds (e.g.
// Graham Number/NCAV need the stock's own price to compare against) — deduped since
// 'stockPrice.Q' would otherwise be requested twice (both Graham Number and NCAV need it).
const fieldIds = [...new Set(displayedBadges.flatMap(badge => [badge.fieldId, ...(badge.threshold.extraFieldIds ?? [])]))]

const { data: scores, pending } = useGuruBadgeScores(symbolRef, fieldIds)

function numericValue(fieldId: string): number | null {
  const raw = scores.value?.[fieldId]?.value
  if (raw === null || raw === undefined) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

// null = insufficient real data to evaluate (e.g. Graham Number/NCAV without a stock price) —
// never coerced to 0, which would misrepresent "we don't know" as "this one failed."
function scoreFor(badge: GuruBadge): { numerator: number | null; denominator: number } {
  const value = numericValue(badge.fieldId)
  if (value === null) return { numerator: null, denominator: badge.threshold.denominator }
  const extra: Record<string, number | null> = {}
  for (const fieldId of badge.threshold.extraFieldIds ?? []) extra[fieldId] = numericValue(fieldId)
  return { numerator: badge.threshold.numerator(value, extra), denominator: badge.threshold.denominator }
}

function formatFraction(badge: GuruBadge): string {
  const score = scoreFor(badge)
  if (score.numerator === null) return '資料不足'
  return `${score.numerator}/${score.denominator}`
}

// Unit suffixes aren't available from GET /filters yet (every field's `unit` is currently null,
// see project_screener_backend_outage memory) — hardcoded here for the badges this card actually
// renders, same conservative "only the ones I've confirmed" approach StockHealthCheckCard.vue
// already uses for its own PERCENT_FIELDS set. Re-verified live via curl against
// POST /screener/values for 2330 before writing these.
const UNIT_BY_BADGE_ID: Record<string, string> = {
  'nissim-penman-rnoa': '%',
  'graham-number': '元',
  'sustainable-growth-rate': '%',
  'cash-conversion-cycle': '天'
}

function formatRawValue(badge: GuruBadge): string {
  const value = numericValue(badge.fieldId)
  if (value === null) return '尚無資料'
  return `${value}${UNIT_BY_BADGE_ID[badge.id] ?? ''}`
}

function asOfDate(badge: GuruBadge): string | null {
  return scores.value?.[badge.fieldId]?.asOfDate ?? null
}

const dialogBadge = ref<GuruBadge | null>(null)
</script>

<template>
  <div v-loading="pending" class="stock-guru-badge-card__grid">
    <button
      v-for="category in displayedCategories"
      :key="category"
      type="button"
      class="stock-guru-badge-card__tile"
      @click="dialogBadge = primaryByCategory[category]!"
    >
      <div class="stock-guru-badge-card__medal" :style="{ background: GURU_CATEGORY_COLOR[category] }">
        <el-icon><Trophy /></el-icon>
      </div>
      <p class="stock-guru-badge-card__category">{{ category }}</p>
      <p class="stock-guru-badge-card__fraction">{{ formatFraction(primaryByCategory[category]!) }}</p>
    </button>
  </div>

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
      <p class="stock-guru-badge-card__dialog-threshold">比較標準：{{ dialogBadge.threshold.description }}</p>
      <p class="stock-guru-badge-card__dialog-value">
        符合 {{ formatFraction(dialogBadge) }} 項｜{{ symbol }} 目前數值：{{ formatRawValue(dialogBadge) }}
        <span v-if="asOfDate(dialogBadge)" class="stock-guru-badge-card__dialog-date">（{{ asOfDate(dialogBadge) }}）</span>
      </p>
      <p class="stock-guru-badge-card__dialog-detail">{{ dialogBadge.detail }}</p>
      <p class="stock-guru-badge-card__dialog-disclaimer">{{ GURU_BADGE_DISCLAIMER }}</p>
    </template>
  </el-dialog>
</template>

<style scoped>
/* Big tiles filling the row evenly (auto-fit, not a fixed column count) — however many tiles
   displayedCategories renders still stretch to fill the width instead of leaving empty column
   tracks or needing a hardcoded count kept in sync with the data. */
.stock-guru-badge-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  grid-column: 1 / -1;
}

.stock-guru-badge-card__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 12px;
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

.stock-guru-badge-card__medal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: #fff;
  font-size: 22px;
  margin-bottom: 4px;
}

.stock-guru-badge-card__category {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-card__fraction {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.stock-guru-badge-card__dialog-author {
  margin: 0 0 4px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-card__dialog-threshold {
  margin: 0 0 12px;
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
