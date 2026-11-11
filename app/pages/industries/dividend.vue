<script setup lang="ts">
import { use } from 'echarts/core'
import { ScatterChart } from 'echarts/charts'
import { LabelLayout } from 'echarts/features'
import type { HubSector, SectorDividendSummaryPageData } from '#shared/types/hub'
// 產業追蹤 — RETIRED the supply-chain tree 2026-09-20: analysis-ts hard-deleted GET
// /industries/chain-tree (and chain-clusters, chain-classification) with no replacement (commit
// a7489d65, a compliance call). What was left was a search box over the 36 sector names plus a
// chip list, which materially overlapped /stock's own sector table — flagged then for a follow-up.
//
// 2026-09-30 這一頁變成**產業索引**（「menubar 要有地方可以選產業…點下去以後，才攤開每個產業的
// 統計資料」「會有一個頁面作為各個產業的索引」）：一張散佈圖把 34 個類股放在同一個座標上，底下
// 一張逐類股的數字表。跟 /stock 的重疊也解掉了——那一頁是「哪些公司屬於哪個類股」的目錄，這一頁
// 是「這些類股的股利長什麼樣」。
//
// 未註冊的 ECharts 系列型別不會丟錯，只是靜靜不畫（本站踩過），所以 ScatterChart 要顯式註冊。

// 散佈圖只有產業頁用，自己註冊（SharedChart 只註冊共用的零件）。LabelLayout 是標籤避讓（labelLayout）的必要功能。
use([ScatterChart, LabelLayout])

// 產業索引先隱藏（2026-11-09，使用者：「產業索引隱藏。把產業殖利率當作產業索引預設畫面，URL不變化」）：/industries 直接畫這一頁、網址不導走，
// 標準網址照這一頁，兩個網址不算兩份內容。原本的產業索引在 overview.vue。用別名而不是另一個頁面檔 import 這一頁：被兩處引用的頁面併進共用
// chunk、建置清單裡沒有這一頁，伺服器就沒輸出它要的 Element Plus 樣式，卡片的框線與內距等 JS 到了才出現，下面整段往下推 42px（2026-11-11 量到）
definePageMeta({ alias: '/industries' })

const requestUrl = useRequestURL()
useSeoMeta({
  title: '台股類股殖利率分析：34 個證交所類股的股利地圖',
  description: '證交所 34 個類股的殖利率中位數與持股股利 5 年成長率中位數畫在同一張圖上，點的大小代表家數；樣本少於 5 家的類股不畫，數字另附於產業索引頁。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/industries/dividend` }] })

const { data: sectors } = await useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] })
const { data: summary, error: summaryError } = await useFetch<SectorDividendSummaryPageData | null>('/api/hub/sector-dividend-summary', {
  key: 'hub-sector-dividend-summary',
  default: () => null
})
// 讀不到回 503（2026-10-11，照其他 hub 頁的規則）：搜尋引擎要拿到暫時錯誤，不是一頁空白的 200
if (summaryError.value) throw createError({ statusCode: 503, statusMessage: '類股股利統計資料暫時無法取得', fatal: true })

// **兩軸都用中位數**（2026-09-30 使用者拍板）。原本 Y 軸指定用平均，我提的論點被接受了：一個點的
// Y 是平均、X 是中位數解釋起來不漂亮，而成長率那一軸非用中位數不可——34 個類股裡有 8 個的 mean
// 與 median 正負號相反（食品、電機機械、建材營造、電腦及週邊設備、電子零組件、其他電子、文化創意、
// 運動休閒），而正負號就是那個軸在講的整句話。mean 欄位業務中台 138bc66 拿掉了（2026-11-09），要換回去得先跟上游要。
//
// **殖利率含不配息的公司（0% 算進去）**，2026-09-30 改的。證交所從 2026-08-28 起把沒配息的公司
// 從 0.00 改成空白，使用者決定那之後的空白一律當 0，於是上市與上櫃的寫法一致了。所以文案**不能**
// 再寫「配息公司的平均」——實測 34 個類股裡有 31 個的殖利率 count 已經等於 companyCount，而造紙
// 工業的中位數是 0（過半公司不配息），那個 0 是真的不是缺值。
const MIN_SAMPLE = 5
const yieldText = (value: number | null): string => (value === null ? '－' : `${value.toFixed(2)}%`)
const growthText = (value: number | null): string => (value === null ? '－' : minusSign(`${value.toFixed(1)}%`))

const rows = computed(() => summary.value?.sectors ?? [])

// 任一軸 n < 5 就不畫（analysis-ts 建議，業務中台 建議 10）。取 5 的理由與取捨都是量出來的：
// n≥5 留 30 個、n≥10 留 24、n≥20 留 19、n≥30 留 13。5 保住 30 個類股，而低樣本的點用點大小
// 明顯地弱化，而不是讓 2 家公司的點看起來跟 161 家一樣可信——那是 業務中台 的顧慮，點大小處理掉了。
//
// **5 是判斷不是有出處的統計標準**（analysis-ts 自己標註的）：n<5 時中位數只要一家公司變動就會
// 大幅位移，平均更敏感。門檻放前端常數，API 不加 plottable 欄位，要調就改這裡。
const plotted = computed(() =>
  rows.value.filter(row =>
    row.liveCashDividendYield.count >= MIN_SAMPLE
    && row.holdingDividendGrowthRate5y.count >= MIN_SAMPLE
    && row.liveCashDividendYield.median !== null
    && row.holdingDividendGrowthRate5y.median !== null)
)
const excluded = computed(() => rows.value.filter(row => !plotted.value.includes(row)))

const excludedText = computed(() => {
  const names = excluded.value.map(row => `${row.sectorName}（殖利率 ${row.liveCashDividendYield.count} 家、持股股利成長率 ${row.holdingDividendGrowthRate5y.count} 家）`)
  return names.length ? `任一個數字少於 ${MIN_SAMPLE} 家的類股不列入，共 ${names.length} 個：${names.join('、')}。` : ''
})

// 手機上散佈圖換成四張小表（2026-11-02，使用者選「要比很多項目的圖，手機改成清單」）：殖利率以列入的類股中位數的中位數分高低，
// 持股股利 5 年成長率以 0 分有沒有減少；表內照類股代號排。類股名稱連到那個類股的殖利率頁（2026-11-08：殖利率要跟同業比，那一頁就是同類股的公司比較）
const yieldSplit = computed(() => medianOf(plotted.value.map(row => row.liveCashDividendYield.median as number)) ?? 0)
const quadrants = computed(() =>
  quadrantGroups(
    [...plotted.value].sort((a, b) => a.sectorCode.localeCompare(b.sectorCode)),
    row => [row.holdingDividendGrowthRate5y.median as number, row.liveCashDividendYield.median as number],
    [0, yieldSplit.value],
    ['殖利率較高、股利沒有減少', '殖利率較高、股利減少', '殖利率較低、股利沒有減少', '殖利率較低、股利減少']
  ).map(group => ({
    title: `${group.title}（${group.rows.length} 個類股）`,
    rows: group.rows.map(row => ({ key: row.sectorCode, name: row.sectorName, to: sectorPath(row.sectorCode) && industryFacetPath(row.sectorCode, 'dividend'), cells: [yieldText(row.liveCashDividendYield.median), growthText(row.holdingDividendGrowthRate5y.median)] }))
  })))
// 答句只講結果（2026-11-06，使用者：「卡片之前的文字描述過多了，會失焦」）：定義、算法與沒有列入的類股都在頁尾的注意事項。不提「圖」：手機上那個位置是四張表
const latestAnswer = computed(() =>
  plotted.value.length
    ? `列入的 ${plotted.value.length} 個類股以殖利率中位數 ${yieldText(yieldSplit.value)} 分高低，殖利率較高、股利沒有減少的有 ${quadrants.value[0]!.rows.length} 個。`
    : null)

// 標籤只在寬畫面顯示。實測（2026-09-30，30 個點、圖高 640px）：1440px 有 8 組標籤互相重疊、
// 375px 有 31 組——手機上的散佈圖標籤沒有解，字級又有 16px 下限不能縮。所以窄畫面只畫點，名字
// 靠底下那張表。當時量到 labelLayout.hideOverlap「完全沒有作用」，2026-10-09 查出原因：按需載入的
// ECharts 要另外註冊 LabelLayout 功能，否則 labelLayout 靜靜失效。現在已註冊，桌機的標籤會推開或隱藏。
//
// 這是**圖表選項**不是版面標記，所以不牴觸「不要用 isWide 在渲染時挑 markup」那條——選項變了
// ECharts 自己重繪，沒有 hydration 的問題。useIsDesktop 本身也是 SSR 先給 false、掛載後才校正。
const isDesktop = useIsDesktop()

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

interface ScatterParam { data?: { value: [number, number]; row: (typeof rows)['value'][number] } }

const chartOption = computed(() => {
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const maxCount = Math.max(1, ...plotted.value.map(row => row.liveCashDividendYield.count))
  return {
    grid: { left: 8, right: 16, top: 24, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (param: ScatterParam) => {
        const row = param.data?.row
        if (!row) return ''
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${row.sectorName}</div>`
          + `<div>殖利率中位數 ${yieldText(row.liveCashDividendYield.median)}（${row.liveCashDividendYield.count} 家）</div>`
          + `<div>持股股利 5 年成長率中位數 ${growthText(row.holdingDividendGrowthRate5y.median)}（${row.holdingDividendGrowthRate5y.count} 家）</div>`
          + `<div style="color:${CHART_TOOLTIP_INK.secondary}">類股共 ${row.companyCount} 家</div></div>`
      }
    },
    xAxis: {
      type: 'value',
      name: '持股股利 5 年成長率中位數 %',
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: { formatter: (value: number) => `${value}%` }
    },
    yAxis: {
      type: 'value',
      name: '殖利率中位數 %',
      // 靠左對齊：預設的 nameLocation 'end' 把軸名放在頂端置中，實測它會飄在圖的正上方、看起來
      // 不像屬於 Y 軸。
      nameTextStyle: { align: 'left' },
      axisLabel: { formatter: (value: number) => `${value}%` }
    },
    series: [
      {
        type: 'scatter',
        // 點大小＝殖利率那一軸的家數，開根號後映射，讓 161 家不會大到蓋掉旁邊的點。最小 10px
        // 仍然高於高齡友善規格對標記的 8px 下限。
        symbolSize: (_: unknown, param: ScatterParam) => {
          const count = param.data?.row.liveCashDividendYield.count ?? 0
          return 10 + 22 * Math.sqrt(count / maxCount)
        },
        itemStyle: { color: accent, opacity: 0.75 },
        label: {
          show: isDesktop.value,
          position: 'right',
          fontSize: 16,
          color: chartInk.value.primary,
          formatter: (param: ScatterParam) => param.data?.row.sectorName ?? ''
        },
        // 34 個標籤一定會互相壓到：先上下推開，推不開才藏；完整數字在 tooltip 裡（產業索引的表格 2026-11-09 隨那一頁先隱藏）。
        labelLayout: { moveOverlap: 'shiftY', hideOverlap: true },
        data: plotted.value.map(row => ({
          value: [row.holdingDividendGrowthRate5y.median as number, row.liveCashDividendYield.median as number],
          row
        }))
      }
    ]
  }
})

// 盈餘發放率（2026-11-10，使用者選方案 A，設計頁 claude.ai/artifact/9C1Go34LxegryCVFdiJaBo；11-08「等接到資料再開發再推」）：一個類股一列，
// 排在 25%～75% 的公司畫成一段、中位數一個點、100% 一條虛線，照中位數由高到低，類股名稱連到那個類股的殖利率頁。家數門檻同散佈圖。
// 圖畫到 120%（設計頁的取捨：列入的類股中位數都在這之內），超過的那一段畫到邊為止，數字在旁邊的欄；手機藏掉圖那一欄，只留表
const PAYOUT_AXIS_MAX = 120
const payoutYear = computed(() => summary.value?.dividendPayoutRatioFiscalYear ?? null)
const payoutRows = computed(() => (payoutYear.value === null ? [] : rows.value.flatMap((row) => {
  const stat = row.dividendPayoutRatio
  return stat && stat.count >= MIN_SAMPLE && stat.median !== null && stat.q1 !== null && stat.q3 !== null
    ? [{ code: row.sectorCode, name: row.sectorName, to: sectorPath(row.sectorCode) && industryFacetPath(row.sectorCode, 'dividend'), median: stat.median, q1: stat.q1, q3: stat.q3 }]
    : []
}).sort((a, b) => b.median - a.median)))
const payoutExcludedText = computed(() => {
  const names = payoutRows.value.length
    ? rows.value.filter(row => row.dividendPayoutRatio && !payoutRows.value.some(item => item.code === row.sectorCode)).map(row => `${row.sectorName}（${row.dividendPayoutRatio!.count} 家）`)
    : []
  return names.length ? `盈餘發放率有數值的公司少於 ${MIN_SAMPLE} 家的類股不列入，共 ${names.length} 個：${names.join('、')}。` : ''
})
const percentText = (value: number) => `${value.toFixed(2)}%`
// 在圖上的位置，0～1
const payoutAt = (value: number) => Math.min(Math.max(value, 0), PAYOUT_AXIS_MAX) / PAYOUT_AXIS_MAX
const payoutAnswer = computed(() => {
  const items = payoutRows.value
  if (!items.length) return null
  const medians = items.map(item => item.median).sort((a, b) => a - b)
  return `列入的 ${items.length} 個類股，有一半的發放率中位數在 ${percentText(percentileValue(medians, 25))} 到 ${percentText(percentileValue(medians, 75))} 之間，最高的是${items[0]!.name}的 ${percentText(items[0]!.median)}。`
})
const payoutLegend = computed(() => [{
  items: [
    { name: '中位數', color: chartInk.value.primary, kind: 'dot' as const },
    { name: '中間一半的公司（排在 25%～75%）', color: getAccentColor(resolvedMode.value, accentColorName.value), kind: 'bar' as const },
    { name: '100%：配出的比賺的多', color: chartInk.value.secondary, kind: 'line' as const, dash: 'dashed' as const }
  ]
}])

</script>

<template>
  <div class="app-page app-page--compact industries-page">
    <h1 class="app-page__title industries-page__title">台股類股殖利率分析</h1>
    <IndustryNav />

    <section class="stock-page-section" aria-labelledby="industries-overview-heading">
      <h2 id="industries-overview-heading" class="stock-page-section__title">各個類股的殖利率與股利成長長什麼樣？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
      <el-card v-if="plotted.length" shadow="never" class="industries-page__card app-wide-only">
        <SharedChart class="app-chart industries-page__chart" :option="chartOption" autoresize aria-label="各類股殖利率中位數與持股股利 5 年成長率中位數的散佈圖" />
      </el-card>
      <IndustryQuadrantTables v-if="plotted.length" class="app-narrow-only" :groups="quadrants" :columns="['類股', '殖利率', HOLDER_DIVIDEND_LABEL]" />
    </section>

    <section v-if="payoutRows.length" class="stock-page-section" aria-labelledby="industries-payout-heading">
      <h2 id="industries-payout-heading" class="stock-page-section__title">各個類股把多少盈餘配出去？</h2>
      <p class="hub-answer">{{ payoutAnswer }}</p>
      <SharedTable :label="`各類股的盈餘發放率（${payoutYear} 年度），照中位數由高到低`" table-class="industries-payout">
        <template #header>
          <div class="industries-payout__header">
            <h3 class="industries-payout__title">盈餘發放率（{{ payoutYear }} 年度）</h3>
            <SharedChartLegend class="app-wide-only" :groups="payoutLegend" />
          </div>
        </template>
        <thead>
          <tr>
            <th scope="col">類股</th>
            <th class="industries-payout__plot app-wide-only" aria-hidden="true">
              <span class="industries-payout__track">
                <span v-for="tick in [0, 50, 100]" :key="tick" class="industries-payout__tick" :style="{ '--at': payoutAt(tick) }">{{ tick }}%</span>
              </span>
            </th>
            <th scope="col" class="seo-table__num">中位數</th>
            <th scope="col" class="seo-table__num">中間一半</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in payoutRows" :key="item.code">
            <th scope="row">
              <NuxtLink v-if="item.to" :to="item.to">{{ item.name }}</NuxtLink>
              <template v-else>{{ item.name }}</template>
            </th>
            <td class="industries-payout__plot app-wide-only" aria-hidden="true">
              <span class="industries-payout__track industries-payout__track--row" :style="{ '--q1': payoutAt(item.q1), '--q3': payoutAt(item.q3), '--median': payoutAt(item.median), '--full': payoutAt(100) }">
                <span class="industries-payout__range" />
                <span class="industries-payout__median" />
              </span>
            </td>
            <td class="seo-table__num">{{ percentText(item.median) }}</td>
            <!-- 整數就夠看出範圍（設計頁手機版的寫法）；兩位小數在 320 寬會把類股名稱擠成三、四行 -->
            <td class="seo-table__num">{{ Math.round(item.q1) }}–{{ Math.round(item.q3) }}%</td>
          </tr>
        </tbody>
      </SharedTable>
    </section>

    <section class="stock-page-section" aria-labelledby="industries-notes-heading">
      <h2 id="industries-notes-heading" class="stock-page-section__title">看這些數字要注意什麼？</h2>
      <ul class="industries-page__notes">
        <!-- 給讀者看的注意事項，不寫資料處理的細節（2026-10-21，使用者：「這邊是給用戶看的 不需要 程式實作層面的說明」） -->
        <li>殖利率是一年份的現金股利除以 {{ summary?.liveCashDividendYieldTradeDate ?? '' }} 收盤價，不含股票股利：{{ ANNUAL_CASH_DIVIDEND_BASIS }}。近 12 個月沒有配息紀錄的公司以 0% 計入，超過 14 天沒有成交的公司不算進去。中位數是 0，代表這個類股有一半以上的公司{{ ZERO_YIELD_TEXT }}。</li>
        <li>{{ HOLDER_DIVIDEND_NOTE }}</li>
        <li>兩個數字各自只算有這個數字的公司，所以算進去的家數不一樣。持股股利 5 年成長率要有 5 年前的配息紀錄，上市不滿 5 年或 5 年前沒有配息的公司算不出來。</li>
        <li>兩個數字都用中位數，少數公司的極端數字不會把整個類股拉偏。</li>
        <li>殖利率以列入類股的中位數 {{ yieldText(yieldSplit) }} 分高低，持股股利 5 年成長率以 0 分有沒有減少。</li>
        <!-- 2026-11-08 查過殖利率分析的做法後加的兩條：配息政策因產業而異（Michel 1979 起；台灣的公司也向同業看齊），殖利率要跟同業比；
             景氣循環股不適合用一年份的殖利率看（存股著作與研究都這樣提醒） -->
        <li>各產業的配息習慣本來就不同，類股之間殖利率的高低，多半反映的是這個差異。要看一家公司配得多不多，要跟同類股的公司比：每個類股都有自己的殖利率頁，把同類股的公司畫在一起。</li>
        <li>景氣循環類股的股利跟著景氣起落：景氣好的那一年配得多，之後算出來的一年份殖利率會比平常年份高。各類股的營收跟著景氣怎麼走，在<NuxtLink to="/industries/cycle" class="hub-inline-link">營收與景氣</NuxtLink>。</li>
        <li class="app-wide-only">圖上每一個點是一個類股，點的大小代表該類股殖利率有值的公司數。</li>
        <li v-if="excludedText">{{ excludedText }}</li>
        <template v-if="payoutRows.length">
          <li>盈餘發放率是 {{ payoutYear }} 年度的盈餘配出的現金股利，除以那一年的每股盈餘。虧損的公司沒有數值、不算進去；有賺錢、過了隔年 6 月底還沒有分派公告的公司算 0%。每年 9 月換到下一個年度。</li>
          <li>各產業常見的發放率本來就不同：金融業配多少受資本規定限制，成長中的公司要把錢留下來投資。超過 100%，代表配出的現金股利比那一年賺的多。</li>
          <li>「中間一半」是類股裡發放率排在 25% 到 75% 的公司，最高與最低的四分之一不算在這一段裡。</li>
          <li class="app-wide-only">發放率的圖畫到 120%，超過的部分畫到邊為止，實際數字在「中間一半」那一欄。</li>
          <li v-if="payoutExcludedText">{{ payoutExcludedText }}</li>
        </template>
      </ul>
      <p class="hub-answer hub-sources industries-page__sources">資料來源：臺灣證券交易所、證券櫃檯買賣中心公開資訊，以及各公司股利分派公告。母體為上市與上櫃普通股，不含興櫃。</p>
    </section>
  </div>
</template>

<style scoped>

.industries-page__title {
  font-weight: 600;
}

.industries-page__notes {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.industries-payout__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 24px;
}

.industries-payout__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

/* 圖那一欄吃掉其餘的寬；刻度和每一列的段畫在同一條軌道上（同寬、同樣的左右內距），位置是 0～1 的比例 */
.industries-payout__plot {
  width: 100%;
  min-width: 16rem;
}

.industries-payout__track {
  position: relative;
  display: block;
  height: 24px;
}

.industries-payout__tick {
  position: absolute;
  left: calc(var(--at) * 100%);
  transform: translateX(-50%);
}

.industries-payout__tick:first-child {
  transform: none;
}

/* 100% 的虛線貫穿整列（上下各補回格子的 9px 內距） */
.industries-payout__track--row::before {
  content: '';
  position: absolute;
  top: -9px;
  bottom: -9px;
  left: calc(var(--full) * 100%);
  border-left: 2px dashed var(--el-text-color-secondary);
}

.industries-payout__range {
  position: absolute;
  top: 8px;
  left: calc(var(--q1) * 100%);
  width: calc((var(--q3) - var(--q1)) * 100%);
  height: 8px;
  border-radius: 4px;
  background: var(--el-color-primary);
}

.industries-payout__median {
  position: absolute;
  top: 5px;
  left: calc(var(--median) * 100%);
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border-radius: 50%;
  background: var(--el-text-color-primary);
  box-shadow: 0 0 0 2px var(--app-card-bg);
}

/* 手機只剩三欄，要在 320px 放得下：名稱可以折，數字欄貼著內容靠右（同 IndustryQuadrantTables） */
@media (max-width: 767px) {
  .industries-payout tbody th {
    white-space: normal;
  }

  .industries-payout :is(th, td):not(:first-child) {
    width: 1%;
    padding-left: 8px;
  }

  .industries-payout :is(th, td):not(:last-child) {
    padding-right: 8px;
  }
}

</style>
