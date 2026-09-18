<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryTimeframe } from '~/composables/stock/useMetricsHistory'

// 「股息撐得住嗎？」／「自由現金流從哪裡來？」／「營業現金流跟帳上的獲利一樣嗎？」— added
// 2026-09-18 per direct request ("股息哪裡來幫我加上一張卡片與現在的股利怎麼來類似，我要比較效果"),
// alongside a full design brief arguing for the OPPOSITE direction from
// StockRevenueToDividendBridge.vue's own「股利怎麼來？」瀑布圖. That card starts from revenue
// (正推／會計師敘事順序) and ends at dividend, 9 stages deep. This trio is the direct A/B
// comparison: starts from the ONE number a retiree already knows and cares about (the dividend
// they actually received) and works BACKWARD.
//
// 3 cards, not 2 — 2026-09-18 direct follow-up ("你每股領到的股利 為什麼不是從 每股自由現金流來?
// 自由現金流跟EPS又是甚麼關係? 我問的這些問題每個都值得做成卡片說明") — the first 2-card version
// (股利/EPS paired, OCF/FCF paired) skipped straight from 股利 to EPS, leaving FCF's own direct
// relationship to the dividend implicit, and left OCF/EPS's own relationship implicit too (neither
// ever appeared side by side in the same card). Restructured into 3 cards, each showing exactly
// ONE hop with BOTH numbers visible together, so every adjacent relationship in the chain is an
// explicit, answerable question instead of an implied gap between cards:
//   股利 ↔ 自由現金流（Card 1）— 股利實際上是從公司可動用的現金支付的，不是從帳上獲利數字直接
//     支付，所以「股利撐不撐得住」這個問題，直接比較的對象該是 FCF，不是 EPS（EPS 只是更上游、
//     更間接的一步 — 見下面 Card 3）。
//   自由現金流 ↔ 營業現金流（Card 2）— FCF＝OCF－資本支出，資本支出是維持或擴張生意所需的投資，
//     不能拿來發股利，所以 FCF 才是股利真正的天花板。
//   營業現金流 ↔ 每股盈餘（Card 3）— EPS 是會計淨利，含折舊攤銷等非現金項目；OCF 是實際收付的
//     現金，兩者概念不同、數字通常也不相等 — 這張卡片直接回答「自由現金流跟EPS是甚麼關係」。
// 每張卡片的「已知」數字延續上一張卡片的「揭露」數字（FCF 同時是 Card 1 的答案跟 Card 2 的已知
// 起點，OCF 同樣銜接 Card 2/3），刻意在相鄰卡片重複顯示同一個數字，讓整條鏈路讀起來還是連貫的，
// 不是三個互不相干的事實。
//
// One shared data fetch below (all 3 cards read the same 4 fields, same as
// StockEvMultiplesCard.vue/StockYieldFamilyCard.vue's own precedent for a multi-root component
// sharing one fetch across multiple cards) — this file itself has no wrapping element, meant to be
// rendered as a direct sibling trio wherever the caller puts it (same "no extra <div>" reasoning
// AppNavMenu.vue/StockDetailSidebarNav.vue already document elsewhere in this app).
//
// Deliberately NOT a chart (no Sankey, no waterfall, no SharedBridgeChart reuse) — per the design
// brief's own citation of this app's existing 高齡友善圖表選型規範: a Sankey/flow diagram asks the
// viewer to track width+direction+branching simultaneously, which that spec already rules out for
// this audience. A plain row per number, connected by a plain-language question, needs none of
// that.
//
// Compliance boundary respected (design brief's own 2.0 §4.6.3 刪形容詞測試): every row is a bare
// fact (number + neutral label), no evaluative conclusion synthesized from comparing them (e.g.
// never "配息穩健" or similar) — presenting the numbers is fine, concluding FROM them isn't; that
// judgment call is left to the viewer.
const DIVIDEND_FCF_INFO_TEXT = '股利實際上是從公司可動用的現金支付，不是從帳上的獲利數字直接支付——這裡直接比較股利與自由現金流，不是先比對帳上獲利（EPS）'
const FCF_OCF_INFO_TEXT = '自由現金流＝營業現金流－資本支出。資本支出是維持或擴張生意所需的投資，不能拿來發股利'
const OCF_EPS_INFO_TEXT = 'EPS 是會計淨利，包含折舊攤銷等非現金項目；營業現金流是實際收付的現金——兩者概念不同，數字通常也不會完全相等'

const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)

const CASH_CHAIN_CODES = ['dividendPerShare', 'eps', 'ocfPerShare', 'fcfPerShare']
// TTM only — same reasoning as StockRevenueToDividendBridge.vue's own top comment (dividends are
// an annual policy, no real "this quarter's dividend" concept, so a 單季 toggle here would hit
// the identical scale-mismatch problem that card already ruled out).
const cashChainHistory = useMetricsHistory(symbolRef, ref(CASH_CHAIN_CODES), ref<MetricsHistoryTimeframe>('TTM'), ref(1))

const latestEntry = computed(() => cashChainHistory.data.value?.at(-1) ?? null)

const dividendPerShare = computed<number | null>(() => latestEntry.value?.values.dividendPerShare?.value ?? null)
const eps = computed<number | null>(() => latestEntry.value?.values.eps?.value ?? null)
const ocfPerShare = computed<number | null>(() => latestEntry.value?.values.ocfPerShare?.value ?? null)
const fcfPerShare = computed<number | null>(() => latestEntry.value?.values.fcfPerShare?.value ?? null)

const hasDividendFcfData = computed(() => dividendPerShare.value !== null && fcfPerShare.value !== null)
const hasFcfOcfData = computed(() => fcfPerShare.value !== null && ocfPerShare.value !== null)
const hasOcfEpsData = computed(() => ocfPerShare.value !== null && eps.value !== null)

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number } | null): string | null {
  return entry ? `${entry.fiscalYear} Q${entry.fiscalQuarter}` : null
}

function formatAmount(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)} 元`
}
</script>

<template>
  <el-card class="dividend-cash-chain-card" shadow="never">
    <template #header>
      <div class="dividend-cash-chain-card__header">
        <span class="dividend-cash-chain-card__title">
          股息撐得住嗎？
          <el-tooltip :content="DIVIDEND_FCF_INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dividend-cash-chain-card__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>

    <el-empty v-if="!cashChainHistory.pending.value && !hasDividendFcfData" description="這檔股票尚無配息相關資料" :image-size="64" />
    <div v-else v-loading="cashChainHistory.pending.value" class="dividend-cash-chain-card__chain">
      <div class="dividend-cash-chain-card__row">
        <span class="dividend-cash-chain-card__label">你每股領到的股利</span>
        <span class="dividend-cash-chain-card__value">{{ formatAmount(dividendPerShare) }}</span>
      </div>
      <p class="dividend-cash-chain-card__question">↓ 公司這期真正能動用的現金，夠不夠付這筆股利？</p>
      <div class="dividend-cash-chain-card__row">
        <span class="dividend-cash-chain-card__label">自由現金流</span>
        <span class="dividend-cash-chain-card__value">{{ formatAmount(fcfPerShare) }}</span>
      </div>
    </div>

    <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="periodLabel(latestEntry)" />
  </el-card>

  <el-card class="dividend-cash-chain-card" shadow="never">
    <template #header>
      <div class="dividend-cash-chain-card__header">
        <span class="dividend-cash-chain-card__title">
          自由現金流從哪裡來？
          <el-tooltip :content="FCF_OCF_INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dividend-cash-chain-card__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>

    <el-empty v-if="!cashChainHistory.pending.value && !hasFcfOcfData" description="這檔股票尚無現金流相關資料" :image-size="64" />
    <div v-else v-loading="cashChainHistory.pending.value" class="dividend-cash-chain-card__chain">
      <div class="dividend-cash-chain-card__row">
        <span class="dividend-cash-chain-card__label">自由現金流</span>
        <span class="dividend-cash-chain-card__value">{{ formatAmount(fcfPerShare) }}</span>
      </div>
      <p class="dividend-cash-chain-card__question">↓ 這是本業收到的現金，扣掉維持營運所需投資後剩下的</p>
      <div class="dividend-cash-chain-card__row">
        <span class="dividend-cash-chain-card__label">本業實際收到的現金（每股營業現金流）</span>
        <span class="dividend-cash-chain-card__value">{{ formatAmount(ocfPerShare) }}</span>
      </div>
    </div>

    <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="periodLabel(latestEntry)" />
  </el-card>

  <el-card class="dividend-cash-chain-card" shadow="never">
    <template #header>
      <div class="dividend-cash-chain-card__header">
        <span class="dividend-cash-chain-card__title">
          營業現金流跟帳上的獲利一樣嗎？
          <el-tooltip :content="OCF_EPS_INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dividend-cash-chain-card__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>

    <el-empty v-if="!cashChainHistory.pending.value && !hasOcfEpsData" description="這檔股票尚無獲利相關資料" :image-size="64" />
    <div v-else v-loading="cashChainHistory.pending.value" class="dividend-cash-chain-card__chain">
      <div class="dividend-cash-chain-card__row">
        <span class="dividend-cash-chain-card__label">本業實際收到的現金（每股營業現金流）</span>
        <span class="dividend-cash-chain-card__value">{{ formatAmount(ocfPerShare) }}</span>
      </div>
      <p class="dividend-cash-chain-card__question">↓ 這筆現金，是從帳上賺的錢調整而來的</p>
      <div class="dividend-cash-chain-card__row">
        <span class="dividend-cash-chain-card__label">公司這期賺的每股盈餘（EPS）</span>
        <span class="dividend-cash-chain-card__value">{{ formatAmount(eps) }}</span>
      </div>
    </div>

    <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="periodLabel(latestEntry)" />
  </el-card>
</template>

<style scoped>
.dividend-cash-chain-card {
  border-radius: 12px;
}

.dividend-cash-chain-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dividend-cash-chain-card__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dividend-cash-chain-card__info {
  font-size: 0.875rem;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.dividend-cash-chain-card__chain {
  display: flex;
  flex-direction: column;
}

.dividend-cash-chain-card__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dividend-cash-chain-card__label {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.dividend-cash-chain-card__value {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

/* 純文字上下箭頭提示問句，不是另一種圖表元素——刻意用最陽春的文字排版，呼應設計說明裡「縱向
   四列、每列一個數字加一句話」的要求，不引入任何需要額外解讀的視覺符號。 */
.dividend-cash-chain-card__question {
  margin: 6px 0 6px 16px;
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}
</style>
