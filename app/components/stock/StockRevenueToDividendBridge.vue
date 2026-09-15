<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryTimeframe } from '~/composables/stock/useMetricsHistory'
import type { BridgeStage } from '~/components/shared/SharedBridgeChart.vue'

// 「營收到股利，錢去了哪裡」— 置底大區塊，跟公司基本資訊一樣不隨分頁切換、不屬於任何一個卡片軌
// (2026-09-15 per一連串直接要求：先是"逐級拆解營收怎麼變成自由現金流嗎？"，範圍擴大到"營收怎麼
// 一步一步變成股利"，版位"公司基本資訊的上面"；接著"還要加上支出項目。比如成本？"、"視覺上就可以
// 看出 營收 - 進貨成本 = 毛利"、"圖表上也可以看出哪兩條 相加 會等於營收" — 從單純 7 個階段的長條
// 圖，逐步加上兩階段之間的落差列，變成真正的懸浮瀑布圖)。實際的懸浮瀑布圖畫法已抽到
// SharedBridgeChart.vue（見那個檔案自己的說明），這個檔案只留領域邏輯：抓哪些 metricCode、
// 怎麼組出每個階段的金額、卡片外殼。
//
// 7 個「階段」全部固定用近四季(TTM)——原本設計成單季/近四季可切換，右上角切換鈕，但股利這一步
// 天生只有 TTM 概念（盈餘發放率後端沒有 Q 欄位，股利是年度政策，沒有「這一季的股利」這回事），
// 導致單季模式下要嘛拿 1 季的現金流硬接近四季的股利（時間尺度差 4 倍，湊出來的保留盈餘沒有意義
// ——真的被直接質疑："為什麼保留盈餘 + 每股自由現金流變成股利？確定沒算錯嗎"，答案是設計本身有
// 問題，不是算錯），要嘛主鏈跟股利段各自獨立不相連。per直接要求（"移除單季。只保留近四季 這樣
// 才合理"）整個拿掉這個切換，全部固定 TTM，一次 useMetricsHistory 呼叫就夠。
//
// 每股營收 → 毛利率 → 每股毛利 → 營業利益率 → 每股營業利益 → 每股稅前淨利 → EPS(稅後淨利) →
// 稅後淨利＋折舊攤銷 → 每股營業現金流 → 每股自由現金流 → (盈餘發放率) → 每股股利。9 個階段、
// 8 段落差，見下方 stages/GAP_LABELS 的建構邏輯（其中折舊攤銷加回那一段常常是負值，代表這一
// 步其實比上一步「多」）。
//
// 「留存現金（未發放）」故意不叫「保留盈餘」— 2026-09-15 讀過 oingg-conductor-ts 的研究文件
// 《企業營收轉化為股利的資本路徑與流動性約束》後修正：正式會計上的「保留盈餘」是資產負債表上
// 的累積數字，年度增量＝稅後淨利－股利，是用淨利算的；這裡這一列算的是「自由現金流－股利」，
// 概念上完全不同（且更貼近公司實際銀行帳戶裡剩多少），用「保留盈餘」這個詞會誤導有會計背景
// 的使用者以為兩者是同一個數字。
//
// 兩個原本混合湊出來的落差桶，2026-09-15 拆開成精確項目 — analysis-ts 應規格請求新增了
// pretaxIncomePerShare（每股稅前淨利）跟 depreciationAmortizationPerShare（每股折舊攤銷），
// 都是 TTM 欄位，直接插進主鏈當獨立階段，不用再用比率去湊：
//   - 原本「業外損益及所得稅」一個桶 → 拆成 每股稅前淨利 這個新階段，兩側落差分別是「業外損益」
//     （營業利益→稅前淨利）跟「所得稅費用」（稅前淨利→稅後淨利）。
//   - 原本「非現金費用調整」一個桶（混了折舊攤銷跟營運資金變動兩種完全不同性質的東西）→ 拆成
//     「稅後淨利＋折舊攤銷」這個新階段（不是正式財報科目，純粹是這條鏈上的一個中繼點），兩側
//     落差分別是「折舊攤銷加回」（稅後淨利→這個中繼點，直接讀 depreciationAmortizationPerShare
//     本身，不是相減湊出來的）跟「營運資金變動」（中繼點→營業現金流，扣掉已知的折舊攤銷之後
//     剩下的部分，才是真正的營運資金變動）。
const props = defineProps<{
  symbol: string
}>()

const INFO_TEXT = '呈現營收經過各階段扣除後，最終轉換為股利的金額變化過程；每階段的落差反映該階段特有的成本或調整項目'

const symbolRef = computed(() => props.symbol)

const BRIDGE_CODES = [
  'revenuePerShare',
  'grossMargin',
  'operatingMargin',
  'pretaxIncomePerShare',
  'eps',
  'depreciationAmortizationPerShare',
  'ocfPerShare',
  'fcfPerShare',
  'dividendPayoutRatio'
]
const bridgeHistory = useMetricsHistory(symbolRef, ref(BRIDGE_CODES), ref<MetricsHistoryTimeframe>('TTM'), ref(1))

// 金融業版本 2026-09-15 per直接要求（"也要做一個金融業版本"），規格跟 analysis-ts 確認過（見
// analysis-ts 自己的回覆：鏈結構「利息淨收益＋非利息淨收益－呆帳費用及保證責任準備－其他營業
// 費用＝稅前淨利」已用真實資料 2801 交叉驗證過恆等式吻合；ocf/fcf 對銀行業沒有意義——2801實測
// OCF=-6.54但EPS/稅前淨利都正常為正，反映的是存款/放款資金進出，不是獲利能力，鏈到EPS後直接轉
// 向股利，不接ocf/fcf）。只多抓這 4 支銀行專屬欄位，稅前淨利/EPS/股利發放率沿用上面
// BRIDGE_CODES 已經抓到的（沒有重複抓）。
const BANK_BRIDGE_CODES = [
  'bankNetInterestIncomePerShare',
  'bankNetNonInterestIncomePerShare',
  'bankBadDebtProvisionPerShare',
  'bankOtherOperatingExpensePerShare'
]
const bankBridgeHistory = useMetricsHistory(symbolRef, ref(BANK_BRIDGE_CODES), ref<MetricsHistoryTimeframe>('TTM'), ref(1))

const pending = computed(() => bridgeHistory.pending.value || bankBridgeHistory.pending.value)

const latestBridgeEntry = computed(() => bridgeHistory.data.value?.at(-1) ?? null)
const latestBankBridgeEntry = computed(() => bankBridgeHistory.data.value?.at(-1) ?? null)

// 銀行專屬欄位對非銀行公司回應「值本身就是 null」（不是 nullReason 物件——見
// useMetricsHistory.ts 自己對 MetricsHistoryPoint | null 的註解），跟徽章系統判斷 Basel III
// 是否適用同一種「回應裡有沒有這筆資料」的偵測方式，不用額外維護一份產業分類清單。
const isBank = computed(() => latestBankBridgeEntry.value?.values.bankNetInterestIncomePerShare != null)

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number } | null): string | null {
  return entry ? `${entry.fiscalYear} Q${entry.fiscalQuarter}` : null
}

const genericStages = computed<BridgeStage[]>(() => {
  const bridge = latestBridgeEntry.value

  const revenue = bridge?.values.revenuePerShare?.value ?? null
  const grossMargin = bridge?.values.grossMargin?.value ?? null
  const operatingMargin = bridge?.values.operatingMargin?.value ?? null
  const pretaxIncome = bridge?.values.pretaxIncomePerShare?.value ?? null
  const eps = bridge?.values.eps?.value ?? null
  const depreciationAmortization = bridge?.values.depreciationAmortizationPerShare?.value ?? null
  const ocf = bridge?.values.ocfPerShare?.value ?? null
  const fcf = bridge?.values.fcfPerShare?.value ?? null
  const payoutRatio = bridge?.values.dividendPayoutRatio?.value ?? null

  const grossProfit = revenue !== null && grossMargin !== null ? revenue * (grossMargin / 100) : null
  const operatingIncome = revenue !== null && operatingMargin !== null ? revenue * (operatingMargin / 100) : null
  const epsPlusDA = eps !== null && depreciationAmortization !== null ? eps + depreciationAmortization : null
  const dividendPerShare = eps !== null && payoutRatio !== null ? eps * (payoutRatio / 100) : null

  return [
    { label: '每股營收', value: revenue },
    { label: '每股毛利', value: grossProfit },
    { label: '每股營業利益', value: operatingIncome },
    { label: '每股稅前淨利', value: pretaxIncome },
    { label: '每股稅後淨利', value: eps },
    { label: '每股稅後淨利＋折舊攤銷', value: epsPlusDA },
    { label: '每股營業現金流', value: ocf },
    { label: '每股自由現金流', value: fcf },
    { label: '每股股利', value: dividendPerShare }
  ]
})

const bankStages = computed<BridgeStage[]>(() => {
  const bridge = latestBridgeEntry.value
  const bank = latestBankBridgeEntry.value

  const netInterestIncome = bank?.values.bankNetInterestIncomePerShare?.value ?? null
  const nonInterestIncome = bank?.values.bankNetNonInterestIncomePerShare?.value ?? null
  const badDebtProvision = bank?.values.bankBadDebtProvisionPerShare?.value ?? null
  const otherOperatingExpense = bank?.values.bankOtherOperatingExpensePerShare?.value ?? null
  const pretaxIncome = bridge?.values.pretaxIncomePerShare?.value ?? null
  const eps = bridge?.values.eps?.value ?? null
  const payoutRatio = bridge?.values.dividendPayoutRatio?.value ?? null

  const totalIncome = netInterestIncome !== null && nonInterestIncome !== null ? netInterestIncome + nonInterestIncome : null
  const afterBadDebt = totalIncome !== null && badDebtProvision !== null ? totalIncome - badDebtProvision : null
  const dividendPerShare = eps !== null && payoutRatio !== null ? eps * (payoutRatio / 100) : null

  return [
    { label: '每股利息淨收益', value: netInterestIncome },
    { label: '利息＋非利息淨收益', value: totalIncome },
    { label: '扣除呆帳費用後', value: afterBadDebt },
    // 直接用後端的 pretaxIncomePerShare（不是拿 afterBadDebt 再減一次其他營業費用湊出來）
    // ——analysis-ts 已用 2801 交叉驗證這條鏈的恆等式吻合，直接讀權威欄位比自己再算一次更準。
    { label: '每股稅前淨利', value: pretaxIncome },
    { label: '每股稅後淨利', value: eps },
    { label: '每股股利', value: dividendPerShare }
  ]
})

const stages = computed<BridgeStage[]>(() => (isBank.value ? bankStages.value : genericStages.value))

// 兩個相鄰階段之間「扣了什麼/加了什麼」的標籤 — 對齊 stages 陣列相鄰兩項之間的落差
// （GAP_LABELS[i] 是 stages[i] 到 stages[i+1] 之間的落差）。
const GENERIC_GAP_LABELS = ['營業成本', '營業費用', '業外損益', '所得稅費用', '折舊攤銷加回', '營運資金變動', '資本支出', '留存現金（未發放）']
// 最後一段刻意用「保留盈餘」（不是通用版本的「留存現金」）——這裡是真的稅後淨利－股利，跟正式
// 會計上保留盈餘的年度增量定義完全一致（見上面通用版本自己的說明：那邊用「留存現金」是因為算的
// 是自由現金流－股利，概念不同）；銀行版本沒有現金流階段可用，EPS 直接轉向股利，這裡就是名符
// 其實的保留盈餘。
const BANK_GAP_LABELS = ['非利息淨收益', '呆帳費用及保證責任準備', '其他營業費用', '所得稅費用', '保留盈餘（未發放）']
const GAP_LABELS = computed(() => (isBank.value ? BANK_GAP_LABELS : GENERIC_GAP_LABELS))

function formatAmount(value: number): string {
  return `${value.toFixed(2)} 元`
}
</script>

<template>
  <el-card class="revenue-to-dividend-bridge" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="revenue-to-dividend-bridge__header">
        <span class="revenue-to-dividend-bridge__title">
          營收到股利，錢去了哪裡
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="revenue-to-dividend-bridge__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>

    <SharedBridgeChart :stages="stages" :gap-labels="GAP_LABELS" :format-value="formatAmount" :loading="pending" highlight-last-stage />
    <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="periodLabel(latestBridgeEntry)" />
  </el-card>
</template>

<style scoped>
.revenue-to-dividend-bridge {
  border-radius: 12px;
}

.revenue-to-dividend-bridge__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.revenue-to-dividend-bridge__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.revenue-to-dividend-bridge__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}
</style>
