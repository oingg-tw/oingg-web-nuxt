<script setup lang="ts">
import { Trophy } from '@element-plus/icons-vue'
import { GURU_BADGE_CATEGORIES, GURU_BADGE_DISCLAIMER, GURU_CATEGORY_COLOR, guruBadgesByCategory } from '~/utils/guru-badges'
import type { GuruBadge } from '~/utils/guru-badges'

// Stock-detail page's own multi-dimension badge overview — per direct request ("個股瀏覽 要有一張
// 卡片，這張卡片有八個面向的徽章"). One tile per GURU_BADGE_CATEGORIES slot, combining EVERY real
// badge assigned to that category (see guru-badges.ts's own guruBadgesByCategory comment) —
// 獲利品質 alone currently has 4 (Piotroski/Beneish/DuPont/Sloan), all counted together.
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
//    會看到模型名稱與計分標準，甚至日期"): a badge's own internal scale sitting right next to
//    other badges' fractions read as "N out of TOTAL BADGES," not "N out of THIS ONE model's
//    own scale."
// 2. Collapsed into one combined headline across ALL 6 categories — rejected ("不是這樣。六個面
//    向的徽章要分開計分"): merging every category into a single number lost the per-dimension
//    information the card exists to show.
// 3. One badge picked as "primary" per category (a since-removed guru-badges.ts helper), tile
//    showing only that one badge's fraction — rejected ("斯隆應計項目比率 也算獲利品質的徽章。
//    所以用戶會看到 1/2。點進去以後才看到F-Score現在分數，以及 斯隆應計項目比率 實際分數"):
//    picking only one badge per category silently hid every other real badge assigned to it
//    (Sloan Accrual Ratio/Beneish M-Score/DuPont were never shown for 獲利品質 even though
//    they're real badges in that category).
// 4. Current: each tile combines every badge in its category into one fraction (how many of that
//    category's badges meet their own standard, out of how many were evaluable), and clicking
//    opens a dialog LISTING every one of that category's badges with its own name/fraction/raw
//    value/date — the fraction is the only thing visible at a glance, every badge's own detail
//    is one click away, scoped to just that category (not a cross-category shared list).
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)

const badgesByCategory = guruBadgesByCategory()
const displayedCategories = GURU_BADGE_CATEGORIES.filter(category => badgesByCategory[category]?.length)
const allBadges = displayedCategories.flatMap(category => badgesByCategory[category]!)
// Every field a threshold might need across every displayed badge: each badge's own fieldId plus
// any extraFieldIds (e.g. Graham Number/NCAV need the stock's own price to compare against) —
// deduped since 'stockPrice.Q' would otherwise be requested twice.
const fieldIds = [...new Set(allBadges.flatMap(badge => [badge.fieldId, ...(badge.threshold.extraFieldIds ?? [])]))]

const { data: scores, units, pending } = useGuruBadgeScores(symbolRef, fieldIds)

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

function isMet(badge: GuruBadge): boolean | null {
  const score = scoreFor(badge)
  if (score.numerator === null) return null
  const check = badge.threshold.isMet ?? ((numerator, denominator) => numerator === denominator)
  return check(score.numerator, score.denominator)
}

function formatFraction(badge: GuruBadge): string {
  const score = scoreFor(badge)
  if (score.numerator === null) return '資料不足'
  return `${score.numerator}/${score.denominator}`
}

// Tile-level fraction: how many of this category's badges meet their own standard, out of how
// many were evaluable — badges with insufficient data are excluded from the denominator too,
// same "never count a missing number as a failure" reasoning as scoreFor()'s own null handling.
function categoryFraction(category: (typeof displayedCategories)[number]): string {
  const badges = badgesByCategory[category] ?? []
  let met = 0
  let evaluated = 0
  for (const badge of badges) {
    const result = isMet(badge)
    if (result === null) continue
    evaluated += 1
    if (result) met += 1
  }
  return evaluated === 0 ? '資料不足' : `${met}/${evaluated}`
}

// Unit now comes straight from POST /screener/values' own response (bff-ts shipped real units
// live 2026-09-09 — every field returns "%"/"元"/"分"/etc instead of null) via useGuruBadgeScores'
// own `units` map — replaces a hardcoded UNIT_BY_BADGE_ID dictionary this card used to maintain
// itself back when every field's unit came back null (see project_screener_backend_outage
// memory), which also means score-style badges (Piotroski/Altman/Beneish/Ohlson/Zmijewski, all
// "分") now get a real unit suffix they never had before.
function formatRawValue(badge: GuruBadge): string {
  const value = numericValue(badge.fieldId)
  if (value === null) return '尚無資料'
  return `${value}${units.value[badge.fieldId] ?? ''}`
}

function asOfDate(badge: GuruBadge): string | null {
  return scores.value?.[badge.fieldId]?.asOfDate ?? null
}

const dialogCategory = ref<(typeof displayedCategories)[number] | null>(null)
</script>

<template>
  <div v-loading="pending" class="stock-guru-badge-card__grid">
    <button
      v-for="category in displayedCategories"
      :key="category"
      type="button"
      class="stock-guru-badge-card__tile"
      @click="dialogCategory = category"
    >
      <div class="stock-guru-badge-card__medal" :style="{ background: GURU_CATEGORY_COLOR[category] }">
        <el-icon><Trophy /></el-icon>
      </div>
      <p class="stock-guru-badge-card__category">{{ category }}</p>
      <p class="stock-guru-badge-card__fraction">{{ categoryFraction(category) }}</p>
    </button>
  </div>

  <el-dialog
    :model-value="dialogCategory !== null"
    :title="dialogCategory ?? ''"
    width="min(560px, 92vw)"
    align-center
    append-to-body
    @update:model-value="dialogCategory = null"
  >
    <template v-if="dialogCategory">
      <div class="stock-guru-badge-card__list">
        <div v-for="badge in badgesByCategory[dialogCategory]" :key="badge.id" class="stock-guru-badge-card__list-row">
          <p class="stock-guru-badge-card__list-name">
            {{ badge.name }}
            <span class="stock-guru-badge-card__list-author">｜{{ badge.author }}</span>
          </p>
          <p class="stock-guru-badge-card__list-threshold">比較標準：{{ badge.threshold.description }}</p>
          <p class="stock-guru-badge-card__list-value">
            符合 {{ formatFraction(badge) }} 項｜{{ symbol }} 目前數值：{{ formatRawValue(badge) }}
            <span v-if="asOfDate(badge)" class="stock-guru-badge-card__list-date">（{{ asOfDate(badge) }}）</span>
          </p>
        </div>
      </div>
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

.stock-guru-badge-card__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-guru-badge-card__list-row + .stock-guru-badge-card__list-row {
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.stock-guru-badge-card__list-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.stock-guru-badge-card__list-author {
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-card__list-threshold {
  margin: 4px 0 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.stock-guru-badge-card__list-value {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 600;
}

.stock-guru-badge-card__list-date {
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.stock-guru-badge-card__dialog-disclaimer {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
