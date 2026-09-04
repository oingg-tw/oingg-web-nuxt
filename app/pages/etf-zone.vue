<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'

// Rebuilt 2026-09-04 into the same "risk checklist + real data table" format every other zone
// page already uses (ky-stocks.vue/emerging-market.vue/preferred-stocks.vue), keyed to
// docs/investment-knowledge/ETF Selection Guidelines.md — see project_docs_derived_feature_backlog
// memory for the full candidate list that doc supports.
//
// Scoped down hard per explicit user direction: of that doc's candidate checklist items, only
// the ones backed by data this app can actually show today are here — 費用率 and 槓桿/反向型
// (both real EtfRankingCard.vue columns already), plus 規模 (uses the same real AUM data, but
// only as the doc's own general "≥100億 is highly stable" guidance, NOT a delisting-risk
// judgment — see below for why). Left out entirely, not even as a placeholder shell, per
// explicit "有資料的部分才做" direction:
// - 折溢價異常 / 流動性(日均量、買賣價差) — needs exchange-side data (twse-ts/tpex-ts), not
//   asked for yet.
// - 配息組成透明度 (54C/5A/76/收益平準金拆解) / 追蹤誤差 / 成分股相似度比較 / 存續期間 —
//   confirmed with sitca-ts (2026-09-04) as either requiring PDF-parsing-scale work or not
//   found in their public data at all.
// - 清算下市風險 (regulatory AUM threshold) / 主動式-被動式標記 — sitca-ts offered an
//   approximate version of both (single-month AUM snapshot instead of a true 30-trading-day
//   average; an unverified 331-fund code-pattern rule), but per explicit "SITCA說要等的先當
//   沒有" direction, neither ships here yet — this page's own AUM-based 規模 guidance below is
//   deliberately just the doc's generic stability threshold, not a delisting warning, so it
//   doesn't quietly reintroduce the thing that got deferred.
//
// Cost-drag and leverage-decay tables below are the doc's own general compound-interest/
// volatility-decay formulas (arbitrary input → formula output), not any real fund's actual
// numbers — same category as this app's existing "no fabricated-looking real data" rule, since
// nothing here claims to be a specific ETF's real figure.
interface WarningItem {
  title: string
  description: string
}

const EXPENSE_RATIO_WARNINGS: WarningItem[] = [
  {
    title: '台股原型 ETF 總費用率門檻',
    description: '長期持有應優先選擇低於 0.30%–0.45% 的產品；名目股價高低不影響曝險，總費用率才是決定長期資產終值的核心因子。'
  }
]

// The doc's own worked example: NT$1,000,000 initial, 8% annual underlying return, 30-year hold.
const EXPENSE_RATIO_ROWS = [
  { rate: '0.15%', terminalValue: '約 945 萬元', erosion: '基準組（低摩擦）', erosionPercent: '—' },
  { rate: '0.50%', terminalValue: '約 857 萬元', erosion: '約 88 萬元', erosionPercent: '9.31%' },
  { rate: '1.00%', terminalValue: '約 746 萬元', erosion: '約 199 萬元', erosionPercent: '21.06%' },
  { rate: '1.50%', terminalValue: '約 661 萬元', erosion: '約 284 萬元', erosionPercent: '30.05%' }
]

const SCALE_WARNINGS: WarningItem[] = [
  {
    title: '資產規模與存續穩定性',
    description: '規模超過新台幣 100 億元的 ETF 具備較高存續穩定性與抗清算防禦力；規模過小則有營運規模不經濟、追蹤誤差擴大的風險。'
  }
]

const LEVERAGE_WARNINGS: WarningItem[] = [
  {
    title: '每日重新平衡的波動耗損',
    description: '槓桿與反向型 ETF 只承諾複製指數「單日」報酬的倍數，震盪走勢中的每日重置等同「追高殺低」，長期持有將產生自發性淨值耗損，即使指數最終打平原地。'
  },
  {
    title: '僅適用短線，嚴禁存股',
    description: '僅建議用於 1–5 個交易日內的明確單邊趨勢交易或事件型避險，不應納入定期定額、長期存股或退休金投資組合。'
  }
]

// The doc's own annualized geometric decay formula output at a few reference volatility levels
// — not any specific fund's real number.
const LEVERAGE_DECAY_ROWS = [
  { volatility: '15%', decay2x: '2.25%', decay3x: '6.75%' },
  { volatility: '20%', decay2x: '4.00%', decay3x: '12.00%' },
  { volatility: '30%', decay2x: '9.00%', decay3x: '27.00%' },
  { volatility: '50%', decay2x: '25.00%', decay3x: '75.00%' }
]
</script>

<template>
  <div class="etf-zone-page">
    <h1 class="etf-zone-page__title">ETF 專區</h1>
    <p class="etf-zone-page__subtitle">
      ETF 產品結構差異很大，光看名目殖利率或短期績效容易忽略結構性成本——這裡整理挑選前應該檢查的重點
    </p>

    <section class="etf-zone-page__section">
      <h2 class="etf-zone-page__section-title">總費用率</h2>
      <div class="etf-zone-page__list">
        <div v-for="item in EXPENSE_RATIO_WARNINGS" :key="item.title" class="etf-zone-page__item">
          <el-icon class="etf-zone-page__item-icon"><WarningFilled /></el-icon>
          <div class="etf-zone-page__item-body">
            <span class="etf-zone-page__item-title">{{ item.title }}</span>
            <p class="etf-zone-page__item-desc">{{ item.description }}</p>
          </div>
        </div>
      </div>
      <p class="etf-zone-page__note">以新台幣 100 萬元本金、標的年化報酬率 8%、持有 30 年為例，總費用率的複利侵蝕差距：</p>
      <div class="etf-zone-page__table-wrap">
        <table class="etf-zone-page__table">
          <thead>
            <tr>
              <th>總費用率</th>
              <th>30 年後資產終值</th>
              <th>累積費用侵蝕</th>
              <th>終值折損比例</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in EXPENSE_RATIO_ROWS" :key="row.rate">
              <td>{{ row.rate }}</td>
              <td>{{ row.terminalValue }}</td>
              <td>{{ row.erosion }}</td>
              <td>{{ row.erosionPercent }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="etf-zone-page__section">
      <h2 class="etf-zone-page__section-title">資產規模</h2>
      <div class="etf-zone-page__list">
        <div v-for="item in SCALE_WARNINGS" :key="item.title" class="etf-zone-page__item">
          <el-icon class="etf-zone-page__item-icon"><WarningFilled /></el-icon>
          <div class="etf-zone-page__item-body">
            <span class="etf-zone-page__item-title">{{ item.title }}</span>
            <p class="etf-zone-page__item-desc">{{ item.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="etf-zone-page__section">
      <h2 class="etf-zone-page__section-title">槓桿／反向型</h2>
      <div class="etf-zone-page__list">
        <div v-for="item in LEVERAGE_WARNINGS" :key="item.title" class="etf-zone-page__item">
          <el-icon class="etf-zone-page__item-icon"><WarningFilled /></el-icon>
          <div class="etf-zone-page__item-body">
            <span class="etf-zone-page__item-title">{{ item.title }}</span>
            <p class="etf-zone-page__item-desc">{{ item.description }}</p>
          </div>
        </div>
      </div>
      <p class="etf-zone-page__note">震盪走勢下，年化波動耗損隨波動度呈非線性放大：</p>
      <div class="etf-zone-page__table-wrap">
        <table class="etf-zone-page__table">
          <thead>
            <tr>
              <th>標的年化波動度</th>
              <th>2 倍槓桿年化耗損</th>
              <th>3 倍槓桿年化耗損</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in LEVERAGE_DECAY_ROWS" :key="row.volatility">
              <td>{{ row.volatility }}</td>
              <td>{{ row.decay2x }}</td>
              <td>{{ row.decay3x }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="etf-zone-page__section">
      <h2 class="etf-zone-page__section-title">ETF 排行</h2>
      <DashboardEtfRankingCard />
    </section>
  </div>
</template>

<style scoped>
.etf-zone-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.etf-zone-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.etf-zone-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: -16px 0 0;
}

.etf-zone-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.etf-zone-page__section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.etf-zone-page__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.etf-zone-page__item {
  display: flex;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.etf-zone-page__item-icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 18px;
  color: var(--el-color-warning);
}

.etf-zone-page__item-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.etf-zone-page__item-title {
  font-size: 16px;
  font-weight: 600;
}

.etf-zone-page__item-desc {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.etf-zone-page__note {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.etf-zone-page__table-wrap {
  overflow-x: auto;
}

.etf-zone-page__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 16px;
}

.etf-zone-page__table th,
.etf-zone-page__table td {
  padding: 8px 12px;
  text-align: right;
  border-bottom: 1px solid var(--el-border-color-lighter);
  white-space: nowrap;
}

.etf-zone-page__table th:first-child,
.etf-zone-page__table td:first-child {
  text-align: left;
}

.etf-zone-page__table th {
  color: var(--el-text-color-secondary);
  font-weight: 600;
}
</style>
