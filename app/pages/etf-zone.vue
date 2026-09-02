<script setup lang="ts">
import type { ETFFund } from '~/components/etf/ETFCard.vue'

// Placeholder page — ETF 專區，未來將放 ETF 比較功能，包含相似度比較（找出成分股/產業重疊度
// 高的 ETF，協助評估替代或分散效果）。Card shell only for now: no backend endpoint exists yet
// (see ETFCard.vue's own type comment), so this renders illustrative fixture data —
// deliberately generic fund names/codes, not real listings. Unlike preferred-stocks.vue's
// stable exchange-listed issues, this doc's own subject matter (高股息 ETF 配息爭議, 收益平準金
// governance) is an actively contentious topic for several real, well-known funds — reusing a
// real code with invented risk-flag numbers here risks being read as an actual opinion on that
// specific fund, not just a UI demo.
//
// DashboardEtfRankingCard added 2026-09-02 — real bff-ts data (was briefly a dashboard card,
// moved here per user request since it's genuinely an ETF-zone concern, not a market-overview
// one). Kept separate from the fixture grid below with its own disclaimer-free section so it
// doesn't get lumped in with sampleFunds' explicit "示意資料" framing.
const sampleFunds: ETFFund[] = [
  {
    code: '00901',
    name: '示範台股ETF',
    price: 42.15,
    change: 0.35,
    changePercent: 0.84,
    expenseRatio: 0.35,
    category: 'domesticEquity',
    aum: 250,
    avgDailyVolume: 3500,
    trackingError: 0.4,
    premiumDiscount: 0.2,
    replicationMethod: 'full',
    leverageMultiple: 1,
    actualYield: 3.2,
    referenceYield: 3.5,
    domicile: 'taiwan'
  },
  {
    code: '00902',
    name: '示範高息ETF',
    price: 18.6,
    change: -0.12,
    changePercent: -0.64,
    expenseRatio: 0.55,
    category: 'domesticEquity',
    aum: 15,
    avgDailyVolume: 1200,
    trackingError: 0.8,
    premiumDiscount: 1.5,
    replicationMethod: 'full',
    leverageMultiple: 1,
    actualYield: 9.5,
    referenceYield: 6.0,
    domicile: 'taiwan'
  },
  {
    code: '00903',
    name: '示範槓桿ETF',
    price: 8.42,
    change: -0.68,
    changePercent: -7.47,
    expenseRatio: 1.2,
    category: 'leveraged',
    aum: 1.5,
    avgDailyVolume: 300,
    trackingError: 1.8,
    premiumDiscount: 4.5,
    replicationMethod: 'synthetic',
    leverageMultiple: 2,
    actualYield: 0,
    referenceYield: 0,
    domicile: 'taiwan'
  }
]
</script>

<template>
  <div class="etf-zone-page">
    <h1 class="etf-zone-page__title">ETF 專區</h1>
    <p class="etf-zone-page__subtitle">ETF 比較——追蹤費用率、成分股、報酬表現、相似度比較，協助挑選適合的 ETF</p>

    <DashboardEtfRankingCard class="etf-zone-page__ranking" />

    <p class="etf-zone-page__disclaimer">以下為示意資料，非真實 ETF 數據</p>

    <div class="etf-zone-page__grid">
      <ETFCard v-for="fund in sampleFunds" :key="fund.code" :stock="fund" />
    </div>
  </div>
</template>

<style scoped>
.etf-zone-page {
  width: 100%;
}

.etf-zone-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.etf-zone-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 24px;
}

.etf-zone-page__ranking {
  max-width: 420px;
  margin: 0 0 24px;
}

.etf-zone-page__disclaimer {
  font-size: 16px;
  color: var(--el-color-warning);
  margin: 0 0 16px;
}

.etf-zone-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
</style>
