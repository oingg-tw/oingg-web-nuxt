<script setup lang="ts">
// Card shell rebuilt 2026-09-06 per conductor's 特別股專區.md — still no backend endpoint
// (analysis-ts's src/api/bff/preferredStock/ is marked "⬜ 未實作，準備中", and the doc notes
// the architecture direction — plain relay vs. real derived metrics like YTW/negative-
// convexity — hasn't even been decided yet), so this renders hand-picked real TW-listed
// issues as fixture data purely to verify the card's field set/layout, not live quotes. The
// disclaimer banner below is required by the doc for exactly this reason — not just a nice-to-
// have — until a real endpoint lands. Fixture data itself lives in usePreferredStocks.ts, not
// inline here, so /preferred-stocks/[code].vue can look up the same entries by code.
const { stocks } = usePreferredStocks()

// Shared with dashboard.vue/stock/[code].vue's own novice/pro split — per direct instruction
// in the doc ("複用同一組 useDashboardExperienceMode.ts 狀態"), not a page-local mode like
// stock/[code].vue's three-way 簡易/專家/會計 (that page needed a third value dashboard has no
// equivalent for; this page doesn't). 簡易軌 shows only the five/six contract-term badges, YTW,
// and the negative-convexity warning — the "值不值得安心持有" conclusions; 償債能力四項與溢價率
// collapse to 專家軌.
const { mode: experienceMode } = useDashboardExperienceMode()
</script>

<template>
  <div class="preferred-stocks-page">
    <div class="preferred-stocks-page__header">
      <div>
        <h1 class="preferred-stocks-page__title">特別股專區</h1>
        <p class="preferred-stocks-page__subtitle">
          特別股比較——最差殖利率、契約條款解構、贖回條件與償債能力，協助評估相對於普通股與債券的風險報酬定位
        </p>
      </div>
      <el-radio-group v-model="experienceMode" size="small">
        <el-radio-button value="novice">簡易模式</el-radio-button>
        <el-radio-button value="pro">專家模式</el-radio-button>
      </el-radio-group>
    </div>

    <div class="preferred-stocks-page__disclaimer" role="alert">
      提示：本專區目前展示之特別股條款與價格為靜態驗證資料（Fixture），非盤中即時報價，僅供產品介面功能體驗。
    </div>

    <div class="preferred-stocks-page__grid">
      <PreferredStockCard v-for="stock in stocks" :key="stock.code" :stock="stock" :mode="experienceMode" />
    </div>
  </div>
</template>

<style scoped>
.preferred-stocks-page {
  width: 100%;
}

.preferred-stocks-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.preferred-stocks-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px;
}

.preferred-stocks-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.preferred-stocks-page__disclaimer {
  margin-bottom: 16px;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 16px;
}

.preferred-stocks-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
</style>
