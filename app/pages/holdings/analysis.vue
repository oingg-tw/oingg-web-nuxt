<script setup lang="ts">
import type { MarketDirectory } from '#shared/types/hub'
import type { HoldingsTraitsResult } from '~/utils/holdings-traits'

// 持股分析（2026-10-05）。使用者：「希望持股分析獨立出來一個 sidebar，這樣就可以評估產業占比。持股總覽那邊就可以
// 簡化 UIUX。跟占比分析有關的塞進新的功能。」
// 2026-10-19 使用者：「holdings/analysis 保留產業分析就好」——個股占比、持股的整體估值（本益比／股價淨值比）、上方一排數字卡都拿掉，
// 只剩產業占比：問句 → 答句 → 圖 → 表（站上的規矩，圖之後是同樣資料的表格，圖不是唯一的資料路徑）。只陳述占比，不說集中是好是壞
// （投信投顧法）。同日稍晚加回第二段「這組持股有什麼特色？」（加權的本益比、Beta、ROE…加大盤對照與標籤，分享時可以一起帶出去），
// 那一段的畫法在 HoldingsTraits、規則在 utils/holdings-traits.ts。
//
// 產業用證交所類股，資料是全市場目錄 /api/hub/directory（Nitro 每天快取一次，個股總表用同一份）。
//
// Personal page: out of the index and the sitemap (/holdings/**).
useSeoMeta({ title: '持股分析', robots: 'noindex, nofollow' })

const authResolved = useAuthResolved()
const { holdings, pending, loadFailed, market, load, ensureLoaded, clear, fetchTraits } = useHoldings()
// 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog，2026-10-08），畫面上不再各自出訊息
watchLoadFailure('holdings', () => loadFailed.value, load)
// 產業分類整個 session 留著（2026-10-20）：Nuxt 4 在最後一個用到它的元件卸載時清掉 useFetch 的資料，側欄切回來要等重抓，先轉圈兩個畫面
//（check-reload-flash 量到的）。有自訂 getCachedData 就不清，回來直接用手上那份。key 不跟個股總表共用：它用預設的 getCachedData，
// 同一個 key 兩種選項 Nuxt 會警告（而且被清掉的資料本來就共用不到）
const { data: directory, status: directoryStatus } = useFetch<MarketDirectory>('/api/hub/directory', {
  key: 'holdings-directory',
  lazy: true,
  server: false,
  getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key]
})

const sectorBySymbol = computed(() => {
  const map = new Map<string, string>()
  for (const sector of directory.value?.sectors ?? []) for (const company of sector.companies) map.set(company.symbol, sector.name)
  return map
})

const rows = computed(() => holdings.value.map((holding) => {
  const quote = market.value[holding.symbol]
  const figures = holdingRowFigures({ quantity: holding.quantity, costUnknownQuantity: holding.costUnknownQuantity, averageCost: holding.averageCost, price: quote?.price, dividendPerShare: quote?.dividendPerShare })
  return { sector: directory.value ? sectorOfSymbol(holding.symbol, sectorBySymbol.value) : null, marketValue: figures.marketValue }
}))

const totalValue = computed(() => rows.value.reduce((sum, row) => sum + (row.marketValue ?? 0), 0))
const unpricedCount = computed(() => rows.value.filter(row => row.marketValue === null).length)

const sectors = computed(() => groupByLabel(rows.value.map(row => ({ label: row.sector ?? '其他', value: row.marketValue }))))

// 表格用 HoldingsMetricTable（2026-10-07 a11y／mobile 盤點：el-table 在手機上把「市值」「占比」推到畫面外，
// 而那兩欄正是這頁的重點）。窄的時候每一列是一張小卡片，寬的時候是表格。
const sectorTableRows = computed(() => sectors.value.map(sector => ({
  name: sector.label,
  value: percent(sector.value / totalValue.value),
  market: `${holdingsMoney(sector.value)} 元`,
  meaning: `${sector.count} 檔`
})))
// 骨架的列數＝上次看到的產業數（useLayoutHint），資料到了下面的面板才不會被推動或拉上來；範例字讓欄寬跟真的表一樣
const sectorCountHint = useLayoutHint('analysis-sectors', 5)
// 產業名稱 2～8 個字：欄寬固定，不然名稱長短一變表頭就左右移
const SECTOR_COLUMN_WIDTHS = ['32%', '20%', '30%', '18%']
const skeletonSectorRows = computed(() => Array.from({ length: sectorCountHint.value }, () => ({ skeleton: true, name: '半導體業', value: '49.6%', market: '721,500 元', meaning: '1 檔' })))

function percent(value: number | null, digits = 1): string {
  return value === null ? '－' : `${(value * 100).toFixed(digits)}%`
}

// 答句：幾檔持股、分布在幾個產業、最大的是哪一個
const answer = computed(() => {
  const top = sectors.value[0]
  if (!top || totalValue.value <= 0) return ''
  return `${rows.value.length} 檔持股分布在 ${sectors.value.length} 個產業，占比最大的是${top.label}（${percent(top.value / totalValue.value)}）。`
})

// 有效產業數：依市值，相當於平均分散在幾個產業＝1 ÷ Σ產業占比²（跟業務中台 risk.sectors.effectiveSectors 同一個定義）。
// 用上面表格同一份占比在這裡算（2026-10-20）：原本等風險端點（回推一年股價，慢），答句晚一兩秒才多長出這半句（使用者：「重新整理的
// 時候會閃動」）；在這裡算也保證跟表格的產業分法一致
const effectiveSectorsText = computed(() => {
  if (totalValue.value <= 0) return ''
  const hhi = sectors.value.reduce((sum, sector) => sum + (sector.value / totalValue.value) ** 2, 0)
  return hhi > 0 ? `依市值，相當於平均分散在 ${(1 / hhi).toFixed(1)} 個產業。` : ''
})

// 持股特色（2026-10-19，使用者：「PER、BETA、ROE…有些是低 Beta、有些是景氣循環專精，分享的時候可以一起帶出去」）：
// 業務中台 算好的加權數字＋大盤對照，產業之後一段（HoldingsTraits，分享頁共用）。讀不到交給全站彈窗，只影響這一段
const traits = ref<HoldingsTraitsResult | null>(null)
const traitsFailed = ref(false)
async function loadTraits() {
  const result = await fetchTraits()
  traits.value = result
  traitsFailed.value = result === null
}
watchLoadFailure('holdings-traits', () => traitsFailed.value, () => loadTraits(), { scope: 'section' })
// 持股、產業分類、特色到齊才一起畫（2026-10-20，使用者：「卡片的部分顯示閃動」）：特色晚到的話，產業那段先畫好、特色的面板才從下面
// 長出來；產業分類晚到（DEV 縮到 0 之後的冷快取）則是先寫「產業分類載入中…」，圖表再把特色往下推。讀不到的不等，交給全站彈窗。
// 產業分類只等「還沒有」：側欄切過來時 useFetch 會重抓（status 是 pending），手上那份照用
const firstPaintPending = computed(() => (pending.value && !holdings.value.length)
  || (holdings.value.length > 0 && ((!traits.value && !traitsFailed.value) || (!directory.value && directoryStatus.value === 'pending'))))
watch(sectorTableRows, (rows) => {
  if (rows.length && !firstPaintPending.value) sectorCountHint.value = rows.length
})

// 誰＋哪個帳戶（2026-10-19）：換帳戶就跟換人一樣重新載入
const { holdingsScope } = useHoldingsPortfolios()
watch([authResolved, holdingsScope], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) {
    ensureLoaded()
    // 上一個帳戶的特色不留著，免得先畫舊的再換
    traits.value = null
    traitsFailed.value = false
    loadTraits()
  } else {
    clear()
    traits.value = null
  }
}, { immediate: true })
</script>

<template>
  <HoldingsPageShell title="持股分析" subtitle="依市值看資金分布在哪些產業，以及這組持股的量化特色" guest-title="登入後查看你的持股分析" :pending="firstPaintPending">

    <template #default="{ loading }">
      <!-- 讀不到：彈窗會說明並自動重讀；留空佔住這一支，免得落到下面的「還沒有持股」 -->
      <template v-if="loadFailed" />

      <el-empty v-else-if="!loading && !holdings.length" description="還沒有記錄任何持股，先到持股總覽記一筆交易或匯入成交明細" :image-size="64" />

      <!-- 讀的時候問句、表頭、註腳照畫，答句、圖、表格的列是同樣大小的骨架（2026-10-20） -->
      <div v-else class="analysis-page__sections">
        <section aria-labelledby="analysis-sector-title" :aria-busy="loading">
          <h2 id="analysis-sector-title" class="analysis-page__section-title">資金分布在哪些產業？</h2>
          <template v-if="loading">
            <p class="analysis-page__answer"><span class="app-skeleton app-skeleton--flow" aria-hidden="true">6 檔持股分布在 6 個產業，占比最大的是半導體業（49.6%）。依市值，相當於平均分散在 3.3 個產業。</span></p>
            <HoldingsAllocationChart title="產業占比" :items="[]" loading />
            <HoldingsMetricTable caption="各產業的市值與占比" :rows="skeletonSectorRows" name-label="產業" value-label="占比" market-label="市值" meaning-label="檔數" :widths="SECTOR_COLUMN_WIDTHS" loading />
          </template>
          <p v-else-if="!directory" class="analysis-page__note">產業分類載入中…</p>
          <template v-else>
            <p v-if="answer" class="analysis-page__answer">{{ answer }}<template v-if="effectiveSectorsText">{{ effectiveSectorsText }}</template></p>
            <p v-if="unpricedCount" class="analysis-page__note">{{ unpricedCount }} 檔目前沒有報價，未計入占比。</p>
            <HoldingsAllocationChart title="產業占比" :items="sectors.map(sector => ({ label: sector.label, value: sector.value }))" />
            <HoldingsMetricTable caption="各產業的市值與占比" :rows="sectorTableRows" name-label="產業" value-label="占比" market-label="市值" meaning-label="檔數" :widths="SECTOR_COLUMN_WIDTHS" />
          </template>
          <p class="analysis-page__footnote">產業是證交所與櫃買中心的類股分類。ETF 自成一類；特別股歸到發行公司的產業。占比＝市值 ÷ 總市值，以最新收盤價計算。</p>
        </section>

        <HoldingsTraits v-if="loading || traits" :traits="loading ? null : traits" heading-id="analysis-traits-title" />
      </div>
    </template>
  </HoldingsPageShell>
</template>

<style scoped>
.analysis-page__sections {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.analysis-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.analysis-page__answer {
  margin: 0 0 12px;
}

.analysis-page__note {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

.analysis-page__footnote {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
