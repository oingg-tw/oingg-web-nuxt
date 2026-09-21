<script setup lang="ts">
import type { StockPageDigest } from '~/utils/stock-digest'
import { STOCK_DIGEST_DISCLAIMER, buildDigestFreshnessText } from '~/utils/stock-digest'

// 「資料來源」— the last section of the four /stock/:code pages that mount it（index, dividend,
// financial-statements, metrics-history）. Plain SSR'd prose, and now only what that heading says:
// when the data was last updated, where it came from, and the standing disclaimer.
//
// It used to also render a <dl> of every digest FACT grouped by category, and above it a `lead`
// sentence listing the same numbers again in prose. Both went 2026-09-21（「資料摘要與來源 很突兀 要強化SEO有別的方式嗎？希望可以找到替代
// 方案或是移除該區塊」）. The measurement behind that call: the block's original 2026-09-19 job was
// to be「the one part of these pages whose text a crawler can index without JavaScript」, and that
// justification expired when every sub-page gained question-form <h2>s, number-led answer
// sentences and real `data-ssr-table` markup. Measured before removing — outside this block,
// /dividend has 3,357 characters, five question headings and two tables; /metrics-history 2,498
// and three; the facts list was restating numbers those sections already state, in a bordered grid
// at the bottom of the page. That is what read as 突兀.
//
// The percentile lines（「本益比 28.52 倍，位於近5年第95百分位」）went in the same pass, last, once
// the heading had been narrowed to 資料來源 and they no longer belonged under it. They are also the
// one thing here that the newer pages answer far better:「這個比率在它自己的歷史裡站在哪」is what
// the PER/PBR/PSR river charts show, with the whole distribution drawn rather than one sentence
// about a percentile.
//
// The `lead` went for a second reason on top of that duplication: its real job is to BE the meta
// description（buildStockMetaDescription reads digest.lead, and useStockPageDigest hands the page
// its `description` from the same place）. That lands in <head> whether or not it is also printed
// in the body, so rendering it visibly bought nothing. The composable is untouched and every one
// of these pages still has its full, number-led meta description — verified per page after the
// change, not assumed.
//
// What did NOT go, because it was never the SEO part: 資料來源. Citing where the numbers come from
// is attribution, not a ranking device, and this is still the ONE place these four pages do it
// (SharedDataFreshnessNote deliberately shows only「最新資料：…」— the 2026-09-15 objection was the
// same source list repeating on every card). The newer pages do the same job better, per-metric
// from the catalog rather than one list — see collectMetricSources() in stock-digest.ts, which
// /margins and /solvency use.
//
// The composable behind this（useStockPageDigest）is untouched: it still supplies each page's meta
// description and its own series data. Only this visible section shrank.
//
// No gate, no ClientOnly, one DOM tree for both layouts; renders nothing when the digest has no
// content at all（a symbol with no backfill yet）rather than a placeholder — see stock-digest.ts's
// own note on「資料不足」. check-stock-pages.mjs compares this section's SSR text with its hydrated
// text, which is the hydration bug useStockPageDigest is built to avoid; that check reads the
// section's TEXT, so it survived the facts list going.

const props = defineProps<{
  digest: StockPageDigest | null
}>()

const freshnessText = computed(() => (props.digest ? buildDigestFreshnessText(props.digest) : null))

</script>

<template>
  <section v-if="digest && (digest.facts.length || digest.percentiles.length)" class="stock-digest" aria-labelledby="stock-digest-heading">
    <h2 id="stock-digest-heading" class="stock-digest__title">資料來源</h2>

    <p v-if="freshnessText" class="stock-digest__meta">{{ freshnessText }}</p>
    <p v-if="digest.sources.length" class="stock-digest__meta">資料來源：{{ digest.sources.join('、') }}</p>
    <p class="stock-digest__disclaimer">{{ STOCK_DIGEST_DISCLAIMER }}</p>
  </section>
</template>

<style scoped>
/* A quiet footer note, not a bordered card. The card chrome（20px padding, a border, its own
   background）is what made a block of attribution text read as another content card at the bottom
   of every page — it was sized for the facts grid that no longer exists. A top rule alone separates
   it from the page's last real section. */
.stock-digest {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.stock-digest__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* The 40em cap here went with main.css's own (2026-09-20, 「桌機板 不要限制內文寬度」) — see that
   file's .hub-answer/.stock-answer comment for why, including why it isn't a media query. These
   lines needed their own copy of the rule because they're scoped to this component, so they need
   their own removal too. */
.stock-digest__meta,
.stock-digest__disclaimer {
  margin: 0;
}

.stock-digest__meta {
  color: var(--el-text-color-secondary);
}
.stock-digest__disclaimer {
  color: var(--el-text-color-secondary);
}
</style>
