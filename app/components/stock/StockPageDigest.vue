<script setup lang="ts">
import type { StockPageDigest, StockDigestFact } from '~/utils/stock-digest'
import { STOCK_DIGEST_DISCLAIMER, buildDigestFreshnessText } from '~/utils/stock-digest'

// 「資料摘要與來源」— the last section of every /stock/:code sub-page (2026-09-19). Plain SSR'd
// prose + a <dl> built from useStockPageDigest's numbers: the one part of these pages whose text a
// crawler can index without JavaScript, and where the page cites its data sources ONCE (the
// per-card SharedDataFreshnessNote deliberately shows only「最新資料：…」— the user's 2026-09-15
// objection was the same source list repeating on every card). No gate, no ClientOnly, one DOM
// tree for both layouts; renders nothing at all when the digest has no numbers（a symbol with no
// backfill yet）rather than a placeholder — see stock-digest.ts's own note on「資料不足」.
//
// data-digest-code / data-digest-value on each fact are hooks for the Playwright check that the
// SSR text equals the hydrated text and matches the cards' own values.
const props = defineProps<{
  digest: StockPageDigest | null
}>()

// Grouped in the site's fixed category order (GURU_BADGE_CATEGORIES — the same 市場評價 → 大戶籌碼
// sequence company-health's sections and the guru pages use), not in fetch order.
const groups = computed<{ category: string; facts: StockDigestFact[] }[]>(() => {
  const list: { category: string; facts: StockDigestFact[] }[] = []
  for (const fact of props.digest?.facts ?? []) {
    const group = list.find(item => item.category === fact.category)
    if (group) group.facts.push(fact)
    else list.push({ category: fact.category, facts: [fact] })
  }
  const order = (category: string) => {
    const index = (GURU_BADGE_CATEGORIES as readonly string[]).indexOf(category)
    return index === -1 ? GURU_BADGE_CATEGORIES.length : index
  }
  return list.sort((a, b) => order(a.category) - order(b.category))
})

const freshnessText = computed(() => (props.digest ? buildDigestFreshnessText(props.digest) : null))

function termFor(fact: StockDigestFact): string {
  if (!fact.periodLabel) return fact.label
  return /^[A-Za-z0-9]/.test(fact.label) ? `${fact.periodLabel} ${fact.label}` : `${fact.periodLabel}${fact.label}`
}
</script>

<template>
  <section v-if="digest && (digest.facts.length || digest.percentiles.length)" class="stock-digest" aria-labelledby="stock-digest-heading">
    <h2 id="stock-digest-heading" class="stock-digest__title">資料摘要與來源</h2>
    <p v-if="digest.lead" class="stock-digest__lead">{{ digest.lead }}</p>

    <div v-for="group in groups" :key="group.category" class="stock-digest__group">
      <h3 v-if="groups.length > 1" class="stock-digest__group-title">{{ group.category }}</h3>
      <dl class="stock-digest__facts">
        <div v-for="fact in group.facts" :key="fact.code" class="stock-digest__fact" :data-digest-code="fact.code" :data-digest-value="fact.value">
          <dt class="stock-digest__term">{{ termFor(fact) }}</dt>
          <dd class="stock-digest__value">{{ fact.valueText }}</dd>
        </div>
      </dl>
    </div>

    <p v-for="percentile in digest.percentiles" :key="percentile.code" class="stock-digest__percentile" :data-digest-code="percentile.code">
      {{ percentile.text }}
    </p>

    <p v-if="freshnessText" class="stock-digest__meta">{{ freshnessText }}</p>
    <p v-if="digest.sources.length" class="stock-digest__meta">資料來源：{{ digest.sources.join('、') }}</p>
    <p class="stock-digest__disclaimer">{{ STOCK_DIGEST_DISCLAIMER }}</p>
  </section>
</template>

<style scoped>
.stock-digest {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-bg-color);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.stock-digest__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-digest__lead,
.stock-digest__percentile,
.stock-digest__meta,
.stock-digest__disclaimer {
  margin: 0;
}

.stock-digest__lead {
  color: var(--el-text-color-primary);
}

.stock-digest__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stock-digest__group-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-digest__facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 4px 24px;
  margin: 0;
}

.stock-digest__fact {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.stock-digest__term {
  margin: 0;
}

.stock-digest__value {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.stock-digest__meta {
  color: var(--el-text-color-secondary);
}

.stock-digest__disclaimer {
  color: var(--el-text-color-secondary);
}
</style>
