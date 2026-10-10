<script setup lang="ts">
// /stock/:code/dividend-source — 配息從哪來（2026-09-24,「sidebar 亮點與風險下面加一個…我這一頁要
// 放從現金殖利率倒推回營收的每個環節」, named「對 本質上是股息從哪來 找回來 然後改名成 配息從哪來」）.
//
// This URL existed before（64b6e38 merged it into /dividend and dropped its waterfall chart）and
// the 股息從哪裡來 section was deleted from /dividend earlier today. Neither removal was because
// the content was wrong — it was on a page whose subject was「殖利率是多少」, which made that page
// carry two subjects. Here it is the whole subject, and the chain reaches further in both
// directions than it ever did as a section.
//
// The chain is a chain of IDENTITIES, which is the only reason it can be published at all: every
// step is one filed figure times one filed rate, so nothing here predicts anything. Verified
// against live data before the page was written（2330 2026Q2: 每股營收 171.23 × 稅後淨利率 50.38%
// = EPS 86.27, and 86.27 × 盈餘發放率 23.76% = 每股股利 20.50, both to the cent）.
//
// Two representations, not one, and they answer different questions. StockDividendSegmentLine is
// the part-whole picture — one division per press, columns growing rightwards on a desktop and
// stacked rows on a phone — and it teaches. The table under it is the precise record and the SSR payload, and it is
// the only one that survives a company the diagram cannot draw（negative parts; see that
// component's own guard）. Still no waterfall and no Sankey: the 高齡友善圖表選型規範 ruling that
// removed the original bridge chart here stands, since a flow diagram asks the reader to track
// width, direction and branching at once.
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '配息從哪來'

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
const { digest, series } = await useStockPageDigest(code, 'dividend-source', { shortName: stockShortName })

// Same key as useStockDetailSummary's own call → deduped, not a second request. Needed here for
// the two DATES that `stock` flattens away, and they are the difference between this page being
// right and being visibly wrong: the exchange computes 殖利率 on its own valuation date, while the
// summary card shows the latest close. Caught by arithmetic on the rendered page — 2330 showed
// 殖利率 0.89% beside 每股股利 20.50 元 and 股價 2500.00 元, which divide to 0.82%. The identity does
// hold; 0.89% is 20.50 ÷ that day's close（~2303 on 2026-09-18）. Printing the newest price next to
// a yield computed five days earlier asserted a division that does not work.
const { data: summary } = useStockSummary(code)
// priceDate 與 datesDiffer 隨「為什麼殖利率每天在動」那一段一起刪掉（2026-09-25 使用者要求移除）。
// 上面那段註解記的仍然有效，而且現在只剩 yieldDate 在扛：殖利率那一列的來源說明要標出「哪一天的
// 收盤價」，否則讀者拿摘要卡的股價去除會得到不同的數字。
const yieldDate = computed(() => summary.value?.valuation?.tradeDate ?? null)

// 整頁一個年度（2026-09-25「整頁改成年度」）。先前是近四季，而那讓最後一段結構性錯位——近四季的
// 股利是「過去四季付出去的現金」，多半出自更早的盈餘。改成年度之後，損益表的會計年度與
// dividend-history 的盈餘所屬年度是同一年，整條鏈第一次落在同一段盈餘上。
//
// 年度不是「最後一筆」：773 家的 114 年報還沒匯入，抽樣 20 檔有 14 檔最新只到 113 年度。所以往回找
// 第一個「鏈上每個科目都有值」的年份。實測 15 檔裡有 14 檔，這個年份跟 dividend-history 自己挑出來
// 的年份一致；唯一的例外 2891 中信金是銀行，鏈本來就畫不出來，那條路走 chainAnswer 的降級分支。
// 只要求 EPS，不要求整條鏈。先前要求營收／毛利／營業利益全齊，結果銀行一格都拿不到——2891 中信金
// 的 eps、稅前淨利、所得稅在 FY 上各有四年，缺的只有營收與毛利，卻因為那個條件連自己有的列都消失，
// 表格 0 列、整頁掉到兩個問句 h2。每一列本來就各自判斷有沒有值（visibleSteps 過濾「－」），選年度這
// 一步不該再擋一次。
const FY_REQUIRED = ['eps'] as const
const fyRows = computed(() => {
  const rows = new Map<number, Record<string, number | null>>()
  for (const group of [series.value?.groups?.FY_CHAIN_1, series.value?.groups?.FY_CHAIN_2]) {
    for (const entry of group?.entries ?? []) {
      const row = rows.get(entry.fiscalYear) ?? {}
      for (const [code, point] of Object.entries(entry.values)) row[code] = point?.value ?? null
      rows.set(entry.fiscalYear, row)
    }
  }
  return rows
})
const fiscalYear = computed(() =>
  [...fyRows.value.keys()].sort((a, b) => b - a).find(year => FY_REQUIRED.every(code => fyRows.value.get(year)?.[code] != null)) ?? null)
const fy = (code: string): number | null => (fiscalYear.value === null ? null : fyRows.value.get(fiscalYear.value)?.[code] ?? null)
// 前一個年度。FY_CHAIN 那兩組本來就抓 5 年（要往回找第一個完整年度），所以多一欄不必多打一次 API。
// 單一年度的表格對搜尋引擎是很薄的內容，而「比去年多還是少」才是讀者真正會問的那件事。
const prevFiscalYear = computed(() => {
  if (fiscalYear.value === null) return null
  return [...fyRows.value.keys()].sort((a, b) => b - a)
    .find(year => year < fiscalYear.value! && FY_REQUIRED.every(code => fyRows.value.get(year)?.[code] != null)) ?? null
})
const prevRocYear = computed(() => (prevFiscalYear.value === null ? null : prevFiscalYear.value - 1911))
const fyPrev = (code: string): number | null => (prevFiscalYear.value === null ? null : fyRows.value.get(prevFiscalYear.value)?.[code] ?? null)
// 民國年。dividend-history 自己帶 rocFiscalYear，但鏈的年份是從 metrics-history 來的，兩邊實測一致，
// 所以直接減——不從股利那側取，否則銀行（鏈為 null）會拿到一個對不上任何圖表的年份。
const rocYear = computed(() => (fiscalYear.value === null ? null : fiscalYear.value - 1911))

const revenuePerShare = computed(() => fy('revenuePerShare'))
const grossProfit = computed(() => fy('grossProfitPerShare'))
const operatingIncome = computed(() => fy('operatingIncomePerShare'))
const eps = computed(() => fy('eps'))
// 盈餘發放率改讀盈餘所屬年度（2026-09-25，使用者定案）。`dividendPayoutRatio` 的分子是「過去四季
// 付出去的現金」、分母是「過去四季賺到的淨利」，兩者不是同一段盈餘；GET /stocks/{symbol}/
// dividend-history 的 `fiscalYear` 則是盈餘歸屬年度，`eps` 是年報 EPS，所以它的 payoutRatio 分子
// 分母同屬一年。
//
// 兩者不是精度差異，是會給出相反解讀的差異。台積電 2023 年，兩個口徑的發放率都上升：
//   近四季     27.94% → 34.79%   分子（股利）沒動，是 EPS 從 39.36 掉到 32.33 造成的
//   盈餘歸屬   28.06% → 40.20%   公司在獲利下滑那一年把配息從 11 元拉到 13 元
// 同一個現象，一個口徑把它變成分母造成的假訊號，另一個把它變成公司真的做了的事。
//
// 取最新一個 eps 與 payoutRatio 都有值的年度，不能直接取最後一筆：最新那一年股利已宣告但年報還
// 沒出，analysis-ts 的 null 條件就是「沒有年報」（2330 的 115 年度即為 null）。
const fiscalPayout = computed(() =>
  [...(series.value?.dividendHistory?.entries ?? [])].reverse().find(entry => entry.eps !== null && entry.payoutRatio !== null) ?? null)
// 股利也要是同一年度的。近四季那支是「過去四季付出去的現金」，跟這條鏈的會計年度不是同一段盈餘——
// 那正是整頁改成年度要解決的問題，所以這裡不能留著近四季的來源。dividend-history 的 fiscalYear 是
// 盈餘所屬年度，跟 metrics-history 的會計年度同一年（實測 15 檔有 14 檔一致，例外是銀行，鏈本來就
// 畫不出來）。取「這一年的」而不是「最新完整的那一年」：兩者通常相同，但鏈的年份才是圖上畫的年份。
const dividendEntry = computed(() =>
  fiscalYear.value === null
    ? null
    : (series.value?.dividendHistory?.entries ?? []).find(entry => entry.fiscalYear === fiscalYear.value) ?? null)
const dividendPerShare = computed(() => dividendEntry.value?.cashDividend ?? null)
const prevDividendPerShare = computed(() =>
  prevFiscalYear.value === null
    ? null
    : (series.value?.dividendHistory?.entries ?? []).find(entry => entry.fiscalYear === prevFiscalYear.value)?.cashDividend ?? null)
// 營業費用 read from the filing rather than derived — see TTM_OPEX_1's own note in stock-data.ts.
// Still null on symbols the backfill has not reached, so every consumer treats it as optional.
const operatingExpense = computed(() => fy('operatingExpensePerShare'))
const otherOperatingIncome = computed(() => fy('netOtherIncomeExpensesPerShare'))
const researchExpense = computed(() => fy('researchAndDevelopmentExpensePerShare'))

// 稅後淨利率那一列的拆解（2026-09-24, analysis-ts 的 12 支損益表逐項欄位）. The identity is
// 營業利益 ＋ 業外 － 所得稅 － 少數股東 ＝ 稅後淨利, verified live on six symbols before wiring —
// five reconcile to the cent, 2330 is out by 0.01 元 on rounding.
//
// Expressed as shares of 每股營收 rather than per-share amounts, because rows 4–6 of this table are
// all rates and switching currency mid-column would make the reader convert in their head.
//
// It PRINTS ONLY IF IT RECONCILES. That one guard replaces three separate ones bff-ts warned about:
// a bare `null` in place of the value object（2891 中信金 reproduces it; financials do not file
// these lines at all）, a component that is missing rather than zero, and minorityInterest, whose
// null/0 meaning analysis-ts corrected to the OPPOSITE of their first note — 0 means the company
// has no non-controlling interest, null means it is genuinely absent. Anything that leaves the sum
// off by more than a rounding error falls back to the prose, so a wrong number cannot reach the page.
// 只在螢幕上的數字真的算得出螢幕上的結果時才宣稱那個算式。兩個地方需要它，而且兩個都不是理論問題：
//
//   毛利那一列   `營收 − 成本 = 毛利` **不是恆等式**（2026-09-25 mops-ts 查 TIFRS 計算樹確認）。
//                營業毛利有三個子項：營收減成本、已實現銷貨損益、未實現銷貨損益，後兩項不為零時
//                這條就不成立。analysis-ts 在我們實際消費的那些欄位上實測（單季寬表 109 年起、四欄
//                都有值 37,410 筆）：約 4.1% 的公司季有銷貨損益調整。關係人之間的工程收入會產生
//                未實現銷貨損益，綠能／EPC 那類公司的損益表結構本來就長這樣，不是資料錯誤。
//                差異還有第二個來源，而且沒有解釋：另外約 0.3%「營收 − 成本 ≠ 營業毛利（營業）」，
//                補上那兩個科目也不會閉合（1240 茂生農經是這一類）。所以退回時不要斷言原因。
//   EPS 那一列   稅前 − 所得稅 − 少數股東 = EPS，全市場約 2% 不成立（停業單位損益等科目不在鏈上）。
//
// 兩者都是「圖的模型少了科目」而不是「數字錯了」，所以做法是不宣稱、不是不顯示。
const reconciles = (parts: (number | null)[], total: number | null): boolean => {
  if (total === null || parts.some(v => v === null)) return false
  const sum = parts.reduce<number>((a, v) => a + (v ?? 0), 0)
  return Math.abs(sum - total) <= Math.max(0.02, Math.abs(total) * 0.005)
}

// 每一環可以往下看什麼（2026-09-25「我希望底下放每一個階段可以對應到的細節…讓這個頁面是個其他頁面
// 的索引頁面」）。這一段同時解掉三件事：
//   1. 頁面因為移除「為什麼殖利率每天在動」掉到兩個問句 <h2>，站規要求三個。腳本自己的註解反對「為了
//      滿足數字而發明標題」——這一段不是發明的，它是這一頁本來就被指派的角色（「dividend-source 擔綱
//      教學與索引的腳色」2026-09-25）第一次真的被寫出來。
//   2. 圖表裡每一步只露出一到兩個連結（而且一次只看得到一步）。整張索引在這裡，SSR 一次全給。
//   3. 上週新增的 16 個損益表 metric 頁目前完全不在側邊欄裡，這一段是它們的第一個入口與爬取路徑。
// 分組跟著圖上的五刀走，順序也一樣，所以讀者在圖上停在哪一步，就在這裡找得到同一個標題。
const CHAIN_INDEX: { stage: string; links: { label: string; slug: string; hook: string }[] }[] = [
  {
    stage: '① 公司這一年賣了多少',
    links: [
      { label: '每股營收', slug: 'revenue-per-share', hook: '這一年每一股對應到多少營業額' },
      { label: '月營收', slug: 'monthly-revenue', hook: '每個月 10 號公布，是最快知道公司近況的數字，其他都要等一季' }
    ]
  },
  {
    stage: '② 先切掉做出產品本身的成本',
    links: [
      { label: '每股營業成本', slug: 'cost-of-goods-sold', hook: '做出產品本身花了多少，原料漲價會先反映在這裡' },
      { label: '每股毛利', slug: 'gross-profit', hook: '賣掉之後扣掉成本，還剩下多少' },
      { label: '毛利率', slug: 'gross-margin', hook: '同樣賣一百元留下幾元。想比較兩家公司，看比率不是金額' }
    ]
  },
  {
    stage: '③ 再切掉賣東西和管理公司的開銷',
    links: [
      { label: '每股營業費用', slug: 'operating-expense', hook: '賣東西和管理公司花的錢，跟做出產品本身無關' },
      { label: '每股推銷費用', slug: 'selling-expense', hook: '廣告、通路、業務團隊的錢' },
      { label: '每股管理費用', slug: 'administrative-expense', hook: '總部、人事、法務這些後勤的錢' },
      { label: '每股研發費用', slug: 'rd-expense', hook: '投入新產品的錢。想知道公司為以後準備了多少，看這個' },
      { label: '研發費用率', slug: 'rd-intensity', hook: '研發佔營業額的比率。要跨公司比較投入程度，用比率' },
      { label: '每股營業利益', slug: 'operating-income', hook: '本業做完一輪之後真正賺到的' },
      { label: '營業利益率', slug: 'operating-margin', hook: '本業每一百元營業額，最後留下幾元' }
    ]
  },
  {
    stage: '④ 再切掉本業以外的收支和要繳的稅',
    links: [
      { label: '每股業外損益', slug: 'non-operating-income', hook: '不是本業賺的那一塊。想知道獲利有多少不靠本業，看這個' },
      { label: '每股利息收入', slug: 'interest-income', hook: '帳上現金存著、借出去，收到的利息' },
      { label: '每股財務成本', slug: 'finance-cost', hook: '借錢要付的利息。想知道負債壓力多大，從這裡看' },
      { label: '每股其他收入', slug: 'other-income', hook: '零星的其他進帳' },
      { label: '每股其他利益及損失', slug: 'other-gains-losses', hook: '匯兌、資產評價、處分這些一次性的損益' },
      { label: '每股權益法投資損益', slug: 'equity-method-income', hook: '轉投資的公司分回來的損益' },
      { label: '每股稅前淨利', slug: 'pretax-income', hook: '繳稅之前的獲利' },
      { label: '每股所得稅費用', slug: 'income-tax-expense', hook: '這一年繳了多少稅。有時候是負的，那是所得稅利益' },
      { label: '稅後淨利率', slug: 'net-profit-margin', hook: '營業額最後有幾成變成獲利' },
      { label: '每股盈餘', slug: 'eps', hook: '每一股賺多少，新聞上最常講的那個數字' }
    ]
  },
  {
    stage: '⑤ 最後一刀：公司決定發多少給你',
    links: [
      { label: '盈餘發放率', slug: 'dividend-payout-ratio', hook: '這一年賺的錢，發了幾成出去' },
      { label: '股利保障倍數', slug: 'dividend-coverage-ratio', hook: '賺到的現金夠不夠支撐這次配息' },
      { label: '股東總回饋率', slug: 'shareholder-yield', hook: '除了現金股利，公司買回自己的股票也算還錢給股東' },
      { label: '現金殖利率', slug: 'dividend', hook: '用今天的股價買進，一年可以領回幾 %' },
      { label: '填權填息', slug: 'dividend-fill', hook: '除息之後股價有沒有漲回來。領到股利不等於賺到，差別在這裡' },
      { label: '資本支出佔營收比', slug: 'capex-to-revenue', hook: '公司把多少錢拿去買設備蓋廠房。那些錢就不會變成股利' }
    ]
  }
]

const amount = (value: number | null | undefined): string => (value === null || value === undefined ? '－' : `${value.toFixed(2)} 元`)
const percent = (value: number | null | undefined): string => (value === null || value === undefined ? '－' : `${value.toFixed(2)}%`)

// One row per link of the chain, newest filing throughout. `from` states the arithmetic that
// produces this row's own number out of the row BELOW it — the table is read downwards, which is
// the 倒推 direction the page is about: start at the number a reader already has, end at revenue.
//
// `to` is the page that answers about that one step on its own. Every step has one today; a step
// that ever loses its page renders as plain text rather than pointing somewhere approximate.
// 列標題是純文字不是連結（2026-09-25「表格的列標題改成純文字、不再當連結」）。那 7 個連結原本指向的
// metric 頁，現在全部在「每一環還可以往下看什麼？」那一段裡——一個元素一個職責：表格給數字與算式，
// 索引給導覽。爬取路徑一條都沒少。
//
// `has` 也跟著拿掉：銀行沒有營業收入與毛利，那些列本來就要略過（不然 2891/2886/2880 會只剩兩個問句
// h2），但改成純文字之後判斷值是不是「－」就夠了，不需要每一列各帶一個布林。
interface ChainStep {
  // 運算子自己一欄，不併進 label（2026-09-25）。先前寫成「減：營業成本」「＝ 毛利」，對人類讀者是好的
  // ——表格自己讀得出算式——但「減：營業成本」不是任何人會搜尋的字串，而 <th scope="row"> 是這一列的
  // 名稱。拆開之後每一列的標題就是乾淨的指標名。
  op: string
  label: string
  value: string
  prev: string
  from: string
}

// 表格改成純金額的損益表走法（2026-09-25「整頁改成年度」）。原本混著三率與金額，而三率沒有年度口徑
// ——與其在前端從金額回推一份比率，不如把表格變成它本來就該是的東西：申報的損益表。現金殖利率不在這裡，
// 它的分母是每日股價、沒有會計年度可言，屬於 /dividend。
//
// 順序是營收 → 每股股利（2026-09-25「順序要從營收到每股股利」），跟圖上的五刀同向，也跟損益表自己的
// 順序同向。先前是反過來的（從殖利率往回推），那時的入口是殖利率；改成年度之後入口變成營收，兩邊就
// 不該再相反。每一列的數字由它「上面」那一列算出來。
const steps = computed<ChainStep[]>(() => [
  { op: '', label: '每股營收', value: amount(revenuePerShare.value), prev: amount(fyPrev('revenuePerShare')), from: '這條鏈的起點：這一年的營業收入除以公司發行的股數' },
  { op: '−', label: '營業成本', value: amount(fy('operatingCostsPerShare')), prev: amount(fyPrev('operatingCostsPerShare')), from: '做出產品本身的花費，財報直接申報的金額' },
  {
    op: '＝',
    label: '毛利',
    value: amount(grossProfit.value),
    prev: amount(fyPrev('grossProfitPerShare')),
    from: reconciles([revenuePerShare.value, -(fy('operatingCostsPerShare') ?? 0)], grossProfit.value)
      ? `每股營收 ${amount(revenuePerShare.value)} 減營業成本 ${amount(fy('operatingCostsPerShare'))}`
      : '財報申報的營業毛利。這一年它不等於營收減營業成本'
  },
  { op: '−', label: '營業費用', value: amount(fy('operatingExpensePerShare')), prev: amount(fyPrev('operatingExpensePerShare')), from: '推銷、管理、研發與預期信用減損的合計' },
  { op: '＋', label: '其他營業收支', value: amount(fy('netOtherIncomeExpensesPerShare')), prev: amount(fyPrev('netOtherIncomeExpensesPerShare')), from: '不屬於本業銷貨、但仍列在營業項下的零星收支淨額' },
  {
    op: '＝',
    label: '營業利益',
    value: amount(operatingIncome.value),
    prev: amount(fyPrev('operatingIncomePerShare')),
    from: reconciles([grossProfit.value, -(fy('operatingExpensePerShare') ?? 0), fy('netOtherIncomeExpensesPerShare') ?? 0], operatingIncome.value)
      ? `毛利 ${amount(grossProfit.value)} 減營業費用 ${amount(fy('operatingExpensePerShare'))}${Math.abs(fy('netOtherIncomeExpensesPerShare') ?? 0) < 0.005 ? '' : ` 加其他營業收支 ${amount(fy('netOtherIncomeExpensesPerShare'))}`}`
      : '財報申報的營業利益'
  },
  { op: '＋', label: '業外損益', value: amount(fy('nonOperatingIncomeExpensesPerShare')), prev: amount(fyPrev('nonOperatingIncomeExpensesPerShare')), from: '利息、轉投資、處分資產這些不是本業賺的' },
  {
    op: '＝',
    label: '稅前淨利',
    value: amount(fy('pretaxIncomePerShare')),
    prev: amount(fyPrev('pretaxIncomePerShare')),
    from: `營業利益 ${amount(operatingIncome.value)} 加業外損益 ${amount(fy('nonOperatingIncomeExpensesPerShare'))}`
  },
  { op: '−', label: '所得稅費用', value: amount(fy('incomeTaxExpensePerShare')), prev: amount(fyPrev('incomeTaxExpensePerShare')), from: '這一年繳的所得稅。為負代表所得稅利益' },
  { op: '−', label: '少數股東損益', value: amount(fy('nonControllingInterestsPerShare')), prev: amount(fyPrev('nonControllingInterestsPerShare')), from: '子公司裡不屬於母公司的那一份' },
  {
    op: '＝',
    label: 'EPS（每股稅後淨利）',
    value: amount(eps.value),
    prev: amount(fyPrev('eps')),
    from: reconciles([fy('pretaxIncomePerShare'), -(fy('incomeTaxExpensePerShare') ?? 0), -(fy('nonControllingInterestsPerShare') ?? 0)], eps.value)
      ? `稅前淨利 ${amount(fy('pretaxIncomePerShare'))} 減所得稅 ${amount(fy('incomeTaxExpensePerShare'))}${Math.abs(fy('nonControllingInterestsPerShare') ?? 0) < 0.005 ? '' : ` 減少數股東 ${amount(fy('nonControllingInterestsPerShare'))}`}`
      : '年報公告的每股盈餘。這一年它不等於稅前淨利減所得稅與少數股東，中間還有不在這條鏈上的科目'
  },
  {
    op: '−',
    label: '留在公司',
    value: amount(partition.value?.parts[3]?.amount ?? null),
    // 前一年度沒有 partition（那只算當年度），但這一格本來就是 EPS 減股利，直接算。
    prev: amount(fyPrev('eps') === null || prevDividendPerShare.value === null ? null : fyPrev('eps')! - prevDividendPerShare.value),
    from: '依公司法必須提存的，加上留著買設備蓋廠房的'
  },
  {
    op: '＝',
    label: '每股股利',
    value: amount(dividendPerShare.value),
    prev: amount(prevDividendPerShare.value),
    from: eps.value !== null && eps.value <= 0
      ? `這一年 EPS ${amount(eps.value)} 為負，這次配發不是由這一年的盈餘產生`
      : '這一年度的盈餘分配，實際配發到你手上的現金'
  }
])

// 沒有數字的環節不列——先前是逐列的 `has` 布林，但改成純文字之後那個欄位只剩這一個用途，直接看值。
const visibleSteps = computed(() => steps.value.filter(step => step.value !== '－'))
// The section is worth rendering as soon as two links of the chain survive — for a bank that is
// 殖利率 → 每股股利 → EPS, which is the part its holders came for.
// 兩個區段各自看自己的條件。先前圖表段掛的是 hasTable，而那是表格的條件——2891 中信金的鏈全空，
// 表格 0 列，於是連「113 年度每股賺 3.64 元，配發 2.30 元」這句它唯一答得出來的話都一起消失了。
// 空表格也不能留：check-stock-pages.mjs 自己的註解說「a table with no rows would pass this line
// and tell the reader nothing」。
const hasTable = computed(() => visibleSteps.value.length >= 2)
// The picture needs the whole income-statement decomposition, so it keeps the stricter test.
const hasChain = computed(() => revenuePerShare.value !== null && eps.value !== null)

// The SAME function the chart uses（app/utils/dividend-source-partition.ts）. The page used to
// decide「畫不畫得出來」on its own and got it wrong: the component also requires 留在公司 ＝
// 稅後淨利 − 每股股利 to be positive, which the page never tested, so every company paying more
// than it earned printed「這一檔的每一塊都是正數，所以畫得出來」above no chart at all. Four of ten
// symbols sampled were over 100% payout — 2603 長榮, 1402 遠東新, 2201 裕隆, 9910 豐泰.
//
// Kept as the OBJECT, not just its verdict: the 營業成本 and 毛利 rows below read their amounts from
// it（2026-09-25「配息從哪來 我認為至少要有 營業成本與毛利兩項細節」）. Those two numbers are already
// on screen as bars, so taking them from anywhere else would be a second source for a figure the
// reader can see twice — which is the exact failure this shared function was extracted to end.
// It is also why they are not fetched: 每股營收 − 毛利 ＝ 營業成本 is an exact identity with no 其他
// term, unlike 營業費用（毛利率 − 營業利益率 silently folds in 其他營業收支, which shipped wrong for
// a few hours）. Verified against the filed figures anyway: 2330 operatingCostsPerShare 61.25,
// derived 61.25.
const partition = computed(() => dividendSourcePartition({
  revenuePerShare: revenuePerShare.value,
  grossProfit: grossProfit.value,
  operatingIncome: operatingIncome.value,
  eps: eps.value,
  dividendPerShare: dividendPerShare.value
}))
const chartDrawn = computed(() => partition.value?.usable ?? false)

// Facts only — each clause survives having its adjectives deleted, and no step is compared with a
// threshold, an industry figure or a previous period.
// 金額在前，比率在後，而且說明比率是回推的（2026-09-25「盈餘發放率是投資人回推的，那麼這句語句的語
// 意就會有些偏斜」）. The sentence used to read「稅後淨利率 50.38%、兩者相乘得到 EPS 86.27 元、再乘
// 上盈餘發放率 23.76%，得到每股股利 20.50 元」, which puts two DERIVED statistics in the position of
// inputs to the company's decision. 董事會決議的是金額——每股配 20.50 元——而 23.76% 是拿結果除回去
// 得到的；GET /metrics' own definition is「近四季股利發放現金除以近四季淨利」. 稅後淨利率 is the same
// shape. Nothing the company published is a ratio.
//
// This also removes a rounding trap rather than guarding it, which is what the previous fix did.
// Measured across the market, NEITHER direction reproduces from the printed 2dp figures: the
// multiplication holds for 84.7%, and the division — which is how the ratio is actually computed —
// for only 35.5%, because a ratio derived from full-precision totals cannot be recovered from
// per-share amounts rounded to two decimals（台泥: −1.20 ÷ 19.52 = −6.15% against a filed −6.17%）.
// Both live examples the guard was written for（3489 森寶「EPS 0.00 元…得到每股股利 0.50 元」,
// 1453 大將「0.01 × 5306.87% 得到 0.70」）simply stop existing once no equation is asserted.
// 一句話、一個口徑、動詞在前（2026-09-25「這說的是人話嗎？這一頁面我認了請統一都用年度」）. 前一版
// 是三句兩個口徑：近四季的三個金額、一句「比率是回推的」、再一句盈餘歸屬。每一句都對，合起來沒人
// 讀得下去。
//
// 全頁統一用年度目前做不到——FY 只有 eps 一支，另外 19 支（每股營收、營業成本、毛利、營業費用、
// 營業利益、三率、每股股利、盈餘發放率）都還回「不支援 periodType FY」，圖表與表格沒有年度資料可
// 畫。已向 analysis-ts 提出需求。在那之前的作法不是寫但書去牽線，而是讓每個口徑在它自己出現的地方
// 標明自己：這一句寫「114 年度」，圖表標題寫「近四季」。
//
// 盈餘歸屬這一句對銀行也成立（年報有 EPS、也配息），所以它在 hasChain 之外先算——2891 中信金以前
// 只拿得到「本站沒有這一檔的營收與毛利數字」，現在拿得到它真正想問的那個答案。
const chainAnswer = computed(() => {
  const fiscal = fiscalPayout.value
  // 有公積成分時必須把分子講出來（2026-09-25，上游把 payoutRatio 的分子從「現金股利合計」改成
  // 「盈餘分配的那一塊」之後）。3045 台灣大 113 年度：現金股利 4.50、發放率 89.93%，而 4.50 ÷ 4.57
  // 是 98.5%——比率的分子其實是 4.11，句子裡沒有它，讀者拿螢幕上的兩個數字除不出那個比率。這正是
  // 這一頁修過好幾次的同一種錯。
  //
  // 「來自公積」不能寫成「退還股本」：這一欄是法定盈餘公積「加」資本公積，合在一欄拆不開，而法定
  // 盈餘公積是以前年度盈餘提存的、是保留獲利不是退還資本。
  //
  // 兩個來源欄位可能是 null（上游改版空窗期實測過整批消失），null 時不宣稱拆得出來。
  const surplus = fiscal?.cashDividendFromLegalReserveAndCapitalSurplus ?? 0
  const fromEarnings = fiscal?.cashDividendFromEarnings ?? null
  const split = fiscal !== null && fromEarnings !== null && surplus > 0
    ? `，其中 ${amount(fromEarnings)}來自盈餘、${amount(surplus)}來自公積；盈餘那塊`
    : '，'
  const lead = fiscal !== null
    ? `${stockShortName.value} ${fiscal.fiscalYear - 1911} 年度每股賺 ${amount(fiscal.eps)}，配發現金股利 ${amount(fiscal.cashDividend)}，分 ${fiscal.distributionCount} 次發出${split}等於那一年賺到的 ${percent(fiscal.payoutRatio)}。`
    // 只要有 EPS 就說得出話。先前還要求同年度有股利，但虧損那年的股利多半還沒宣告——6916 華凌
    // 2025 年度 EPS −1.44、股利未定，於是整個區段連同它的 h2 一起消失，頁面掉到兩個問句。
    // EPS 為負時不寫「賺」。
    : eps.value === null
      ? null
      : `${stockShortName.value}${rocYear.value === null ? '' : ` ${rocYear.value} 年度`}${eps.value < 0 ? `每股虧 ${amount(Math.abs(eps.value))}` : `每股賺 ${amount(eps.value)}`}${dividendPerShare.value === null ? '，這一年度的股利尚未公布' : `，配發現金股利 ${amount(dividendPerShare.value)}`}。`
  if (lead === null) return null
  // 「什麼情況下畫不出這條線？」整段移除（2026-09-25「這個說明我想拿掉」）之後，這裡是唯一還會解釋
  // 「為什麼這一檔沒有圖」的地方。不能一起拿掉：畫不出來的公司相當多——金融股沒有營收與毛利、當年
  // 虧損、業外是淨收益、配發大於當期盈餘——而它們看到的會是一段沒有圖的說明加一張表，卻沒有任何一句
  // 話說為什麼。原本七個分支壓成兩句：沒有營收那格是結構性的（金融股），其餘一律是「有一塊是負數」。
  if (!hasChain.value) return `${lead}本站沒有這一檔的營收與毛利數字，下面只列得出 EPS 以下的環節；金融、保險、證券業不申報這兩格。`
  if (!chartDrawn.value) return `${lead}這張圖需要每一塊都是正數，這一檔至少有一塊是負數，所以只列出下面的數字。`
  return lead
})


const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '從營收一路推到現金殖利率',
  pathSuffix: '/dividend-source',
  stock,
  summary: computed(() => null),
  description: computed(() =>
    clampDescription(
      hasChain.value
        ? `${stockShortName.value}（${code.value}）的配息如何從營收算出來：每股營收、毛利率、營業利益率、稅後淨利率、EPS、盈餘發放率到每股股利，逐步列出每一個環節。`
        : `${stockShortName.value}（${code.value}）目前沒有足夠的財報資料可以逐步列出配息的來源。`
    )
  ),
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="app-page stock-dividend-source-page">
    <template v-if="stock">
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection
        v-if="chainAnswer"
        id="stock-dividend-source-chain"
        :question="`${stockShortName}（${code}）配的息，是從哪一塊錢來的？`"
        :answer="chainAnswer"
      >
        <!-- 包在卡片裡（2026-09-26「公司這一年賣了多少 希望放在卡片中，這樣用戶才會知道底下的上下一步
             跟圖表一組的」）。標題、圖、說明、上一步／下一步本來就是同一個元件的四個部分，但散在區塊裡
             沒有邊界，按鈕讀起來像頁面層級的控制項而不是這張圖的。卡片就是那個邊界。 -->
        <!-- 這一句搬出卡片（2026-09-29「有點冗長，希望放在卡片外面不要占用說明的空間」）。它是整張圖
             的前提、不隨步驟變，放在卡片裡會跟每一步都在換的說明搶同一塊空間。 -->
        <p class="stock-dividend-source-page__analogy">說明以餐廳類比；圖上與文字裡的每個數字，都是這家公司自己的財報數字。</p>
        <el-card shadow="never" class="stock-dividend-source-page__chart-card">
        <StockDividendSegmentLine
          :roc-year="rocYear"
          :revenue-per-share="revenuePerShare"
          :gross-profit="grossProfit"
          :operating-income="operatingIncome"
          :eps="eps"
          :dividend-per-share="dividendPerShare"
          :operating-expense="operatingExpense"
          :other-operating-income="otherOperatingIncome"
          :research-expense="researchExpense"
        />
        </el-card>

      </StockQuestionSection>

      <!-- 表格有自己的 h2（2026-09-25「或許我想要的是給表格一個正當的 H2，並且表格本身的內容要完整
           涵蓋前面的五步驟拆解到的元素」）。它跟上面那一段問的不是同一件事：圖表問「配的息從哪來」，
           表格問「這一年實際上是多少」。而它的十三列現在完整涵蓋圖上九根長條，以及解釋那些長條需要的
           每一個科目（營業費用、其他營業收支、業外、所得稅、少數股東），不再只有七個轉折點。 -->
      <StockQuestionSection
        v-if="hasTable"
        id="stock-dividend-source-table"
        :question="`${stockShortName} ${code} ${rocYear === null ? '' : `${rocYear} 年度`}的損益表，每一段各是多少？`"
        :answer="prevRocYear === null
          ? '由上往下就是損益表自己的順序，每一列都是每股金額。'
          : `由上往下就是損益表自己的順序，每一列都是每股金額；右邊一欄是 ${prevRocYear} 年度的同一個數字，可以直接對照。`"
      >
      <!-- 不再收合（2026-09-25「表格就不要隱藏」）。它是這一頁唯一帶有這家公司自身數字的結構化
           資料——索引段那 28 個連結在 2000 多頁上逐字相同，這張表每頁都不同——而且它是全站檢查
           `ssrTables` 要求的那一個 data-ssr-table。收在 <details> 裡讀者多一個動作才看得到，
           而它本來就是這一段的內容而不是附錄。 -->
      <div class="stock-dividend-source-page__table">
        <SharedTableScroll :label="`${stockShortName} ${code} 從營收到配息的每一個環節`">
        <table class="seo-table" data-ssr-table>
          <!-- visually-hidden 不是刪掉（2026-09-25「想刪掉。但是想不到強化 SEO 的替代方案」）。
               caption 是表格的無障礙名稱，拿掉會讓螢幕閱讀器與爬蟲都少一段，而它在畫面上其實是
               多餘的——上面的 h2 已經說了這是什麼。main.css 的 .visually-hidden 就是為這件事存在的
               （「for screen readers and search engines rather than the visual layout」），
               StockFinancialHighlightsRisksCard.vue:336 已經是同一個寫法。
               既然沒有版面成本，就寫完整一點：把第三欄在做什麼也講出來。 -->
          <caption class="visually-hidden">{{ stockShortName }} {{ code }} {{ rocYear === null ? '' : `${rocYear} 年度` }}從營收一路分到股利，每一列是該環節的每股金額，以及它怎麼從上一列算出來</caption>
          <thead>
            <tr>
              <th scope="col"><span class="visually-hidden">運算</span></th>
              <th scope="col">項目</th>
              <th scope="col">{{ rocYear === null ? '每股金額（元）' : `${rocYear} 年度（元）` }}</th>
              <th v-if="prevRocYear !== null" scope="col">{{ prevRocYear }} 年度（元）</th>
              <th scope="col">怎麼來的</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="step in visibleSteps" :key="step.label">
              <td class="stock-dividend-source-page__op" aria-hidden="true">{{ step.op }}</td>
              <th scope="row">{{ step.label }}</th>
              <td class="seo-table__num">{{ step.value }}</td>
              <td v-if="prevRocYear !== null" class="seo-table__num">{{ step.prev }}</td>
              <td>{{ step.from }}</td>
            </tr>
          </tbody>
        </table>
        </SharedTableScroll>
      </div>
      </StockQuestionSection>

      <!-- 索引段。分組與順序跟圖上的五刀一致，讀者停在哪一步就在這裡找得到同一個標題。
           全部在 SSR 裡，所以它同時是上週那 16 個損益表 metric 頁的爬取路徑——它們目前不在側邊欄。 -->
      <StockQuestionSection
        id="stock-dividend-source-index"
        question="每一環還可以往下看什麼？"
        :answer="`把${stockShortName}這一年的損益表拆成五刀之後，每一刀底下還有各自的細節頁；下面照圖上的順序列出來。`"
      >
        <!-- 每個指標一句鉤子（2026-09-25「我總覺得都放文字總有哪些詭異，真的有人會看嗎？…假設我是用戶，
             我甚麼都不知道，才有機會繼續往下點選我好奇的那個項目」）。先前是 28 個裸連結排成五行——連結
             本身不會告訴一個什麼都不懂的人為什麼要點。
             形狀直接照 app/pages/rank/index.vue:37-42：連結一行、說明一行，grid 排版、無邊框無背景。
             那是這個站唯一「每一項配自己一句話」的既有寫法，而卡片式在這一頁是被否決過的。
             組標題用 h3 不是 strong：strong 只是視覺加粗，對輔助技術不是標題，而 h1→h2→h3 是
             check-stock-pages.mjs 的 outlineIsValid 允許的層級。 -->
        <div v-for="group in CHAIN_INDEX" :key="group.stage" class="stock-dividend-source-page__index-group">
          <h3 class="stock-dividend-source-page__index-stage">{{ group.stage }}</h3>
          <ul class="stock-dividend-source-page__index">
            <li v-for="link in group.links" :key="link.slug" class="stock-dividend-source-page__index-item">
              <NuxtLink :to="`/stock/${code}/${link.slug}`" class="stock-dividend-source-page__index-link">{{ link.label }}</NuxtLink>
              <span class="stock-dividend-source-page__index-hook">{{ link.hook }}</span>
            </li>
          </ul>
        </div>
      </StockQuestionSection>

      <StockPageDigest :digest="digest" />
    </template>

    <SharedStockNotFound v-else-if="!stockPending" />
  </div>
</template>

<style scoped>
.stock-dividend-source-page__analogy {
  margin: 0 0 8px;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

/* 形狀抄 app/pages/rank/index.vue:68-95，值也一樣——那是站上既有的「連結 ＋ 一行說明」清單。
   沒有邊框、沒有背景：卡片式在這一頁被明確否決過（「card-per-metric ＝ 畫面髒亂」）。
   min-height 48px 是這個站的觸控下限，沒有共用 class 可以重用（見本檔 summary 的同一條註解）。 */
/* 運算子欄。aria-hidden：「−」「＝」對螢幕閱讀器是雜訊，而每一列的算式在最後一欄用文字講完整了。 */
.stock-dividend-source-page__op {
  width: 1.5em;
  padding-inline-end: 0;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.stock-dividend-source-page__index-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stock-dividend-source-page__index-stage {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-dividend-source-page__index {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 12px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stock-dividend-source-page__index-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 48px;
}

.stock-dividend-source-page__index-link {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.stock-dividend-source-page__index-hook {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

</style>
