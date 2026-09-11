<script setup lang="ts">
import { Reading } from '@element-plus/icons-vue'
import { bySort, formatPeriodLabel, metricDisplayName } from '~/composables/screener/useFilterSchema'
import type { FilterMetric } from '~/composables/screener/useFilterSchema'

// One <tr> in guru-indicators.vue's "其他指標" table — the ~72 GET /metrics entries that have
// no curated GuruBadge (no literature-sourced pass/fail threshold), only a name/unit/period list
// and, for most of them now, a real formula. Deliberately NOT a big card like GuruBadgeCard.vue:
// with this many entries and (for now) no description/source text backfilled yet (confirmed
// live — every metric's own `description`/`source` field is still null), a full card per metric
// would mostly be empty visual weight.
//
// REBUILT 2026-09-10 from a flex row into a real <table> row per direct request ("其他指標請用
// 表格呈現。公式的icon放在第二格。") — column order confirmed via AskUserQuestion:
// 名稱/公式/可用期間/單位. A plain semantic <table> (not el-table, which renders a div-based
// virtualized grid meant for large sortable business data, not a flowing reference list) so
// screen readers get real <th>/<td> row-and-column semantics for free on desktop.
//
// Responsive behavior also confirmed via AskUserQuestion: below 600px (same breakpoint
// stock/[code].vue's own mobile tab-scroll fix already uses, kept consistent app-wide) each
// row collapses into a stacked card instead of a horizontally-scrolling table — thead hides,
// each <td> becomes its own labeled line via `data-label` + `::before` (no duplicated text in
// the DOM). Known tradeoff: collapsing to `display: block` loses the native table's row/column
// ARIA association on mobile — an accepted, industry-standard CSS-only-responsive-table
// tradeoff, not an oversight — but every cell's meaning is still conveyed as real visible text
// via its own label, so no information is lost, which is what actually matters at the WCAG AA
// (not AAA) bar this page targets.
const props = defineProps<{
  metric: FilterMetric
}>()

const periods = computed(() => bySort(props.metric.fields).map(field => formatPeriodLabel(field.period) ?? field.period))

// Formula icon is a real <button> (not a bare <el-icon>) so it's keyboard-focusable and gets a
// visible focus ring from the app's global :focus-visible rule (main.css) — a real AA gap fixed
// here per direct request this page reach WCAG AA; MoleculeIndicatorPickerBody.vue's own
// formula/info icons predate that ask and aren't touched by this change. The tooltip itself
// also needs `trigger: ['hover', 'focus']` (el-tooltip defaults to hover-only) — confirmed live
// that a focusable-but-hover-only trigger left keyboard users able to TAB to the button but
// never actually see its content, which would have made the button focusable in name only.
const formulaHtml = computed(() => renderFormulaHtml(props.metric.formulaLatex, true))

// Real bug fixed live 2026-09-10 ("有些tooltip要顯示太多內容跑版了") — a handful of the longer
// multi-term formulas (Ohlson O-Score/Zmijewski Score/Beneish M-Score/Nissim-Penman RNOA/ROCE
// all clear 150+ LaTeX characters) rendered wider than the popper's own maxWidth and spilled
// past the viewport edge instead of wrapping or clipping — KaTeX doesn't line-wrap a formula on
// its own, and `maxWidth` alone on the popper only caps the BOX, not the content painted inside
// it. `overflowX: 'auto'` is the safety net for the rare genuinely-extreme case, not the primary
// fix — per direct follow-up ("tooltip可以不限制寬度嗎? 至少電腦版的時候讓他不要有scroll 跑出
// 來"), maxWidth was widened from 400px to 900px and capped at `90vw` so it still can't force
// the page itself to overflow on a narrower window.
//
// Real follow-up bug fixed 2026-09-10 ("徽章與指標 tooltip 高度不足，還是會看到scroll") — setting
// `overflowX: 'auto'` (even after also trying explicit `overflow: 'auto'` on both axes, and
// extra padding) kept showing an unwanted vertical scrollbar a few px short of the content's own
// height. Root cause, confirmed live: `overflow-x: auto` reserves scrollbar space the moment the
// browser's own sub-pixel content measurement rounds even fractionally over the box's width —
// scrollWidth/clientWidth can read back EQUAL (no visible horizontal overflow) while a thin
// scrollbar is still reserved along the bottom edge, eating into the box's own available vertical
// space and forcing a needless vertical scrollbar too. Since the real measured max formula width
// in this section (Nissim-Penman RNOA, confirmed live at 875px against this app's 16px tooltip
// floor — see fontSize below) is already comfortably under the 900px cap, no formula here
// actually NEEDS horizontal scrolling in practice — dropping `overflow` entirely (keeping only
// `maxWidth`) removes the scrollbar-reservation side effect for the normal case; the rare
// hypothetical formula that someday exceeds 900px would clip at the edge instead of scrolling,
// an acceptable, far rarer trade-off against a scrollbar appearing on every formula.
//
// fontSize explicitly 16px, matching this app's own tooltip-text floor (main.css's global
// `.el-popper` rule already forces this — confirmed live the two agree, this isn't overriding
// that rule to something smaller) — an earlier version of this style object left it at 14px
// (stale from before that floor existed), which happened to render correctly anyway only because
// the global !important rule silently won the tie; spelled out here now so this object doesn't
// read as contradicting the app-wide policy on its own.
const FORMULA_TOOLTIP_STYLE = { maxWidth: 'min(900px, 90vw)', fontSize: '16px' } as const
</script>

<template>
  <tr class="guru-indicator-row">
    <td class="guru-indicator-row__name" data-label="名稱">{{ metricDisplayName(metric) }}</td>
    <td class="guru-indicator-row__formula-cell" data-label="公式">
      <el-tooltip
        v-if="formulaHtml"
        raw-content
        :content="formulaHtml"
        placement="top"
        :popper-style="FORMULA_TOOLTIP_STYLE"
        :trigger="['hover', 'focus']"
      >
        <button type="button" class="guru-indicator-row__formula" aria-label="顯示計算公式">
          <el-icon><Reading /></el-icon>
        </button>
      </el-tooltip>
      <span v-else class="guru-indicator-row__no-formula">尚未提供</span>
    </td>
    <td class="guru-indicator-row__periods" data-label="可用期間">
      <el-tag v-for="period in periods" :key="period" size="small" effect="plain" class="guru-indicator-row__period">
        {{ period }}
      </el-tag>
    </td>
    <!-- Added 2026-09-10 per direct request — same tag-list treatment as 可用期間 just above
         (already established in this row, already flex-wraps for multiple short labels), since
         a metric can list more than one source (e.g. 本益比 combines 損益表/股本變動申報/證交所
         每日收盤價). The <td> itself always renders (a v-if here would drop the whole cell and
         misalign every column against the header/sibling rows the moment even one metric lacks
         the field — which, as of this date, is all 85 of them, since bff-ts hasn't wired
         `sources` through GET /metrics yet, see useFilterSchema.ts's own comment); only the tag
         list inside is conditional, so the cell renders blank rather than a "尚未提供"
         placeholder like the formula column uses — analysis-ts's own guarantee is that this
         field is required and never empty once it does arrive, so there's no steady-state "not
         documented yet" case worth a placeholder for, only a transitional one. -->
    <td class="guru-indicator-row__sources" data-label="資料來源">
      <el-tag v-for="source in metric.sources ?? []" :key="source" size="small" effect="plain" class="guru-indicator-row__source">
        {{ source }}
      </el-tag>
    </td>
    <td class="guru-indicator-row__unit" data-label="單位">{{ metric.unit }}</td>
  </tr>
</template>

<style scoped>
.guru-indicator-row:nth-child(odd) {
  background: var(--el-fill-color-lighter);
}

.guru-indicator-row td {
  padding: 10px 12px;
  font-size: 16px;
  vertical-align: middle;
  text-align: left;
}

.guru-indicator-row__name {
  font-weight: 600;
}

.guru-indicator-row__formula-cell {
  width: 56px;
  text-align: center;
}

/* min-width: 0 overrides the flex-item default of min-width: auto — without it, this flex
   child refuses to shrink below its own widest unwrapped child's content width (a long single
   period/source label), which pushes the whole row wider than its <td>/row container instead of
   actually wrapping onto a second line the way flex-wrap: wrap is supposed to let it. Real bug
   fixed 2026-09-10 (reported live: "其他指標 表格 跑版了") — most visible on mobile, where the
   collapsed card layout's own fixed-width row left values with no room to overflow into, so a
   long 資料來源 tag ran straight off the edge of the screen. */
.guru-indicator-row__periods {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.guru-indicator-row__period {
  font-size: 16px;
}

.guru-indicator-row__sources {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

/* white-space/max-width override Element Plus's own el-tag default (nowrap) — a 資料來源 label
   can be a long, unbroken Chinese phrase (e.g. "證交所／櫃買中心每日評價指標（本益比／股價淨值
   比／殖利率）"), and nowrap alone would force this single tag wider than its row regardless of
   the flex-wrap/min-width fixes on its parent above — those only let MULTIPLE tags wrap onto
   separate lines, they don't stop one long tag from staying on one unbroken line. */
.guru-indicator-row__source {
  max-width: 100%;
  font-size: 16px;
  white-space: normal;
  word-break: break-word;
}

.guru-indicator-row__unit {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.guru-indicator-row__formula {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.guru-indicator-row__formula:hover {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}

.guru-indicator-row__no-formula {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

/* Stacked-card mobile fallback confirmed via AskUserQuestion 2026-09-10 (chosen over a
   horizontally-scrolling table) — same 600px breakpoint stock/[code].vue's own mobile tab-scroll
   fix already uses. thead hides here (see guru-indicators.vue's own <thead> — no matching rule
   needed in this file since that element isn't part of this component), each td becomes its own
   labeled line via `data-label` + `::before` so the column meaning isn't lost once native table
   semantics break down at `display: block`. */
@media (max-width: 600px) {
  .guru-indicator-row {
    display: block;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    margin-bottom: 8px;
    padding: 4px 0;
  }

  .guru-indicator-row:nth-child(odd) {
    background: transparent;
  }

  .guru-indicator-row td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: auto;
    text-align: right;
  }

  .guru-indicator-row td::before {
    content: attr(data-label);
    font-size: 16px;
    font-weight: 400;
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
  }

  .guru-indicator-row__periods,
  .guru-indicator-row__sources {
    justify-content: flex-end;
  }
}
</style>
