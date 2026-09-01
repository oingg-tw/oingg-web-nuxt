<script setup lang="ts">
import type { EmergingMarketStock } from '~/components/emerging/EmergingMarketStockCard.vue'

// Placeholder page — 興櫃 (emerging/pre-listing market) stocks. Card shell only for now: no
// backend endpoint exists yet (see EmergingMarketStockCard.vue's own type comment), so this
// renders illustrative fixture data — deliberately generic company names/codes, not real
// listings, since the 興櫃 roster itself changes too often (delistings, transfers to
// TWSE/TPEx) to safely hardcode specific real companies the way preferred-stocks.vue could
// with its much more stable exchange-listed issues.
const sampleStocks: EmergingMarketStock[] = [
  {
    code: '6821',
    name: '範例生技',
    price: 42.5,
    change: 1.2,
    changePercent: 2.91,
    parValue: 10,
    sponsorCount: 3,
    lastDisclosureType: 'semiAnnual',
    lastDisclosureDate: '2026-08-14',
    listingTransferStatus: 'reviewing',
    circuitBreakerTriggered: false
  },
  {
    code: '7115',
    name: '範例雲端科技',
    price: 68.0,
    change: -3.4,
    changePercent: -4.76,
    parValue: 1,
    sponsorCount: 2,
    lastDisclosureType: 'annual',
    lastDisclosureDate: '2026-03-31',
    listingTransferStatus: 'none',
    circuitBreakerTriggered: false
  },
  {
    code: '7302',
    name: '範例材料',
    price: 15.8,
    change: 5.3,
    changePercent: 50.48,
    parValue: 10,
    sponsorCount: 1,
    lastDisclosureType: 'semiAnnual',
    lastDisclosureDate: '2026-08-14',
    listingTransferStatus: 'none',
    circuitBreakerTriggered: true
  }
]
</script>

<template>
  <div class="emerging-market-page">
    <h1 class="emerging-market-page__title">興櫃專區</h1>
    <p class="emerging-market-page__subtitle">
      興櫃股票比較——推薦證券商造市家數、彈性面額、財報揭露頻率、轉板進度與熔斷狀態，協助評估議價交易市場特有的流動性與資訊揭露風險
    </p>
    <p class="emerging-market-page__disclaimer">以下為示意資料，非真實興櫃掛牌公司</p>

    <div class="emerging-market-page__grid">
      <EmergingMarketStockCard v-for="stock in sampleStocks" :key="stock.code" :stock="stock" />
    </div>
  </div>
</template>

<style scoped>
.emerging-market-page {
  width: 100%;
}

.emerging-market-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.emerging-market-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 8px;
}

.emerging-market-page__disclaimer {
  font-size: 16px;
  color: var(--el-color-warning);
  margin: 0 0 16px;
}

.emerging-market-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
</style>
