<script lang="ts">
// Text alternative for a chart (2026-09-19, the stock-page a11y/SEO redesign). `summary` is the
// one-sentence neutral description that becomes the chart's accessible name AND its visible
// <figcaption>; `table` is the same data as a visually-hidden <table> for screen-reader users who
// want the numbers behind the picture (WCAG 1.1.1 — an ECharts SVG is otherwise a silent block).
// Wording follows the compliance register: numbers and percentile positions, no adjectives.
export interface ChartAlt {
  summary: string
  table?: {
    caption: string
    columns: string[]
    rows: (string | number)[][]
  }
}
</script>

<script setup lang="ts">
// Wraps a chart (the default slot — normally a <SharedChart>) in a <figure>: a role="img" box
// named by `alt.summary` (an img role's children are presentational, so the ECharts DOM inside
// is hidden from assistive tech without touching it), a visible <figcaption>, and optionally a
// visually-hidden data <table>.
//
// A separate wrapper component, NOT an `alt` prop on SharedChart itself: the first version made
// SharedChart's root a <figure> and forwarded `class` to the inner VChart with inheritAttrs:false
// — which silently lost every call site's scoped height rule（`.metric-history-chart__chart` is
// scoped CSS, so the parent's `data-v-…` attribute only lands on a child component's ROOT element;
// the inner VChart carried the class but not the attribute, matched nothing, and every migrated
// chart collapsed to zero height — caught in a screenshot 2026-09-19). Slot content keeps the
// slot owner's scope id, so a <SharedChart> placed inside this component's slot is styled
// exactly as before.
//
// The slot sits in ONE fixed place regardless of whether `alt` is there yet: `alt` is usually
// null while the card's data loads and arrives a moment later, and a v-if/v-else that moved the
// slot between "bare" and "inside the figure" unmounted and re-mounted the VChart at that moment —
// nine "Initialize failed: invalid dom." page errors from the dying vue-echarts instances on
// 公司健檢 (measured 2026-09-19). So the <figure> and the wrapper div always render; only the
// role/aria-label, the caption and the table come and go with `alt`.
defineProps<{
  alt: ChartAlt | null
}>()
</script>

<template>
  <figure class="shared-chart-figure">
    <div :role="alt ? 'img' : undefined" :aria-label="alt?.summary" class="shared-chart-figure__canvas">
      <slot />
    </div>
    <figcaption v-if="alt" class="shared-chart-figure__caption">{{ alt.summary }}</figcaption>
    <table v-if="alt?.table" class="visually-hidden">
      <caption>{{ alt.table.caption }}</caption>
      <thead>
        <tr>
          <th v-for="column in alt.table.columns" :key="column" scope="col">{{ column }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in alt.table.rows" :key="rowIndex">
          <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
.shared-chart-figure {
  margin: 0;
}

.shared-chart-figure__caption {
  margin: 4px 4px 0;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
</style>
