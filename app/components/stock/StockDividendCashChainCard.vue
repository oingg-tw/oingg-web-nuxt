<script setup lang="ts">
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
// explicit, answerable question instead of an implied gap between cards.
//
// Vertical-equation format — 2026-09-18 direct follow-up ("我希望卡片變成直式的算式，每張卡片要
// 處理三個數字...現在中間放說明的部分，移到算式後面"): the original「row → 提問句 → row」layout
// only ever showed 2 of the 3 numbers involved in each hop (the gap between them was implicit,
// unlabeled). Rewritten so every card is a real 3-number equation — 已知數字 + 落差項 = 結果數字
// — with the explanatory paragraph moved to AFTER (below) the whole equation instead of sitting
// between the two original rows. Each card's 結果 continues as the next card's 已知，so the chain
// still reads top-to-bottom as one connected story:
//   Card 1　股利 ＋ 留存現金（未發放）＝ 自由現金流
//   Card 2　自由現金流 ＋ 資本支出 ＝ 營業現金流（OCF）
//   Card 3　每股盈餘（EPS）＋ 非現金與營運資金調整 ＝ 營業現金流（OCF）
// 落差項一律用 formatSignedAmount 帶正負號顯示（該項理論上可能是負值，例如某期資本支出異常低、
// 留存現金為負），不是先取絕對值硬套「＋」符號。
//
// 每張卡片的「已知」數字延續上一張卡片的「結果」數字（FCF 同時是 Card 1 的答案跟 Card 2 的已知
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
// this audience. A plain equation per card, explained in prose below it, needs none of that.
//
// Compliance boundary respected (design brief's own 2.0 §4.6.3 刪形容詞測試): every row is a bare
// fact (number + neutral label), no evaluative conclusion synthesized from comparing them (e.g.
// never "配息穩健" or similar) — presenting the numbers is fine, concluding FROM them isn't; that
// judgment call is left to the viewer.
//
// 第 4 張卡片「法定盈餘公積」— 2026-09-18 直接要求的延伸（"可以多拆好幾步驟，說明甚麼是 法定盈餘
// 公積"），回答"留存現金裡，有一部分是公司自己選擇不發、還是法律規定不能發？"這個問題。查過
// analysis-ts 的 /metrics 目錄（搜尋「公積」「reserve」「盈餘」「retained」）確認目前沒有任何
// 欄位對應法定盈餘公積本身的實際提列金額或累積餘額，所以這張卡片刻意不比照前 3 張做成帶真實數字
// 的算式（沒有真數字可以放、湊會計年度總額用每股數字反推也會失真），改成純文字、分步驟說明公司法
// 第 237 條的規則本身——這是一條法律事實，不是對這檔股票的評論或判斷，講清楚規則跟前 3 張卡片一樣
// 屬於客觀陳述，不牴觸「不下結論」的紅線。之後 analysis-ts 若補上對應欄位，可以再補一張帶真數字
// 的算式卡片，銜接這裡。
const DIVIDEND_FCF_INFO_TEXT = '股利實際上是從公司可動用的現金支付，不是從帳上的獲利數字直接支付——這裡直接比較股利與自由現金流，不是先比對帳上獲利（EPS）'
const FCF_OCF_INFO_TEXT = '自由現金流＝營業現金流－資本支出。資本支出是維持或擴張生意所需的投資，不能拿來發股利'
const OCF_EPS_INFO_TEXT = 'EPS 是會計淨利，包含折舊攤銷等非現金項目；營業現金流是實際收付的現金——兩者概念不同，數字通常也不會完全相等'
const LEGAL_RESERVE_INFO_TEXT = '公司法規定，稅後盈餘要先強制提撥一部分，不能全部發給股東'

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

const retainedCash = computed<number | null>(() => (fcfPerShare.value !== null && dividendPerShare.value !== null) ? fcfPerShare.value - dividendPerShare.value : null)
const capex = computed<number | null>(() => (ocfPerShare.value !== null && fcfPerShare.value !== null) ? ocfPerShare.value - fcfPerShare.value : null)
const nonCashAdjustment = computed<number | null>(() => (ocfPerShare.value !== null && eps.value !== null) ? ocfPerShare.value - eps.value : null)

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number } | null): string | null {
  return entry ? `${entry.fiscalYear} Q${entry.fiscalQuarter}` : null
}

function formatAmount(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)} 元`
}

// 落差項一律帶正負號顯示（可能是負值），不是先取絕對值再套死板的「＋」符號。
function formatSignedAmount(value: number | null): string {
  if (value === null) return '—'
  const sign = value >= 0 ? '＋' : '－'
  return `${sign} ${Math.abs(value).toFixed(2)} 元`
}
</script>

<template>
  <el-card class="dividend-cash-chain-card" shadow="never">
    <template #header>
      <div class="dividend-cash-chain-card__header">
        <StockCardTitle title="股息撐得住嗎？" :info-text="DIVIDEND_FCF_INFO_TEXT" />
      </div>
    </template>

    <el-empty v-if="!cashChainHistory.pending.value && !hasDividendFcfData" description="這檔股票尚無配息相關資料" :image-size="64" />
    <div v-else v-loading="cashChainHistory.pending.value">
      <div class="dividend-cash-chain-card__equation">
        <div class="dividend-cash-chain-card__eq-row">
          <span class="dividend-cash-chain-card__eq-label">每股股利</span>
          <span class="dividend-cash-chain-card__eq-value">{{ formatAmount(dividendPerShare) }}</span>
        </div>
        <div class="dividend-cash-chain-card__eq-row">
          <span class="dividend-cash-chain-card__eq-label">留存現金</span>
          <span class="dividend-cash-chain-card__eq-value">{{ formatSignedAmount(retainedCash) }}</span>
        </div>
        <div class="dividend-cash-chain-card__eq-divider" />
        <div class="dividend-cash-chain-card__eq-row dividend-cash-chain-card__eq-row--result">
          <span class="dividend-cash-chain-card__eq-label">＝ 每股自由現金流</span>
          <span class="dividend-cash-chain-card__eq-value">{{ formatAmount(fcfPerShare) }}</span>
        </div>
      </div>
      <p class="dividend-cash-chain-card__explanation">股利是從公司可動用的現金支付，不是從帳上獲利數字直接支付。把股利跟「留存的現金」加起來，就是公司這期自由現金流的全部去處。</p>
    </div>

    <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="periodLabel(latestEntry)" />
  </el-card>

  <el-card class="dividend-cash-chain-card" shadow="never">
    <template #header>
      <div class="dividend-cash-chain-card__header">
        <StockCardTitle title="自由現金流從哪裡來？" :info-text="FCF_OCF_INFO_TEXT" />
      </div>
    </template>

    <el-empty v-if="!cashChainHistory.pending.value && !hasFcfOcfData" description="這檔股票尚無現金流相關資料" :image-size="64" />
    <div v-else v-loading="cashChainHistory.pending.value">
      <div class="dividend-cash-chain-card__equation">
        <div class="dividend-cash-chain-card__eq-row">
          <span class="dividend-cash-chain-card__eq-label">每股自由現金流</span>
          <span class="dividend-cash-chain-card__eq-value">{{ formatAmount(fcfPerShare) }}</span>
        </div>
        <div class="dividend-cash-chain-card__eq-row">
          <span class="dividend-cash-chain-card__eq-label">資本支出</span>
          <span class="dividend-cash-chain-card__eq-value">{{ formatSignedAmount(capex) }}</span>
        </div>
        <div class="dividend-cash-chain-card__eq-divider" />
        <div class="dividend-cash-chain-card__eq-row dividend-cash-chain-card__eq-row--result">
          <span class="dividend-cash-chain-card__eq-label">＝ 每股營業現金流</span>
          <span class="dividend-cash-chain-card__eq-value">{{ formatAmount(ocfPerShare) }}</span>
        </div>
      </div>
      <p class="dividend-cash-chain-card__explanation">公司本業收到的現金，先扣掉維持或擴張生意所需的資本支出，剩下的才是自由現金流——資本支出不能拿來發股利。</p>
    </div>

    <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="periodLabel(latestEntry)" />
  </el-card>

  <el-card class="dividend-cash-chain-card" shadow="never">
    <template #header>
      <div class="dividend-cash-chain-card__header">
        <StockCardTitle title="營業現金流跟帳上的獲利一樣嗎？" :info-text="OCF_EPS_INFO_TEXT" />
      </div>
    </template>

    <el-empty v-if="!cashChainHistory.pending.value && !hasOcfEpsData" description="這檔股票尚無獲利相關資料" :image-size="64" />
    <div v-else v-loading="cashChainHistory.pending.value">
      <div class="dividend-cash-chain-card__equation">
        <div class="dividend-cash-chain-card__eq-row">
          <span class="dividend-cash-chain-card__eq-label">每股盈餘（EPS）</span>
          <span class="dividend-cash-chain-card__eq-value">{{ formatAmount(eps) }}</span>
        </div>
        <div class="dividend-cash-chain-card__eq-row">
          <span class="dividend-cash-chain-card__eq-label">非現金調整</span>
          <span class="dividend-cash-chain-card__eq-value">{{ formatSignedAmount(nonCashAdjustment) }}</span>
        </div>
        <div class="dividend-cash-chain-card__eq-divider" />
        <div class="dividend-cash-chain-card__eq-row dividend-cash-chain-card__eq-row--result">
          <span class="dividend-cash-chain-card__eq-label">＝ 每股營業現金流</span>
          <span class="dividend-cash-chain-card__eq-value">{{ formatAmount(ocfPerShare) }}</span>
        </div>
      </div>
      <p class="dividend-cash-chain-card__explanation">EPS 是會計淨利，含折舊攤銷等非現金項目；把這些非現金項目跟營運資金變動加回去，才會得到實際收付的現金（營業現金流）。</p>
    </div>

    <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="periodLabel(latestEntry)" />
  </el-card>

  <el-card class="dividend-cash-chain-card" shadow="never">
    <template #header>
      <div class="dividend-cash-chain-card__header">
        <StockCardTitle title="留存的現金，全部都能自由分配嗎？" :info-text="LEGAL_RESERVE_INFO_TEXT" />
      </div>
    </template>

    <div class="dividend-cash-chain-card__legal-steps">
      <div class="dividend-cash-chain-card__legal-step">
        <span class="dividend-cash-chain-card__legal-step-index">1</span>
        <p class="dividend-cash-chain-card__legal-step-text">公司法第 237 條規定：公司完納稅捐後，分派盈餘前，要先提撥至少 10% 作為「法定盈餘公積」——這是法律要求，不是公司自己選擇要不要留。</p>
      </div>
      <div class="dividend-cash-chain-card__legal-step">
        <span class="dividend-cash-chain-card__legal-step-index">2</span>
        <p class="dividend-cash-chain-card__legal-step-text">這筆提撥會一年一年累積，直到累積金額達到公司的資本額為止；達到之後，才不用再繼續提撥。</p>
      </div>
      <div class="dividend-cash-chain-card__legal-step">
        <span class="dividend-cash-chain-card__legal-step-index">3</span>
        <p class="dividend-cash-chain-card__legal-step-text">換句話說，前面卡片裡「留存的現金」不是全部都由公司自由決定去留——法定盈餘公積是其中一定會被留下來的部分，跟公司自己為了成長、還債等原因選擇留下的現金，性質不同。</p>
      </div>
    </div>
    <p class="dividend-cash-chain-card__explanation dividend-cash-chain-card__explanation--note">這裡說明的是公司法規則本身，這檔股票實際提撥、累積了多少法定盈餘公積，目前站上尚無對應資料可顯示。</p>
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

.dividend-cash-chain-card__equation {
  display: flex;
  flex-direction: column;
}

.dividend-cash-chain-card__eq-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
}

.dividend-cash-chain-card__eq-row--result {
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dividend-cash-chain-card__eq-divider {
  margin: 0 16px;
  border-top: 1px solid var(--el-border-color);
}

.dividend-cash-chain-card__eq-label {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.dividend-cash-chain-card__eq-row--result .dividend-cash-chain-card__eq-label {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.dividend-cash-chain-card__eq-value {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* 說明文字移到整條算式後面，不再夾在兩個數字中間——2026-09-18 per直接要求。 */
.dividend-cash-chain-card__explanation {
  margin: 12px 16px 0;
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

.dividend-cash-chain-card__explanation--note {
  margin-top: 16px;
  font-size: 0.875rem;
}

.dividend-cash-chain-card__legal-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dividend-cash-chain-card__legal-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dividend-cash-chain-card__legal-step-index {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: var(--el-color-white);
  font-size: 0.875rem;
  font-weight: 700;
}

.dividend-cash-chain-card__legal-step-text {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}
</style>
