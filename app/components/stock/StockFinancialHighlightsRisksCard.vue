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
// REWRITTEN 2026-09-20 from 3 separate `<el-card>`s of `<ul><li><button>` rows into ONE
// `<table data-ssr-table>` with the same 3 groups as row-group sections — direct feedback that
// this component and the index page's own now-removed badge table showed the exact same data
// twice, plus a direct instruction that this app's own document-first standard (question → answer
// → one table, not card grids — [[document-first-not-cards]]) should have applied here from the
// start. The three-way grouping logic (highlights/risks/unmetOther) is UNCHANGED — the user's own
// call was "表格本身也是按照 財報亮點 財報風險 未達成指標 這樣區分", i.e. keep this app's own
// established taxonomy, just render it as one table instead of three cards. UI controls stay at
// "沿用看說明就好" (per direct answer) — no added sort/filter, just the existing link-vs-dialog
// entry-point pattern per row, now as a table cell instead of a list-item.
//
// Reuses the existing guru-badge pass/fail system wholesale instead of inventing a second
// judgment layer: 財報亮點 = every badge this company's own GET /stocks/:symbol/badges response
// marks `passed: true`, flattened across all 8 categories (the point here is "what stands out",
// not "here's every category's own scorecard"). Badges with insufficient data (`passed: null`)
// appear in NONE of the 3 groups below — "we don't know" is neither a highlight nor a risk, same
// null-handling discipline as every isMet() call site in this app.
//
// Unmet badges split into 2, not 1 — 2026-09-19 direct correction ("徽章確實是亮點 但是 沒達成的
// 就說是風險也太粗暴了，至少要分三塊"): lumping every unmet badge under "風險" mislabels a LOT of
// what's really there — Graham Number/本益成長比/NCAV/Fisher超級股票/托賓Q值 not being met just
// means this stock isn't a statistical bargain by that value-investor's own criterion, not that
// it's financially risky. Split by CATEGORY instead of inventing a per-badge risk taxonomy: only
// 財務韌性 (financial-resilience) badges — Altman Z-Score/Ohlson O-Score/Zmijewski Score/debt-
// safety-margin, literally distress/solvency models by design — earn the 財報風險 label when
// unmet. Every other unmet badge (estimation valuation, shareholder-return, growth, quality, etc.
// — piotroskiFScore included, its own category is 獲利品質) goes in a third, deliberately neutral
// group (未達成指標, matching this app's own established "已達成/未達成" wording elsewhere) — not
// evaluated as good or bad, just "didn't clear this particular published threshold."
//
// Real-per-company filter (the 2026-09-15 Basel III ghost-chip bug): buildGuruBadges() returns
// the GLOBAL badge catalog, independent of whether this company actually has an evaluated entry
// for it; only badges with a real entryFor() result render here.
//
// Each row's own entry point either navigates (a badge with its own /stock/:code/{slug} page —
// BADGE_PAGES, shared/utils/hub-slugs.ts) or opens the shared detail dialog
// (StockGuruBadgeDialog.vue — 比較標準／公式／出處／資料時間／計算依據, and Piotroski's 9-signal
// checklist), per direct decision 2026-09-19 ("chip 點開彈窗"). Mixing a real `<NuxtLink>` and a
// `<button>` in the same 詳情 column with IDENTICAL styling would leave a keyboard/screen-reader
// user unable to predict which rows navigate vs. which open a dialog — the "看說明 →" CTA text is
// what makes that distinction visible, not just the underlying tag.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)

const { data: filterSchema } = await useFilterSchema()
const { data: stockBadges, pending } = useStockBadges(symbolRef)

const allBadges = computed<GuruBadge[]>(() => buildGuruBadges(filterSchema.value?.categories ?? []))

function entryFor(badge: GuruBadge): StockBadgeEntry | null {
  return findStockBadgeEntry(stockBadges.value, guruBadgeMetricCode(badge))
}

// null = insufficient data — never coerced to true/false.
function isMet(badge: GuruBadge): boolean | null {
  return entryFor(badge)?.passed ?? null
}

const realBadges = computed<GuruBadge[]>(() => {
  if (pending.value || !stockBadges.value) return []
  return allBadges.value.filter(badge => entryFor(badge) !== null)
})

// Financial-resilience category ONLY — see this file's own top comment for why unmet badges
// outside this category aren't labeled "風險".
const RISK_CATEGORY: GuruBadge['category'] = '財務韌性'

const highlights = computed(() => realBadges.value.filter(badge => isMet(badge) === true))
const risks = computed(() => realBadges.value.filter(badge => isMet(badge) === false && badge.category === RISK_CATEGORY))
const unmetOther = computed(() => realBadges.value.filter(badge => isMet(badge) === false && badge.category !== RISK_CATEGORY))

// piotroskiFScore is the one badge with a genuine multi-point denominator (9, a real 0-9
// checklist total) — its own `value` from GET /stocks/:symbol/badges IS that real numerator
// since its 2026-09-19 remerge back into a single badge (see guru-badges.ts's own
// PIOTROSKI_FIELD_ID comment). Every other badge here has denominator 1, where the threshold's
// own description ("> 2.99" etc.) is more informative than a synthesized "0/1"/"1/1" fraction.
function chipScoreText(badge: GuruBadge): string {
  if (badge.threshold.denominator <= 1) return badge.threshold.description
  const value = entryFor(badge)?.value ?? null
  return value === null ? '資料不足' : `${Math.round(value)}/${badge.threshold.denominator}`
}

const hasAnyData = computed(() => !pending.value && (highlights.value.length > 0 || risks.value.length > 0 || unmetOther.value.length > 0))

// Entry-point links for the badge-page family (2026-09-20, "希望入口是好好被設計的而不是只是個
// 超連結") — see this file's own top comment.
function badgePageFor(badge: GuruBadge) {
  return findBadgePageByMetric(badge.id)
}

interface BadgeGroup {
  key: string
  title: string
  met: boolean
  emptyText: string
  badges: GuruBadge[]
}

// Empty-state wording per group preserved verbatim from the 3-card version — the 財報風險 one was
// tightened 2026-09-19 per analysis-ts's relayed user report: "目前沒有未達成的徽章" read as a
// double negative under a "風險" heading (未達成 points the wrong direction here — for THIS group
// specifically, not clearing the threshold is the risk SIGNAL, not the thing being negated).
// 財報亮點/未達成指標 keep 已達成/未達成 since those are genuinely positive-framed groups where
// that pairing already reads correctly.
const groups = computed<BadgeGroup[]>(() => [
  { key: 'highlights', title: '財報亮點', met: true, emptyText: '目前沒有已達成的徽章', badges: highlights.value },
  { key: 'risks', title: '財報風險', met: false, emptyText: '目前沒有滿足任何財報風險徽章', badges: risks.value },
  { key: 'unmet', title: '未達成指標', met: false, emptyText: '目前沒有其他未達成的徽章', badges: unmetOther.value }
])

// The badge whose detail dialog is open (StockGuruBadgeDialog's v-model); null = closed.
const selectedBadge = ref<GuruBadge | null>(null)
</script>

<template>
  <div v-loading="pending" class="stock-highlights-risks-table">
    <SharedEmptyState v-if="!pending && !hasAnyData" description="目前沒有可判定的財報徽章資料" />
    <table v-else class="seo-table" data-ssr-table>
      <caption class="visually-hidden">{{ symbol }} 的財報亮點、財報風險與未達成指標</caption>
      <thead>
        <tr>
          <th scope="col">徽章</th>
          <th scope="col">門檻／分數</th>
          <th scope="col">詳情</th>
        </tr>
      </thead>
      <tbody v-for="group in groups" :key="group.key">
        <tr class="stock-highlights-risks-table__group-row">
          <th scope="colgroup" colspan="3">{{ group.title }}（{{ group.badges.length }}）</th>
        </tr>
        <tr v-if="!group.badges.length">
          <td colspan="3" class="stock-highlights-risks-table__group-empty">{{ group.emptyText }}</td>
        </tr>
        <tr v-for="badge in group.badges" :key="badge.id">
          <th scope="row">
            <span class="stock-highlights-risks-table__icon" :class="group.met ? 'stock-highlights-risks-table__icon--met' : 'stock-highlights-risks-table__icon--unmet'" aria-hidden="true">
              <el-icon><Trophy v-if="group.met" /><TrophyBase v-else /></el-icon>
            </span>
            {{ badge.name }}
          </th>
          <td>{{ chipScoreText(badge) }}</td>
          <td>
            <NuxtLink v-if="badgePageFor(badge)" :to="badgePagePath(symbol, badgePageFor(badge)!.slug)" class="stock-highlights-risks-table__cta">看說明 →</NuxtLink>
            <button v-else type="button" class="stock-highlights-risks-table__cta stock-highlights-risks-table__cta--button" aria-haspopup="dialog" @click="selectedBadge = badge">看說明</button>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="hasAnyData" class="stock-highlights-risks-table__disclaimer">{{ GURU_BADGE_DISCLAIMER }}</p>

    <StockGuruBadgeDialog v-model:badge="selectedBadge" :symbol="symbol" />
  </div>
</template>

<style scoped>
.stock-highlights-risks-table {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-highlights-risks-table__group-row th {
  background: var(--el-fill-color-light);
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-highlights-risks-table__group-empty {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  white-space: normal;
}

.stock-highlights-risks-table__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-right: 8px;
  border-radius: 50%;
  border: 2px solid transparent;
  font-size: 0.75rem;
  vertical-align: middle;
}

/* Shape language: filled medal = met, hollow ring = unmet — no success/danger color pair
   (safe-harbor wording concern). */
.stock-highlights-risks-table__icon--met {
  background: var(--el-color-primary);
  color: #fff;
}

.stock-highlights-risks-table__icon--unmet {
  background: transparent;
  border-color: var(--el-text-color-secondary);
  color: var(--el-text-color-secondary);
}

/* Visible affordance that distinguishes a row that navigates (has its own /stock/:code page)
   from one that opens the shared dialog — see this file's own top comment. */
.stock-highlights-risks-table__cta {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  padding: 0 4px;
  font: inherit;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
  white-space: nowrap;
  text-decoration: none;
}

.stock-highlights-risks-table__cta--button {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.stock-highlights-risks-table__disclaimer {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}
</style>
