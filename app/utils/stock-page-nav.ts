import type { Component } from 'vue'
import { Filter, Grid, Odometer, Opportunity } from '@element-plus/icons-vue'

// 個股頁面與指標目錄的導覽資料（2026-09-20 從 StockPageNavList 抽出）。節點是葉（有 to）或群組（有 children、沒有 to）；群組只出現在
// STOCK_METRIC_INDEX（/stock/{code}/metrics），側邊欄的兩份清單都是平的。群組本身不是連結；母項自己有頁面時，那一頁是群組第一個
// 子項、用描述性標籤。視角詞彙是封閉的聯集型別，TypeScript 自己擋錯字。陣列順序就是渲染順序（metrics.vue 的分群刻意不排序）。
// **沒有「每股成長率」**（2026-09-27）：它跟成長率的差就是股數稀釋，拆成兩格會逼讀者靠記憶比對——實測 20 檔 79 期有 21.5% 的期別
// 差 > 1pp，7780 差到 117.5pp；兩條線畫在同一頁（metric-pages.ts 的 compareMetricCode）。
export type MetricPerspective =
  | '組成' | '每股' | '成長率' | '佔比'
  | '倍數' | '天數' | '報酬率' | '相對股價' | '原始報表'

export interface StockNavNode {
  label: string
  to?: (code: string) => string
  children?: StockNavNode[]
  // STOCK_METRIC_INDEX 專用，側邊欄不讀。hook 是一句白話，回答「我什麼都不懂，為什麼要點這個」。
  //
  // `question` 在 2026-09-27 刪掉了。它存在的唯一理由是舊的問句分類（「這家公司賺不賺錢？」當
  // <h2>），而那正是這次改版捨棄的東西：問句分類把同一個財報科目拆散在不同問句底下——淨值相關的
  // 目的地曾經散在市場估值、獲利能力、成長動能三組，讀者想「把淨值看完」時沒有一個地方可以去。
  answer?: string
  hook?: string
  // 視角：同一個財報科目的不同看法（2026-09-27「以淨值為母項，底下再區分出 組成 成長率 每股
  // 每股成長率 等等，這樣每個指標就可以收斂到類似結構」）。只有 STOCK_METRIC_INDEX 的 leaf 會設。
  //
  // 分類規則一句話：**比率歸到分子的那個科目，視角是「用什麼當分母／做了什麼變換」**。所以每股研發
  // 費用（每股）與研發費用率（佔比）第一次進到同一個母項——這兩支原本分屬「損益表拆解」與「成長
  // 動能」，是舊分類最明顯的破口。
  perspective?: MetricPerspective
  // 排在「自選指標」那一段**後面**（2026-09-28「全部指標放到 我釘的指標 下面」）。用旗標而不是靠
  // 陣列位置，是因為位置的寫法會在有人新增第四個固定列時靜靜地把新的那一列變成墊底的那一個，
  // 而那個錯誤不會有任何訊號。側邊欄以外的消費者（activeLabelFor）整份走訪，不看順序。
  trailing?: true
  // 只有第一層有 icon（2026-09-21「Sidebar 最上層母項目希望可以加上 icon」），純裝飾、aria-hidden。2026-09-26 換掉四個（「有幾個
  // 識別度沒這麼高」），判準是 18px 下的輪廓不是語意：Connection→Filter（漏斗＝那一頁瀑布圖的形狀）、Checked→PieChart（獲利品質問的
  // 是占比）、Promotion 刪除（紙飛機＝傳送）、TrendCharts 移到成長動能、獲利能力改 Histogram；試過 Money／Wallet／Stamp 都退掉。
  // 現在十個輪廓互不重疊：燈泡／漏斗／日曆／三直柱／圓餅／折線／鎖／硬幣堆／標籤／文件——再加第一層項目時先確認不撞形。
  icon?: Component
}

// 2026-09-26：側邊欄只留固定幾列，其餘目的地搬到 /stock/{code}/metrics 目錄頁（STOCK_METRIC_INDEX），使用者再從那裡釘回側邊欄
// （useStockPinnedMetrics）。第一層列數上限是硬的：手機抽屜 60dvh、48px 一列，約 10 列就滿——要新增第一層列之前先量那個高度。
// 損益表那條鏈的 16 頁刻意不進側邊欄：讀者是在 /dividend-source 的表格上看到某一列才起了好奇心，那一頁的 28 個鉤子就是入口；
// 路由、sitemap、canonical 全部沒動（同葛拉漢倍數／PEG／指標歷史的 nav-entry-out 拆法）。
export const STOCK_NAV_ITEMS: StockNavNode[] = [
  { label: '亮點與風險', icon: Opportunity, to: code => `/stock/${code}` },
  // 配息從哪來 2026-09-24（「亮點與風險下面加一個…從現金殖利率倒推回營收的每個環節」）：原本 /dividend 上的「股息從哪裡來」搬過來，
  // 它沒有錯，只是讓殖利率那一頁扛了兩個主題。放第一層而不是配股配息的子項：它走的鏈橫跨配股配息→獲利能力→財報三率→成長動能，
  // 歸在任何一組都只命名了第一步。這條鏈是恆等式不是相關性（2330 2026Q2：每股營收 171.23 × 稅後淨利率 50.38% = EPS 86.27，
  // × 盈餘發放率 23.76% = 每股股利 20.50，閉合到分），所以在投信投顧法下說得出口；頁上沒有任何預測。
  { label: '配息從哪來', icon: Filter, to: code => `/stock/${code}/dividend-source` },
  // 指標速覽（2026-10-07「指標速覽請放在配息從哪來的下面」）：自選指標的最新數值一頁看完。
  { label: '指標速覽', icon: Odometer, to: code => `/stock/${code}/quick-view` },
  // 月營收 2026-09-28 從固定列移除（b1a093d 之後它在 STOCK_METRIC_INDEX 裡可以被釘選，固定給所有人不如讓想看的人自己釘）。
  // 2026-09-26 第二刀（「Sidebar 塞了這麼多面向還是太雜亂了…開一個頁面專門找尋這幾類指標」）：側邊欄和目錄是兩件事，側邊欄只回答
  // 「我現在在哪、旁邊還有什麼」，永遠三到四列；七組整批搬到 STOCK_METRIC_INDEX 由 /stock/{code}/metrics 渲染，分類與理由都保留。
  // 全部指標放在自選指標下面：它是出口不是入口。2026-10-07 改名「指標總覽」（使用者指示），跟那一頁的 TOPIC 同名。
  { label: '指標總覽', icon: Grid, to: code => `/stock/${code}/metrics`, trailing: true },
]

// 個股指標目錄，/stock/{code}/metrics 專用。節點多兩個欄位：group.question（那一段的 <h2>，用讀者的問題不用行話）、leaf.hook
//（一句白話，高中生聽得懂為準）。葛拉漢倍數／PEG／F-Score 刻意不在（「更忠於財報，避免複合運算」），入口是徽章表。
// 11 個母項 × 視角（2026-09-27 重排，取代 09-26 的 9 組問句分類——那套好讀但把同一個財報科目拆散在不同問句下，淨值散在三組）。
// 規則：**母項是這個指標在問哪一個主體，視角是「用什麼當分母／做了什麼變換」**。「主體」是逐支的判斷不是機械規則——第一版寫成
// 「歸到分子的科目」，對 22 支比率有 7 支不成立（roe／roa 分子是淨利、流動比率分子是流動資產、保障倍數分子是 FCF），改成分母也
// 不成立；比率的主體有時是分子有時是分母，問的是「讀者拿這個數字在問什麼」。
// 退休的舊規則：組名不再跟 GET /metrics 的 category 對齊——型錄按問題領域分、母項按財報科目分，本來就不同構；代價是多一份人工對照。
// 排序（2026-09-28）：股價倍數 → 股利 → 資本報酬 → 本業損益 → 業外損益 → 盈餘 → 現金流 → 營運資金 → 淨值 → 償債能力 → 原始財報
// ——先給答案再給推導（退休族最先問的是「分我多少」「用得好不好」，原本排第九第十要捲到底）；股價倍數第一（2026-09-26 使用者指定）。
// 命名一律 2–4 字名詞不帶標點；關係頁（dupont／margins／solvency／cash-cycle／equity-source）固定拿視角「組成」排母項第一列。
export const STOCK_METRIC_INDEX: StockNavNode[] = [
  // 分子是**股價**不是財報科目，所以自成一組（它們共用型錄的 EOD-only 資料牆，見 METRIC_PAGES 為何指向 peRatio／pbRatio）。
  // 葛拉漢倍數與 PEG 2026-09-21 移出導覽（「更忠於財報，避免複合運算、徽章性質遠勝於指標性質的」）：PER×PBR 比 22.5、PER÷成長率
  // 比 1 都是「比率的比率、為了跟一條規則比而存在」；PER／PBR／PSR 是股價÷一個申報數字，離報表一步，留下。那兩頁連同 /f-score
  // 2026-09-28 連路由一起刪（「徽章不要歷史，有歷史的只有指標」），徽章表那三列改開對話框。
  {
    label: '股價倍數',
    answer: '同樣一個股價，除以獲利、除以帳面家底、除以營業額，會得到三個不一樣的倍數。虧錢的公司算不出本益比，那時候另外兩個還在。',
    children: [
      { label: '本益比', perspective: '相對股價', to: code => `/stock/${code}/pe-ratio`, hook: '用現在的股價買，要幾年的獲利才回本' },
      { label: '股價淨值比', perspective: '相對股價', to: code => `/stock/${code}/pb-ratio`, hook: '現在的股價，是公司帳面家底的幾倍' },
      { label: '股價營收比', perspective: '相對股價', to: code => `/stock/${code}/psr`, hook: '現在的市值，是一年營業額的幾倍' }
    ]
  },
  // 股利：分子是發出去的錢，殖利率（÷股價）、發放率（÷盈餘）、保障倍數（÷現金流）分母各異都歸這裡。填權填息不是股利的變換而是
  // 除息後的股價，視角是相對股價。殖利率（dividendYield）沒有自己的頁：只有 EOD 快照、沒有 TTM/Q/FY 數列，需求已送 analysis-ts。
  {
    label: '股利',
    answer: '公司把賺到的錢分多少出來，以及那些錢相對股價、相對盈餘、相對現金流各是多少。',
    children: [
      { label: '盈餘發放率', perspective: '佔比', to: code => `/stock/${code}/dividend-payout-ratio`, hook: '這一年賺的錢，發了幾成出去' },
      { label: '現金流量股利保障倍數', perspective: '倍數', to: code => `/stock/${code}/dividend-coverage-ratio`, hook: '賺到的現金夠不夠支撐這次配息' },
      { label: '殖利率', perspective: '相對股價', to: code => `/stock/${code}/dividend`, hook: '用今天的股價買進，一年可以領回幾 %' },
      // 填權填息 2026-09-24（「配股配息底下 新增一個填權填息，把現在現金殖利率的部分資訊搬過去」）
      { label: '填權填息', perspective: '相對股價', to: code => `/stock/${code}/dividend-fill`, hook: '除息之後股價有沒有漲回來。領到股利不等於賺到，差別在這裡' },
      { label: '股東總回饋率', perspective: '相對股價', to: code => `/stock/${code}/shareholder-yield`, hook: '除了現金股利，公司買回自己的股票也算還錢給股東' }
    ]
  },
  // 資本報酬率。四支是同一個問題的四個版本——**用什麼當分母**——放在一起讀者才看得出那是一組刻度，
  // 不是四個獨立指標（2026-09-26 建立這條理由時就是這樣寫的，這次原樣保留）。
  //
  // 杜邦分析放這裡而不是盈餘：它拆的是 ROE。五個因子橫跨型錄三個類別（淨利率在獲利能力、資產週轉
  // 在營運效率、權益乘數在安全韌性），那個橫跨正是這一頁的主題而不是歸檔問題。
  {
    label: '資本報酬',
    answer: '同樣一筆獲利，除以股東的錢、除以全部資產、除以真正投入營運的資本，會得到不一樣的報酬率。差別在分母。',
    children: [
      { label: '杜邦分析', perspective: '組成', to: code => `/stock/${code}/dupont`, hook: '把 ROE 拆成三塊，看賺錢靠的是本業、週轉，還是借錢' },
      { label: 'ROE', perspective: '報酬率', to: code => `/stock/${code}/roe`, hook: '股東放進去的錢，一年幫你賺回幾 %' },
      { label: '資產報酬率', perspective: '報酬率', to: code => `/stock/${code}/roa`, hook: '每動用一元資產賺回幾 %，不管那筆錢是股東出的還是借的' },
      { label: '投入資本報酬率', perspective: '報酬率', to: code => `/stock/${code}/roic`, hook: '扣掉沒在營運的閒置現金之後，真正投入的錢賺回幾 %' },
    ]
  },
  // 損益表：營收到營業利益，順序是損益表自己的由上往下——遞減本身就是概念。舊版 16 個每股科目一整組，2026-09-27 拆成這一組（13 支、
  // 連續的刀口）與業外損益（6 支雜項），稅前／所得稅移進盈餘。三率的關係拿「組成」：唯一同時顯示三個比率並講它們之間間隙的頁。
  // 每股研發費用與研發費用率第一次同組（舊版分屬損益表拆解與成長動能）。label 與 hook 沿用 CHAIN_INDEX 的，不重寫。
  {
    label: '本業損益',
    answer: '從營收開始，一刀一刀往下扣。想看它們串起來的樣子，配息從哪來那一頁有整張圖。',
    children: [
      { label: '三率的關係', perspective: '組成', to: code => `/stock/${code}/margins`, hook: '三個比率一起看，錢是在哪一關被吃掉的' },
      // 月營收（2026-09-28「月營收 也要從 metrics 可以被釘選」）。同一天它從側邊欄的固定列拿掉了
      // （「月營收從 sidebar 固定的部分移除」），所以這裡是它唯一的入口——想看的人自己釘，不再有
      // 固定區與我釘的指標各出現一次的重複。
      //
      // 沒有 perspective：它是月頻的營收金額，不是每股／成長率／佔比任何一種。欄位是選填的，而視角
      // 2026-09-28 起也不顯示在畫面上，所以留空不會造成版面缺口。
      { label: '月營收', to: code => `/stock/${code}/monthly-revenue`, hook: '每月 10 日前公告，是一家公司當期營運最早出現的數字' },
      { label: '每股營收', perspective: '每股', to: code => `/stock/${code}/revenue-per-share`, hook: '這一年每一股對應到多少營業額' },
      { label: '每股營業成本', perspective: '每股', to: code => `/stock/${code}/cost-of-goods-sold`, hook: '做出產品本身花了多少，原料漲價會先反映在這裡' },
      { label: '每股毛利', perspective: '每股', to: code => `/stock/${code}/gross-profit`, hook: '賣掉之後扣掉成本，還剩下多少' },
      // hook 講出那一頁有拆解（2026-09-28「metrics 哪裡有費用組成」）。原本寫「賣東西和管理公司花的錢，
      // 跟做出產品本身無關」——正確但沒有指出那一頁比下面三列多了什麼，於是讀者會一列一列點進去看三個
      // 數字，而它們在母項那一頁是同一張圖。不用「組成」這個詞（2026-09-27 已從這一頁的視角標籤移除）。
      { label: '每股營業費用', perspective: '每股', to: code => `/stock/${code}/operating-expense`, hook: '賣東西和管理公司花的錢。這一頁把它拆開，看推銷、管理、研發各佔多少' },
      { label: '每股推銷費用', perspective: '每股', to: code => `/stock/${code}/selling-expense`, hook: '廣告、通路、業務團隊的錢' },
      { label: '每股管理費用', perspective: '每股', to: code => `/stock/${code}/administrative-expense`, hook: '總部、人事、法務這些後勤的錢' },
      { label: '每股研發費用', perspective: '每股', to: code => `/stock/${code}/rd-expense`, hook: '投入新產品的錢。想知道公司為以後準備了多少，看這個' },
      { label: '每股營業利益', perspective: '每股', to: code => `/stock/${code}/operating-income`, hook: '本業做完一輪之後真正賺到的' },
      { label: '單季營收成長年增率', perspective: '成長率', to: code => `/stock/${code}/revenue-growth`, hook: '這一季的營收，比去年同一季多了幾 %' },
      { label: '毛利率', perspective: '佔比', to: code => `/stock/${code}/gross-margin`, hook: '同樣賣一百元，扣掉成本後留下幾元' },
      { label: '營業利益率', perspective: '佔比', to: code => `/stock/${code}/operating-margin`, hook: '本業每一百元營業額，最後留下幾元' },
      { label: '研發費用率', perspective: '佔比', to: code => `/stock/${code}/rd-intensity`, hook: '研發佔營業額的比率。要跨公司比較投入程度，用比率' }
    ]
  },
  // 業外損益。六支全是「每股」，所以 metrics.vue 不會替它渲染視角標題列（單一視角時省略）。
  //
  // 每股利息收入與每股財務成本的主體看起來像現金與負債，但它們是**損益表的每股科目**，分子在損益表
  // 上，所以留在這裡而不是搬去現金流或負債。
  {
    label: '業外損益',
    answer: '不是本業賺的那一塊。想知道獲利有多少不靠本業，看這一組。',
    children: [
      { label: '每股業外損益', perspective: '每股', to: code => `/stock/${code}/non-operating-income`, hook: '不是本業賺的那一塊。想知道獲利有多少不靠本業，看這個' },
      { label: '業外損益占稅前淨利比', perspective: '佔比', to: code => `/stock/${code}/non-operating-income-ratio`, hook: '這一季的稅前獲利裡，有多少比例不是本業賺的' },
      { label: '每股利息收入', perspective: '每股', to: code => `/stock/${code}/interest-income`, hook: '帳上現金存著、借出去，收到的利息' },
      { label: '每股財務成本', perspective: '每股', to: code => `/stock/${code}/finance-cost`, hook: '借錢要付的利息。想知道負債壓力多大，從這裡看' },
      { label: '每股其他收入', perspective: '每股', to: code => `/stock/${code}/other-income`, hook: '零星的其他進帳' },
      { label: '每股其他利益及損失', perspective: '每股', to: code => `/stock/${code}/other-gains-losses`, hook: '匯兌、資產評價、處分這些一次性的損益' },
      { label: '每股權益法投資損益', perspective: '每股', to: code => `/stock/${code}/equity-method-income`, hook: '轉投資的公司分回來的損益' }
    ]
  },
  // 盈餘。每股稅前淨利與每股所得稅費用從舊的「損益表拆解」搬過來：它們的分子就是盈餘的上下游，
  // 而損益表那條鏈在本業損益／業外損益只留到營業利益與業外，稅前與稅後屬於這裡。
  //
  // 淨利成長年增率同時承載每股盈餘成長年增率（hub-slugs.ts 的 compareMetricCode），兩條線畫在
  // 同一頁，差額就是股數稀釋。所以這個母項沒有「每股成長率」那一格。
  {
    label: '盈餘',
    answer: '公司賺了多少，以及那些錢分到每一股是多少。成長率那一頁同時畫總額與每股兩條線，差額就是股數稀釋。',
    children: [
      { label: '每股盈餘', perspective: '每股', to: code => `/stock/${code}/eps`, hook: '每一股賺多少，新聞上最常講的那個數字' },
      { label: '每股稅前淨利', perspective: '每股', to: code => `/stock/${code}/pretax-income`, hook: '繳稅之前的獲利' },
      { label: '每股所得稅費用', perspective: '每股', to: code => `/stock/${code}/income-tax-expense`, hook: '這一年繳了多少稅。有時候是負的，那是所得稅利益' },
      { label: '淨利成長年增率', perspective: '成長率', to: code => `/stock/${code}/net-income-growth`, hook: '營收成長不一定等於獲利成長，這一項看的是後者' },
      { label: '稅後淨利率', perspective: '佔比', to: code => `/stock/${code}/net-profit-margin`, hook: '營業額最後有幾成變成獲利' }
    ]
  },
  // 現金流：五支全是佔比，分母各不相同，寫在 label 與 hook 裡。資本支出佔營收比的分子是現金流量表科目，掛在這裡（METRIC_PAGES 記錄
  // 的唯一分類例外）。**這個母項還沒有「組成」頁**：營業／投資／融資三段卡在上游——investing 在 40 檔裡 30 檔 null（2026-09-27 實測，
  // mops 欄位 9/07 才擴充），114Q4 另有單季推導 bug（null 當 0，單季裝的是全年累計），都已回報。等原生欄位，不用恆等式推第三段：
  // 推出來的第三段讓恆等式必然成立，圖就驗不出東西了。
  {
    label: '現金流',
    answer: '帳上的獲利有多少變成真的現金。利潤是算出來的，現金是收到的，下面每一項都在量這兩者差多遠。',
    children: [
      { label: '營業現金流對淨利比', perspective: '佔比', to: code => `/stock/${code}/ocf-to-net-income`, hook: '帳面賺一元，實際收到幾元現金' },
      { label: '自由現金流轉換率', perspective: '佔比', to: code => `/stock/${code}/fcf-conversion-rate`, hook: '扣掉買設備的錢之後，還剩多少可以自由運用' },
      { label: '營業現金流利潤率', perspective: '佔比', to: code => `/stock/${code}/ocf-margin`, hook: '每一百元營業額，變成本業現金的有幾元' },
      { label: '應計項目比率', perspective: '佔比', to: code => `/stock/${code}/accruals-ratio`, hook: '獲利裡有多少還只是帳上的數字，錢沒真的收到' },
      { label: '資本支出佔營收比', perspective: '佔比', to: code => `/stock/${code}/capex-to-revenue`, hook: '把多少錢拿去買設備蓋廠房。那些錢就不會變成股利' }
    ]
  },
  // 營運資金。六支是一條恆等鏈，可以自己驗算（2330 TTM 實測閉合到分）：
  //   存貨天數 ＋ 收現天數 ＝ 營運週期
  //   營運週期 − 付現天數 ＝ 現金轉換循環
  // 這跟損益表那條鏈是同一種東西，也是它在本站說得出口的原因——本站不做評等，能講的是「這些數字
  // 之間的關係是什麼」，而關係要真的成立才講得下去。
  //
  // 同分類另外 10 支沒有納入：GET /metrics 上沒有 description，沒有文案就不開頁。
  {
    label: '營運資金',
    answer: '貨進來、賣掉、收到錢，這一趟叫營運週期。扣掉可以晚點再付給供應商的那幾天，剩下的才是公司自己要墊的。',
    children: [
      { label: '現金循環的組成', perspective: '組成', to: code => `/stock/${code}/cash-cycle`, hook: '三個天數怎麼加減出營運週期和現金轉換循環' },
      { label: '每股現金及約當現金', perspective: '每股', to: code => `/stock/${code}/cash-per-share`, hook: '季末那一天，每一股背後公司手上有多少現金' },
      { label: '存貨占營收比', perspective: '佔比', to: code => `/stock/${code}/inventory-to-revenue`, hook: '倉庫裡的貨，大約等於一年營收的幾成' },
      { label: '存貨週轉天數', perspective: '天數', to: code => `/stock/${code}/inventory-days`, hook: '貨平均要在倉庫放幾天才賣出去' },
      { label: '應收帳款收現天數', perspective: '天數', to: code => `/stock/${code}/receivables-days`, hook: '東西賣出去之後，平均等幾天才收到錢' },
      { label: '應付帳款付現天數', perspective: '天數', to: code => `/stock/${code}/payables-days`, hook: '跟供應商買了東西，平均過幾天才付錢' },
      { label: '營運週期', perspective: '天數', to: code => `/stock/${code}/operating-cycle`, hook: '從進貨、賣出去到收回貨款，整趟要幾天' },
      { label: '現金轉換循環', perspective: '天數', to: code => `/stock/${code}/cash-conversion-cycle`, hook: '錢被卡住幾天。營運週期減掉可以晚一點付的那幾天' }
    ]
  },
  // 淨值。這一組剛好就是 2026-09-27 那句話舉的例子（「以淨值為母項，底下再區分出 組成 成長率 每股
  // 每股成長率 等等」），一個不多一個不少——每股成長率併進成長率（見 MetricPerspective 的註解）。
  //
  // 股價淨值比與 ROE 刻意**不**放這裡：前者問的是價格（股價倍數），後者問的是「這些錢用得好不好」（資本報酬）。
  // 歸類看的是讀者在問什麼，不是名字裡有沒有「淨值」。
  {
    label: '淨值',
    answer: '股東在這家公司帳面上的家底。它是股東投進來的，還是公司自己賺回來累積的，組成那一頁拆給你看。',
    children: [
      { label: '淨值從哪來', perspective: '組成', to: code => `/stock/${code}/equity-source`, hook: '淨值是股東投的還是公司賺的，逐年怎麼變' },
      { label: '每股淨值', perspective: '每股', to: code => `/stock/${code}/bvps`, hook: '每一股背後有多少帳面家底' },
      { label: '淨值成長年增率', perspective: '成長率', to: code => `/stock/${code}/equity-growth`, hook: '賺來的錢留在公司多少，會累積在這裡' }
    ]
  },
  // 負債與償債。成員沿用 2026-09-21 對型錄 25 支做過的「更忠於財報」篩選：四支迴歸分數（Altman Z /
  // Z″ / Ohlson O / Zmijewski）是複合徽章構造，五支銀行專用資本適足率在約 95% 的代號上不適用，
  // 數列只有一期深的也不收。剩下的是一步之遙的報表比率。
  {
    label: '償債能力',
    answer: '還得出錢嗎，跟借得多不多，是兩件事。流動比率和速動比率答前面那個，負債比率和利息保障倍數答後面那個。',
    children: [
      { label: '安全韌性的組成', perspective: '組成', to: code => `/stock/${code}/solvency`, hook: '這幾個比率一起看，公司的還債能力長什麼樣' },
      { label: '負債比率', perspective: '佔比', to: code => `/stock/${code}/debt-ratio`, hook: '公司的資產裡，有幾成是借來的' },
      { label: '負債組成', perspective: '組成', to: code => `/stock/${code}/debt-composition`, hook: '借來的錢裡，一年內要還的占多少' },
      { label: '流動比率', perspective: '倍數', to: code => `/stock/${code}/current-ratio`, hook: '一年內要還的錢，手上一年內能變現的資產夠不夠' },
      { label: '速動比率', perspective: '倍數', to: code => `/stock/${code}/quick-ratio`, hook: '同上，但不把還沒賣掉的存貨算進去' },
      { label: '有息負債權益比', perspective: '倍數', to: code => `/stock/${code}/interest-bearing-debt-to-equity`, hook: '要付利息的債，相當於股東資本的幾倍' },
      { label: '長期負債對淨流動資產比', perspective: '倍數', to: code => `/stock/${code}/long-term-debt-to-net-current-assets`, hook: '長期的債，短期資產扛不扛得住' },
      { label: '利息保障倍數', perspective: '倍數', to: code => `/stock/${code}/interest-coverage`, hook: '一年賺的錢，夠付幾次利息' }
    ]
  },
  // 原始財報墊底：上面每一個比率都是從這三張表算出來的，要自己核對從這裡進去。這四頁不是指標，
  // 所以視角是「原始報表」——封閉集合裡只有這一個母項用得到那個字。
  //
  // 指標歷史 2026-09-20 隱藏、2026-10-06 回來（「metrics-history 希望多一個入口」），放進原始財報當第一
  // 個子項而不是自成一列：它是把十幾個指標逐年攤開的核對表，跟下面三張報表同一種用途。放在這裡也讓它
  // 可以被釘到側邊欄。另外兩個入口仍在 dividend.vue 與 financial-statements.vue 的內文。
  {
    label: '原始財報',
    answer: '上面那些比率都是從這三張表算出來的。要自己核對，從這裡進去。',
    children: [
      { label: '指標歷史', perspective: '原始報表', to: code => `/stock/${code}/metrics-history`, hook: 'EPS、ROE、毛利率等十幾個指標，逐年排在同一張表' },
      { label: '瀏覽任意季度', perspective: '原始報表', to: code => `/stock/${code}/financial-statements`, hook: '自己挑年度和季別，看那一期的三張表' },
      { label: '資產負債表', perspective: '原始報表', to: code => `/stock/${code}/balance-sheet`, hook: '公司當下有什麼、欠什麼，剩下多少是股東的' },
      { label: '損益表', perspective: '原始報表', to: code => `/stock/${code}/income-statement`, hook: '這一期賣了多少、花了多少，最後賺多少' },
      { label: '現金流量表', perspective: '原始報表', to: code => `/stock/${code}/cash-flow-statement`, hook: '錢實際從哪裡進來、往哪裡出去' }
    ]
  }

]

// slug → 指標目錄裡的那個節點，給釘選用（useStockPinnedMetrics.ts）。
//
// slug 從節點自己的 `to` 推出來而不是在資料裡再寫一次：`to` 已經是那一頁位址的唯一來源，多存一份 slug
// 就是多一個會跟它對不上的地方。用一個不可能出現在真實路徑裡的代號當參數，取最後一段。
export const METRIC_INDEX_BY_SLUG: ReadonlyMap<string, StockNavNode> = (() => {
  const map = new Map<string, StockNavNode>()
  const walk = (nodes: StockNavNode[]) => {
    for (const node of nodes) {
      if (node.children) { walk(node.children); continue }
      const slug = node.to?.('_')?.split('/').pop()
      if (slug) map.set(slug, node)
    }
  }
  walk(STOCK_METRIC_INDEX)
  return map
})()

// The label of the leaf the reader is currently on — what the phone nav's collapsed bar shows so
// the bar says where you ARE, not just that a menu exists（2026-09-23）. Returns null on a path
// this nav doesn't list（/f-score while it's a pilot, or an unknown sub-page）, and the bar then
// falls back to a plain「其他頁面」rather than inventing a location.
export function activeLabelFor(nodes: StockNavNode[], code: string, path: string): string | null {
  for (const node of nodes) {
    if (node.children) {
      const hit = activeLabelFor(node.children, code, path)
      if (hit) return hit
    } else if (node.to?.(code) === path) {
      return node.label
    }
  }
  return null
}
