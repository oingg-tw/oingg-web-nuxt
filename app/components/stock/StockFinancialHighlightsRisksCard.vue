<script setup lang="ts">
import { Trophy, TrophyBase, WarnTriangleFilled } from '@element-plus/icons-vue'
import { buildGuruBadges, guruBadgeMetricCode, GURU_BADGE_CATEGORIES, GURU_BADGE_DISCLAIMER } from '~/utils/guru-badges'
import type { GuruBadge } from '~/utils/guru-badges'
import type { StockBadgeEntry } from '~/composables/stock/useStockBadges'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'
import { formatSignificantDigits } from '~/utils/format-significant-digits'

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
// group — not evaluated as good or bad, just "didn't clear this particular published threshold."
// That bucket was called 未達成指標 until 2026-09-20, when it was renamed 中性 (see the `groups`
// computed below); the bucketing rule itself is unchanged.
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

// 目前數值 and 門檻 are two SEPARATE columns (2026-09-20, per direct request to show the company's
// own number next to the threshold). Deliberately NOT concatenated into one cell the way the
// request sketched it（「Altman Z-Score 15.5 > 2.99」）: for an UNMET badge that reads as a plain
// false statement —「265.7 < 22.5」for 2330's own Graham Number — asserting a comparison that
// isn't true. One attribute per column keeps every cell true on its own, and is what makes this
// a real data table rather than a sentence chopped into columns.
//
// piotroskiFScore is the one badge with a genuine multi-point denominator (9, a real 0-9
// checklist total) — its own `value` from GET /stocks/:symbol/badges IS that real numerator
// since its 2026-09-19 remerge back into a single badge (see guru-badges.ts's own
// PIOTROSKI_FIELD_ID comment), so it shows as「7／9」against a「≥ 8」threshold. Every other badge
// has denominator 1 and shows its plain value with the catalog's own unit.
function currentValueText(badge: GuruBadge): string {
  const entry = entryFor(badge)
  const value = entry?.value ?? null
  // Same 不適用（industry exclusion）vs 尚無資料 split StockGuruBadgeDialog.vue makes, off the same
  // `nullReason` field. Only reachable defensively here — the three groups are built from
  // passed === true/false, and a null value with a non-null `passed` shouldn't occur.
  if (value === null) return entry?.nullReason === 'not_applicable_industry' ? '不適用' : '尚無資料'
  if (badge.threshold.denominator > 1) return `${Math.round(value)}／${badge.threshold.denominator}`
  const unit = locateFieldInSchema(filterSchema.value?.categories ?? [], badge.fieldId)?.metric.unit
  return unit && unit !== '無單位' ? `${formatSignificantDigits(value, 3)}${unit}` : formatSignificantDigits(value, 3)
}

const hasAnyData = computed(() => !pending.value && (highlights.value.length > 0 || risks.value.length > 0 || unmetOther.value.length > 0))

// Entry-point links for the badge-page family (2026-09-20, "希望入口是好好被設計的而不是只是個
// 超連結") — see this file's own top comment.
function badgePageFor(badge: GuruBadge) {
  return findBadgePageByMetric(badge.id)
}

// One of the three icon shapes, per BADGE (filled medal / hollow ring / filled triangle). Shape,
// not colour, is what distinguishes them — a colour-only split fails for colour-blind readers.
//
// This moved from group level to ROW level on 2026-09-20 when the table's grouping axis became
// category: a category group mixes met and unmet badges, so a single shape per group would have
// been wrong for most rows. The rule itself is unchanged — it's the same three-way split the
// `highlights` / `unmetOther` / `risks` computeds above make, just evaluated one badge at a time.
function markFor(badge: GuruBadge): 'met' | 'neutral' | 'risk' {
  if (isMet(badge) === true) return 'met'
  return badge.category === RISK_CATEGORY ? 'risk' : 'neutral'
}

interface BadgeGroup {
  key: string
  title: string
  badges: GuruBadge[]
  // 亮點／中性／風險 counts WITHIN this category, shown in the group header as「（1/3/0）」
  // (2026-09-20, direct request「要用分數…才知道亮點中性風險的分布」). Always three numbers in
  // that fixed order, zeros included — a bare「1/3」that silently dropped an empty bucket would
  // change what the reader has to infer from position. The order is the same one the summary
  // cards use directly above, which is what makes the bare digits legible: those cards are the
  // legend. Screen readers get the spelled-out version instead, see the template.
  met: number
  neutral: number
  risk: number
}

// The summary cards' own list — the STATUS axis (亮點／中性／風險 counts), kept separate from the
// table's `groups` since 2026-09-20, when the table's axis became category. Before that both read
// one list; if the cards had been left pointing at `groups` they'd silently have turned into
// per-category counts, losing the "多少有達成多少沒達成" answer they exist to give.
const statusSummary = computed<{ key: string; title: string; mark: 'met' | 'neutral' | 'risk'; count: number }[]>(() => [
  { key: 'highlights', title: '亮點', mark: 'met', count: highlights.value.length },
  { key: 'neutral', title: '中性', mark: 'neutral', count: unmetOther.value.length },
  { key: 'risks', title: '風險', mark: 'risk', count: risks.value.length }
])

// Grouped by CATEGORY (2026-09-20, direct request「不再單純區分 亮點 中性 風險，而是各自的類別」).
//
// The request was for one table PER category; that was measured first, on the user's own
// instruction to evaluate SEO before implementing, and rejected on the numbers. Across a 20-stock
// sample the per-category tables would average 2.2 rows, with 38% of them holding exactly ONE row
// and 54% holding two or fewer — and the table count per stock would vary (6 for 2330, 5 for 1101,
// 4 for 2891), so the page's shape wouldn't even be consistent across the set. A one-row table
// isn't tabular data; it's this repo's own f-score anti-pattern ("forcing a <table> onto
// list-shaped content is marking it up as something it isn't") applied 7 times per page. Compare
// /metrics, the repo's real multi-table precedent: 13–30 rows per table, each its own document
// section with its own h2, on a page whose entire job is the by-category catalog.
//
// Row-groups give the category organisation with none of that: still ONE genuine ~18-row table,
// no new headings (so no collision with the category h3s the 資料摘要與來源 digest already
// renders, and no dilution of the page's 3 question-form h2s), and no empty or near-empty tables
// on sparse symbols.
//
// The 亮點／中性／風險 axis is NOT abandoned — it moved to the summary cards above, which read the
// same three computeds. Two complementary axes now: cards = status, table = category.
//
// Ordered by GURU_BADGE_CATEGORIES, the taxonomy's own fixed display order. Categories with no
// evaluated badge for this company are dropped entirely, which is why there's no per-group empty
// state any more.
//
// NOT built with guruBadgesByCategory() (guru-badges.ts): that groups the FULL catalog, not this
// company's `realBadges`, so using it would reintroduce the 2026-09-15 Basel III ghost-badge bug.
// Source is `isMet(badge) !== null`, NOT `realBadges` — `realBadges` only means "this company has
// an entry for this badge", and an entry can still carry `passed: null` when the data is
// insufficient. The old grouping iterated the three status computeds, which already excluded
// those, so switching the axis to category silently pulled them into the table for the first
// time: 1101 rendered 18 rows against a 13-badge summary. Same null discipline as everywhere
// else here — "we don't know" is neither a highlight, a neutral nor a risk, so it isn't a row.
const groups = computed<BadgeGroup[]>(() => {
  const byCategory = new Map<GuruBadge['category'], GuruBadge[]>()
  for (const badge of realBadges.value.filter(badge => isMet(badge) !== null)) {
    const list = byCategory.get(badge.category)
    if (list) list.push(badge)
    else byCategory.set(badge.category, [badge])
  }
  return GURU_BADGE_CATEGORIES.flatMap(category => {
    const badges = byCategory.get(category)
    if (!badges?.length) return []
    // Counted through markFor() rather than re-deriving the rule, so the header's numbers can
    // never disagree with the icon shapes on the rows underneath them.
    const marks = badges.map(markFor)
    return [{
      key: category,
      title: category,
      badges,
      met: marks.filter(mark => mark === 'met').length,
      neutral: marks.filter(mark => mark === 'neutral').length,
      risk: marks.filter(mark => mark === 'risk').length
    }]
  })
})

// The badge whose detail dialog is open (StockGuruBadgeDialog's v-model); null = closed.
const selectedBadge = ref<GuruBadge | null>(null)
</script>

<template>
  <div v-loading="pending" class="stock-highlights-risks-table">
    <SharedEmptyState v-if="!pending && !hasAnyData" description="目前沒有可判定的財報徽章資料" />

    <!-- 摘要卡 (2026-09-20, direct request：「卡片摘要在上面，跟試作版相同，一眼就要看出多少有
         達成多少沒達成」). Summary → detail, not the same data twice: these carry ONLY the three
         counts, the table below carries which badges and their numbers. That distinction is what
         separates this from the duplicate badge table that was added and removed earlier the same
         day — a count you can read at a glance is the one thing the table genuinely can't give,
         since reading it means counting rows yourself.
         Static on purpose: no links or buttons, so there are no new hitboxes to space out and
         nothing here can be mistaken for a control. The detail is immediately below. -->
    <!-- One v-else branch wrapping BOTH the summary and the table: they share the single
         "we have data" condition. Written as a <template v-else> rather than a second
         `v-if="hasAnyData"` because a sibling carrying its own v-if between a v-if and a v-else
         steals the v-else — which silently inverted the table's condition when this was first
         added (it rendered only when there was NO data). -->
    <template v-else>
      <ul class="stock-highlights-risks-table__summary">
        <li v-for="status in statusSummary" :key="status.key" :class="`stock-highlights-risks-table__summary-card--${status.mark}`" class="stock-highlights-risks-table__summary-card">
          <span class="stock-highlights-risks-table__icon" :class="`stock-highlights-risks-table__icon--${status.mark}`" aria-hidden="true">
            <el-icon>
              <Trophy v-if="status.mark === 'met'" />
              <TrophyBase v-else-if="status.mark === 'neutral'" />
              <WarnTriangleFilled v-else />
            </el-icon>
          </span>
          <span class="stock-highlights-risks-table__summary-body">
            <span class="stock-highlights-risks-table__summary-title">{{ status.title }}</span>
            <span class="stock-highlights-risks-table__summary-count">{{ status.count }}<span class="stock-highlights-risks-table__summary-unit"> 項</span></span>
          </span>
        </li>
      </ul>

      <!-- SharedTableScroll, same as every other data-ssr-table in this app (2026-09-20 — it was
           missing when this table was first written, and the page itself scrolled sideways at
           375px: scrollWidth 565 against a 375 viewport, measured). The wrapper keeps the overflow
           inside the table's own focusable, arrow-key-scrollable region instead. -->
      <SharedTableScroll :label="`${symbol} 的財報徽章一覽`">
      <table class="seo-table" data-ssr-table>
        <caption class="visually-hidden">{{ symbol }} 的財報徽章，依市場評價、股東回饋、獲利品質等類別分組；每個類別標題後的三個數字依序是亮點、中性、風險的項數，每列標示該徽章的目前數值與門檻</caption>
        <thead>
          <tr>
            <th scope="col">徽章</th>
            <th scope="col">目前數值</th>
            <th scope="col">門檻</th>
            <th scope="col">詳情</th>
          </tr>
        </thead>
        <tbody v-for="group in groups" :key="group.key">
          <tr class="stock-highlights-risks-table__group-row">
            <!-- Digits are aria-hidden and the spelled-out form is visually hidden: a screen
                 reader announcing「獲利能力（1/3/0）」gives a listener three numbers with no way
                 to know which bucket each belongs to, since the summary cards that act as the
                 visual legend aren't adjacent in the reading order. Sighted and non-sighted
                 readers get the same facts, in the form each can actually use. -->
            <th scope="colgroup" colspan="4">
              {{ group.title }}<span aria-hidden="true">（{{ group.met }}/{{ group.neutral }}/{{ group.risk }}）</span>
              <span class="visually-hidden">：亮點 {{ group.met }} 項、中性 {{ group.neutral }} 項、風險 {{ group.risk }} 項</span>
            </th>
          </tr>
          <tr v-for="badge in group.badges" :key="badge.id">
            <th scope="row">
              <span class="stock-highlights-risks-table__icon" :class="`stock-highlights-risks-table__icon--${markFor(badge)}`" aria-hidden="true">
                <el-icon>
                  <Trophy v-if="markFor(badge) === 'met'" />
                  <TrophyBase v-else-if="markFor(badge) === 'neutral'" />
                  <WarnTriangleFilled v-else />
                </el-icon>
              </span>
              {{ badge.name }}
            </th>
            <td>{{ currentValueText(badge) }}</td>
            <td>{{ badge.threshold.description }}</td>
            <td>
              <NuxtLink v-if="badgePageFor(badge)" :to="badgePagePath(symbol, badgePageFor(badge)!.slug)" class="stock-highlights-risks-table__cta">看說明 →</NuxtLink>
              <button v-else type="button" class="stock-highlights-risks-table__cta stock-highlights-risks-table__cta--button" aria-haspopup="dialog" @click="selectedBadge = badge">看說明</button>
            </td>
          </tr>
        </tbody>
        </table>
      </SharedTableScroll>
    </template>

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

/* 摘要卡。視覺規格對齊 /highlights-lab 的試作卡：2px 實心外框、16px 圓角、擴散微陰影、左側
   色軌——破格文件對高齡介面的硬性要求（無框平鋪會讓卡片融進背景）。手機單欄堆疊，桌機三欄。 */
.stock-highlights-risks-table__summary {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 720px) {
  .stock-highlights-risks-table__summary {
    grid-template-columns: repeat(3, 1fr);
  }
}

.stock-highlights-risks-table__summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--el-bg-color);
  border: 2px solid var(--el-border-color);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 8%);
}

/* 左側色軌是第三層冗餘（位置＋圖示形狀＋文字標題已經足夠），不是唯一線索。 */
.stock-highlights-risks-table__summary-card--met {
  border-inline-start: 6px solid var(--el-color-primary);
}

.stock-highlights-risks-table__summary-card--neutral {
  border-inline-start: 6px solid var(--el-text-color-secondary);
}

.stock-highlights-risks-table__summary-card--risk {
  border-inline-start: 6px solid var(--el-text-color-primary);
}

/* The shared icon is sized for inline use in a table cell (22px + a right margin). In a summary
   card it sits next to a 2rem number, so it scales up and drops the margin — the card's own
   flex `gap` handles the spacing. */
/* Sets only the two size VARIABLES, never font-size directly. This selector is two classes and
   the --risk rule below is one, so a font-size declared here would outrank --risk's and silently
   undo its glyph scaling in this context — which is exactly what happened on the first attempt
   (the summary triangle stayed at 18px while the table one scaled correctly). */
.stock-highlights-risks-table__summary-card .stock-highlights-risks-table__icon {
  --mark-box: 40px;
  --mark-glyph: 1.125rem;
  margin-right: 0;
  flex-shrink: 0;
}

.stock-highlights-risks-table__summary-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stock-highlights-risks-table__summary-title {
  font-size: 1rem;
  color: var(--el-text-color-regular);
}

/* 「一眼看出」靠的就是這個字級落差：數字 2rem，標題 1rem。 */
.stock-highlights-risks-table__summary-count {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.stock-highlights-risks-table__summary-unit {
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.stock-highlights-risks-table__group-row th {
  background: var(--el-fill-color-light);
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-highlights-risks-table__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Box size as a variable: --risk below sizes its glyph off the BOX, not off the other two
     glyphs, because that's what it has to visually match (see that rule). One variable keeps
     the two contexts — this 22px inline box and the 40px summary-card one — in step. */
  --mark-box: 22px;
  --mark-glyph: 0.75rem;
  width: var(--mark-box);
  height: var(--mark-box);
  margin-right: 8px;
  border-radius: 50%;
  border: 2px solid transparent;
  font-size: var(--mark-glyph);
  vertical-align: middle;
}

/* Shape language, three ways (2026-09-20): filled medal = 亮點, hollow ring = 中性, filled
   triangle = 風險. The triangle is what keeps 中性 and 風險 apart WITHOUT a colour pair — both
   are unmet badges, so the old two-shape scheme would have rendered them identically once the
   third bucket got its own name. Still no success/danger colour pair (safe-harbor wording). */
.stock-highlights-risks-table__icon--met {
  background: var(--el-color-primary);
  color: #fff;
}

.stock-highlights-risks-table__icon--neutral {
  background: transparent;
  border-color: var(--el-text-color-secondary);
  color: var(--el-text-color-secondary);
}

/* 風險 is the one mark with neither a filled disc nor a ring, so the box around it contributes no
   visual mass and the bare glyph read far smaller than its two siblings (direct report 2026-09-20:
   「警示三角形的icon數量太小了」). It gets that mass back from the glyph instead of from a
   container — a container would be a third circle, which is what the shape language is trying to
   avoid. Sized off --mark-box (not off the other glyphs): what it has to match is the DISC's
   diameter, and the two contexts have different box-to-glyph ratios (22/12 vs 40/18), so a single
   multiplier of the glyph size would only ever be right in one of them. */
.stock-highlights-risks-table__icon--risk {
  background: transparent;
  border-color: transparent;
  color: var(--el-text-color-primary);
  font-size: calc(var(--mark-box) * 0.92);
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
