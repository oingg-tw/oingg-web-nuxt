<script setup lang="ts">
// Factored out of StockForeignShareholdingChart.vue's own footer line ("資料來源：TWSE T86
// 報表，每日 T+1 揭露｜最新資料日期：2026-09-07") per direct request to apply the same
// freshness-labeling pattern to every other stock-detail chart card, not just that one — so
// users can tell how current each card's underlying data actually is instead of assuming
// everything is equally fresh. `asOf` is left as a plain string (not a Date) since callers
// already have their own period-label conventions (calendar dates for daily data, "YYYY Qn"
// for quarterly financial-statement data) — this component just lays out whatever they hand it.
// `sourceLabel` is still accepted (every one of the ~30 call sites passes it) but no longer
// rendered here — see the 2026-09-19 note below.
defineProps<{
  sourceLabel?: string
  asOf: string | null
}>()

// Hidden site-wide 2026-09-15 per直接要求（"卡片上的 資料來源 都先幫我隱藏吧"）——"先" reads as
// temporary, so this stayed a single named flag here rather than deleting the markup or touching
// each call site.
//
// Restored 2026-09-19 as part of the stock-detail SEO/a11y redesign, but only HALF of it: each
// card shows just its own「最新資料：{asOf}」freshness date again (that part is card-specific and
// genuinely useful per card), while the 資料來源 list — the part the 09-15 complaint was about,
// repeated verbatim on every card — now lives ONCE per page in the server-rendered
// StockPageDigest.vue block (E-E-A-T needs the source attribution somewhere crawlable; it just
// doesn't need to be on 24 cards). `sourceLabel` is therefore kept in the prop contract so no
// caller has to change, but intentionally unused.
const SHOW_DATA_SOURCE = true
</script>

<template>
  <p v-if="SHOW_DATA_SOURCE && asOf" class="data-freshness-note">
    最新資料：{{ asOf }}
  </p>
</template>

<style scoped>
.data-freshness-note {
  margin: 4px 8px 0;
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}
</style>
