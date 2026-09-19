<script setup lang="ts">
import { Trophy, TrophyBase } from '@element-plus/icons-vue'
import { buildGuruBadges, guruBadgeMetricCode, GURU_BADGE_DISCLAIMER } from '~/utils/guru-badges'
import type { GuruBadge } from '~/utils/guru-badges'
import type { StockBadgeEntry } from '~/composables/stock/useStockBadges'

// 財報亮點／財報風險 — added 2026-09-19 per direct request ("我決定個股瀏覽 stock/2330 放財報亮點
// 跟 財報風險"). 個股瀏覽 (stock/[code]/index.vue) has been just the shared header + sidebar since
// 2026-09-18's 卡片/表格/會計 split moved everything else out to its own route — this is its first
// piece of real content since.
//
// Reuses the existing guru-badge pass/fail system wholesale instead of inventing a second
// judgment layer: 財報亮點 = every badge this company's own GET /stocks/:symbol/badges response
// marks `passed: true`, flattened across all 8 categories (StockGuruBadgeCategoryCard.vue keeps
// them grouped per-category for the full company-health page; this summary card intentionally
// doesn't repeat that grouping — the point here is "what stands out", not "here's every
// category's own scorecard"). Badges with insufficient data (`passed: null`) appear in NONE of
// the 3 lists below — "we don't know" is neither a highlight nor a risk, same null-handling
// discipline as every isMet() call site in this app.
//
// Unmet badges split into 2, not 1 — 2026-09-19 direct correction ("徽章確實是亮點 但是 沒達成的
// 就說是風險也太粗暴了，至少要分三塊"): lumping every unmet badge under "風險" mislabels a LOT of
// what's really there — Graham Number/本益成長比/NCAV/Fisher超級股票/托賓Q值 not being met just
// means this stock isn't a statistical bargain by that value-investor's own criterion, not that
// it's financially risky. Split by CATEGORY instead of inventing a per-badge risk taxonomy: only
// 財務韌性 (financial-resilience) badges — Altman Z-Score/Ohlson O-Score/Zmijewski Score/Beneish
// M-Score/debt-safety-margin/the leverageLiquidity Piotroski sub-badge, all of which are
// literally distress/solvency models by design — earn the 財報風險 label when unmet. Every other
// unmet badge (estimation valuation, shareholder-return, growth, quality, etc.) goes in a third,
// deliberately neutral bucket (未達成指標, matching this app's own established "已達成/未達成"
// wording elsewhere, see StockGuruBadgeCategoryCard.vue's own git history) — not evaluated as
// good or bad, just "didn't clear this particular published threshold."
//
// Same real-per-company filter as StockGuruBadgeCategoryCard.vue's own `badges` computed (see
// that file's own 2026-09-15 comment on the Basel III ghost-chip bug) — buildGuruBadges() returns
// the GLOBAL badge catalog, independent of whether this company actually has an evaluated entry
// for it; only badges with a real entryFor() result (or a real Piotroski group score) render here.
//
// No per-badge dialog on this page (unlike StockGuruBadgeCategoryCard.vue's own click-to-expand
// detail) — this is a summary card, not the full breakdown; each half links out to 公司健檢
// instead, where every badge's own formula/threshold/provenance already lives.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)

const { data: filterSchema } = await useFilterSchema()
const { data: piotroskiBreakdown } = usePiotroskiBreakdown(symbolRef)
const { data: stockBadges, pending } = useStockBadges(symbolRef)

const allBadges = computed<GuruBadge[]>(() => buildGuruBadges(filterSchema.value?.categories ?? [], piotroskiBreakdown.value?.groupMetadata))

function entryFor(badge: GuruBadge): StockBadgeEntry | null {
  if (badge.piotroskiGroup) return null
  return findStockBadgeEntry(stockBadges.value, guruBadgeMetricCode(badge))
}

function piotroskiGroupScore(group: 'profitability' | 'leverageLiquidity' | 'operatingEfficiency'): { numerator: number | null; denominator: number } {
  const signals = piotroskiBreakdown.value?.groups?.[group]
  if (!signals) return { numerator: null, denominator: 0 }
  const entries = Object.values(signals)
  const denominator = entries.length
  if (entries.some(value => value === null)) return { numerator: null, denominator }
  return { numerator: entries.filter(value => value === true).length, denominator }
}

// null = insufficient data — never coerced to true/false, same discipline as
// StockGuruBadgeCategoryCard.vue's own identical isMet().
function isMet(badge: GuruBadge): boolean | null {
  if (badge.piotroskiGroup) {
    const score = piotroskiGroupScore(badge.piotroskiGroup)
    return score.numerator === null ? null : score.numerator === score.denominator
  }
  return entryFor(badge)?.passed ?? null
}

const realBadges = computed<GuruBadge[]>(() => {
  if (pending.value || !stockBadges.value) return []
  return allBadges.value.filter(badge => badge.piotroskiGroup || entryFor(badge) !== null)
})

// Financial-resilience category ONLY — see this file's own top comment for why unmet badges
// outside this category aren't labeled "風險".
const RISK_CATEGORY: GuruBadge['category'] = '財務韌性'

const highlights = computed(() => realBadges.value.filter(badge => isMet(badge) === true))
const risks = computed(() => realBadges.value.filter(badge => isMet(badge) === false && badge.category === RISK_CATEGORY))
const unmetOther = computed(() => realBadges.value.filter(badge => isMet(badge) === false && badge.category !== RISK_CATEGORY))

function chipScoreText(badge: GuruBadge): string {
  if (!badge.piotroskiGroup) return badge.threshold.description
  const score = piotroskiGroupScore(badge.piotroskiGroup)
  return score.numerator === null ? '資料不足' : `符合 ${score.numerator}/${score.denominator} 項標準`
}

// Real bug fixed while verifying this live: the 3 Piotroski F-Score sub-badges all share the
// exact same `name` ("Piotroski F-Score") by design — StockGuruBadgeCategoryCard.vue's own
// comment on this explains it's not ambiguous THERE because each sub-badge already sits inside
// its own category-labeled card. This card flattens every badge across all categories into one
// list with no such per-category grouping, so 3 identically-labeled "Piotroski F-Score" rows
// showed up back to back with no way to tell them apart. Appends the category (獲利能力/財務韌性/
// 營運周轉) only for these 3 — every other badge's name is already unique on its own.
function chipDisplayName(badge: GuruBadge): string {
  return badge.piotroskiGroup ? `${badge.name}（${badge.category}）` : badge.name
}

const hasAnyData = computed(() => !pending.value && (highlights.value.length > 0 || risks.value.length > 0 || unmetOther.value.length > 0))
</script>

<template>
  <el-card v-loading="pending" class="stock-highlights-risks-card" shadow="never">
    <template #header>
      <span class="stock-highlights-risks-card__title">財報亮點</span>
    </template>
    <el-empty v-if="!pending && highlights.length === 0" description="目前沒有已達成的徽章" :image-size="64" />
    <ul v-else class="stock-highlights-risks-card__list">
      <li v-for="badge in highlights" :key="badge.id" class="stock-highlights-risks-card__item">
        <span class="stock-highlights-risks-card__icon stock-highlights-risks-card__icon--met">
          <el-icon><Trophy /></el-icon>
        </span>
        <span class="stock-highlights-risks-card__item-body">
          <span class="stock-highlights-risks-card__item-name">{{ chipDisplayName(badge) }}</span>
          <span class="stock-highlights-risks-card__item-detail">{{ chipScoreText(badge) }}</span>
        </span>
      </li>
    </ul>
    <NuxtLink :to="`/stock/${symbol}/company-health`" class="stock-highlights-risks-card__link">查看完整財報健檢 →</NuxtLink>
  </el-card>

  <el-card v-loading="pending" class="stock-highlights-risks-card" shadow="never">
    <template #header>
      <span class="stock-highlights-risks-card__title">財報風險</span>
    </template>
    <el-empty v-if="!pending && risks.length === 0" description="目前沒有未達成的徽章" :image-size="64" />
    <ul v-else class="stock-highlights-risks-card__list">
      <li v-for="badge in risks" :key="badge.id" class="stock-highlights-risks-card__item">
        <span class="stock-highlights-risks-card__icon stock-highlights-risks-card__icon--unmet">
          <el-icon><TrophyBase /></el-icon>
        </span>
        <span class="stock-highlights-risks-card__item-body">
          <span class="stock-highlights-risks-card__item-name">{{ chipDisplayName(badge) }}</span>
          <span class="stock-highlights-risks-card__item-detail">{{ chipScoreText(badge) }}</span>
        </span>
      </li>
    </ul>
    <NuxtLink :to="`/stock/${symbol}/company-health`" class="stock-highlights-risks-card__link">查看完整財報健檢 →</NuxtLink>
  </el-card>

  <el-card v-loading="pending" class="stock-highlights-risks-card" shadow="never">
    <template #header>
      <span class="stock-highlights-risks-card__title">未達成指標</span>
    </template>
    <el-empty v-if="!pending && unmetOther.length === 0" description="目前沒有其他未達成的徽章" :image-size="64" />
    <ul v-else class="stock-highlights-risks-card__list">
      <li v-for="badge in unmetOther" :key="badge.id" class="stock-highlights-risks-card__item">
        <span class="stock-highlights-risks-card__icon stock-highlights-risks-card__icon--unmet">
          <el-icon><TrophyBase /></el-icon>
        </span>
        <span class="stock-highlights-risks-card__item-body">
          <span class="stock-highlights-risks-card__item-name">{{ chipDisplayName(badge) }}</span>
          <span class="stock-highlights-risks-card__item-detail">{{ chipScoreText(badge) }}</span>
        </span>
      </li>
    </ul>
    <NuxtLink :to="`/stock/${symbol}/company-health`" class="stock-highlights-risks-card__link">查看完整財報健檢 →</NuxtLink>
  </el-card>

  <p v-if="hasAnyData" class="stock-highlights-risks-card__disclaimer">{{ GURU_BADGE_DISCLAIMER }}</p>
</template>

<style scoped>
.stock-highlights-risks-card {
  border-radius: 12px;
}

.stock-highlights-risks-card__title {
  font-weight: 600;
}

.stock-highlights-risks-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stock-highlights-risks-card__item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.stock-highlights-risks-card__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  font-size: 0.875rem;
}

/* Shape/color language mirrors StockGuruBadgeCategoryCard.vue's own chip medals (filled vs
   hollow ring) — same met/unmet distinction, no success/danger color pair (safe-harbor wording
   concern, see that file's own comment). */
.stock-highlights-risks-card__icon--met {
  background: var(--el-color-primary);
  color: #fff;
}

.stock-highlights-risks-card__icon--unmet {
  background: transparent;
  border-color: var(--el-text-color-secondary);
  color: var(--el-text-color-secondary);
}

.stock-highlights-risks-card__item-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stock-highlights-risks-card__item-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-highlights-risks-card__item-detail {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.stock-highlights-risks-card__link {
  display: inline-block;
  margin-top: 12px;
  font-size: 1rem;
  color: var(--el-color-primary);
}

.stock-highlights-risks-card__disclaimer {
  margin: 0;
  font-size: 0.875rem;
  color: var(--el-text-color-placeholder);
}
</style>
