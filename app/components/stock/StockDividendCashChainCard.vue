<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryTimeframe } from '~/composables/stock/useMetricsHistory'

// 「股息撐得住嗎？」／「賺的錢真的變成現金了嗎？」— added 2026-09-18 per direct request ("股息哪裡
// 來幫我加上一張卡片與現在的股利怎麼來類似，我要比較效果"), alongside a full design brief arguing
// for the OPPOSITE direction from StockRevenueToDividendBridge.vue's own「股利怎麼來？」瀑布圖.
// That card starts from revenue (正推／會計師敘事順序) and ends at dividend, 9 stages deep. This
// pair is the direct A/B comparison: starts from the ONE number a retiree already knows and cares
// about (the dividend they actually received) and works BACKWARD, one question at a time —
// "這些錢從哪來？" → EPS → "賺的錢真的收到現金了嗎？" → 每股營業現金流 →
// "扣掉維持營運的投資後還剩多少？" → 每股自由現金流. Chain ENDS at FCF, deliberately NOT revenue
// — per the design brief's own reasoning: the real constraint on whether a dividend is sustainable
// is free cash flow (and the legal earnings-reserve requirement), not revenue; revenue sits behind
// accounts receivable/inventory/capex, three more steps removed from the dividend than FCF is, so
// ending the chain there would imply a causal strength that doesn't really exist at this level of
// aggregation.
//
// TWO separate cards, not one card + SharedExpandToggle — 2026-09-18 direct follow-up ("我喜歡這個
// 概念 但是我不要下拉清單 我希望分成兩張卡片") reversing the first version's own progressive-
// disclosure design (collapsed by default, expand button reveals the deeper pair). Both pairs are
// now always visible, each its own <el-card> with its own title/question framing — 股利/EPS answers
// "有賺才配、沒有硬撐嗎", 營業現金流/自由現金流 answers "賺的錢是真現金，還是紙上數字". One shared
// data fetch below (both cards read the same 4 fields, same as StockEvMultiplesCard.vue/
// StockYieldFamilyCard.vue's own precedent for a multi-root component sharing one fetch across
// multiple cards) — this file itself has no wrapping element, meant to be rendered as a direct
// sibling pair wherever the caller puts it (same "no extra <div>" reasoning AppNavMenu.vue/
// StockDetailSidebarNav.vue already document elsewhere in this app).
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
const SHALLOW_INFO_TEXT = '從你實際領到的股利開始，往回問「這筆錢從哪裡來」——只呈現數字本身，不做「穩健／不穩健」之類的結論'
const DEEP_INFO_TEXT = 'EPS 是會計淨利，不一定等於實際收到的現金——這裡看本業真正收進來的現金，再扣掉維持營運所需的投資後剩下多少'

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

const hasShallowData = computed(() => dividendPerShare.value !== null && eps.value !== null)
const hasDeepData = computed(() => ocfPerShare.value !== null && fcfPerShare.value !== null)

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
          <el-tooltip :content="SHALLOW_INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dividend-cash-chain-card__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>

    <el-empty v-if="!cashChainHistory.pending.value && !hasShallowData" description="這檔股票尚無配息相關資料" :image-size="64" />
    <div v-else v-loading="cashChainHistory.pending.value" class="dividend-cash-chain-card__chain">
      <div class="dividend-cash-chain-card__row">
        <span class="dividend-cash-chain-card__label">你每股領到的股利</span>
        <span class="dividend-cash-chain-card__value">{{ formatAmount(dividendPerShare) }}</span>
      </div>
      <p class="dividend-cash-chain-card__question">↑ 這些錢從哪來？</p>
      <div class="dividend-cash-chain-card__row">
        <span class="dividend-cash-chain-card__label">公司這期賺的每股盈餘（EPS）</span>
        <span class="dividend-cash-chain-card__value">{{ formatAmount(eps) }}</span>
      </div>
    </div>

    <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="periodLabel(latestEntry)" />
  </el-card>

  <el-card class="dividend-cash-chain-card" shadow="never">
    <template #header>
      <div class="dividend-cash-chain-card__header">
        <span class="dividend-cash-chain-card__title">
          賺的錢真的變成現金了嗎？
          <el-tooltip :content="DEEP_INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dividend-cash-chain-card__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>

    <el-empty v-if="!cashChainHistory.pending.value && !hasDeepData" description="這檔股票尚無現金流相關資料" :image-size="64" />
    <div v-else v-loading="cashChainHistory.pending.value" class="dividend-cash-chain-card__chain">
      <div class="dividend-cash-chain-card__row">
        <span class="dividend-cash-chain-card__label">本業實際收到的現金（每股營業現金流）</span>
        <span class="dividend-cash-chain-card__value">{{ formatAmount(ocfPerShare) }}</span>
      </div>
      <p class="dividend-cash-chain-card__question">↑ 扣掉維持營運的投資後還剩多少？</p>
      <div class="dividend-cash-chain-card__row">
        <span class="dividend-cash-chain-card__label">自由現金流</span>
        <span class="dividend-cash-chain-card__value">{{ formatAmount(fcfPerShare) }}</span>
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
