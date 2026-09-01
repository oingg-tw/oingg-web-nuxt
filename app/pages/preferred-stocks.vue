<script setup lang="ts">
import type { PreferredStock } from '~/components/preferred/PreferredStockCard.vue'

// Placeholder page — 特別股 (preferred stocks). Card shell only for now: no backend
// endpoint exists yet (see PreferredStockCard.vue's own PreferredStock type comment), so
// this renders a handful of hand-picked real TW-listed issues as fixture data purely to
// prove out the card's layout/field set, not as live quotes.
const sampleStocks: PreferredStock[] = [
  {
    code: '2002A',
    name: '中鋼特',
    price: 63.9,
    change: 0.15,
    changePercent: 0.24,
    dividendRate: 5.5,
    referenceYield: 4.31,
    dividendType: 'non-cumulative',
    participation: 'non-participating',
    convertible: false,
    conversionPrice: null,
    callDate: null,
    callPrice: null,
    creditRating: 'twA'
  },
  {
    code: '1101B',
    name: '台泥乙特',
    price: 62.1,
    change: -0.3,
    changePercent: -0.48,
    dividendRate: 4.6,
    referenceYield: 3.71,
    dividendType: 'cumulative',
    participation: 'non-participating',
    convertible: false,
    conversionPrice: null,
    callDate: '2027-06-20',
    callPrice: 60,
    creditRating: 'twA+'
  },
  {
    code: '2891B',
    name: '中信金乙特',
    price: 54.8,
    change: 0,
    changePercent: 0,
    dividendRate: 3.55,
    referenceYield: 3.24,
    dividendType: 'non-cumulative',
    participation: 'non-participating',
    convertible: false,
    conversionPrice: null,
    callDate: '2028-12-15',
    callPrice: 50,
    creditRating: 'twAA-'
  }
]
</script>

<template>
  <div class="preferred-stocks-page">
    <h1 class="preferred-stocks-page__title">特別股專區</h1>
    <p class="preferred-stocks-page__subtitle">
      特別股比較——股息率、參考殖利率、累積/參與分配條款、轉換與贖回條件，協助評估相對於普通股與債券的風險報酬定位
    </p>

    <div class="preferred-stocks-page__grid">
      <PreferredStockCard v-for="stock in sampleStocks" :key="stock.code" :stock="stock" />
    </div>
  </div>
</template>

<style scoped>
.preferred-stocks-page {
  width: 100%;
}

.preferred-stocks-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.preferred-stocks-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 16px;
}

.preferred-stocks-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
</style>
