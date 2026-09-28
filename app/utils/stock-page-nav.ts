import type { Component } from 'vue'
import { Coin, Document, Filter, Grid, Histogram, Lock, Odometer, Opportunity, PieChart, PriceTag, Sort, TrendCharts } from '@element-plus/icons-vue'

// The 個股頁面 nav tree. Extracted out of StockPageNavList.vue 2026-09-20 so the recursive node
// component (StockPageNavNode.vue) and the list itself can share the type without importing each
// other in a cycle.
//
// A node is either a LEAF (has `to`, no children) or a GROUP (has children, no `to`). A group is
// deliberately not also a link: el-sub-menu's title is its expand/collapse control, so making it
// navigate too would put two actions on one target. Where the parent has a real page of its own,
// that page becomes the group's FIRST child under its own descriptive label — see 財務報表 below,
// where「瀏覽任意季度」actually describes that page better than repeating the group name would.
// 視角詞彙是封閉集合——聯集型別讓 TypeScript 自己擋掉錯字，不必再寫一支檢查腳本。陣列順序就是
// 渲染順序，所以 STOCK_METRIC_INDEX 的資料要照這個順序寫；沒照寫的結果是同一個視角標題出現兩次，
// 看得見、無害、改資料就好，所以 metrics.vue 的分群刻意不排序。
//
// **沒有「每股成長率」**（2026-09-27「我在想每股成長率是不是跟成長率合併就好，或是看怎麼呈現，
// 來看出股本稀釋造成的差異」）。它跟「成長率」的差就是股數稀釋，拆成兩格會逼讀者靠記憶比對，而那個
// 差正是最該一眼看到的東西——實測 20 檔 79 期有 21.5% 的期別差 > 1pp，7780 差到 117.5pp（公司淨值
// 成長 353%，股東每股只成長 236%）。兩條線畫在同一頁，見 hub-slugs.ts 的 compareMetricCode。
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
  // Set on the TOP-LEVEL rows only（2026-09-21,「Sidebar 最上層母項目 希望可以加上icon」）— a nested
  // row simply leaves it undefined and StockPageNavNode renders nothing, so "top level only" is
  // expressed by where the value is set rather than by a depth prop threaded through the recursion.
  //
  // 亮點與風險 gets one too although it is a LEAF, not a 母項目: it is the only top-level row that
  // isn't a group, and leaving it as the one unindented row in a column of five icons would read
  // as a rendering fault rather than a distinction.
  //
  // Purely decorative — every row's own text label is right beside it, so StockPageNavNode marks
  // these aria-hidden and the link's accessible name is unchanged.
  //
  // 2026-09-26 換掉四個（「sidebar的icons請再調整一下，有幾個識別度沒這麼高」）。判準是 18px 下的
  // 輪廓，不是名字的語意 —— 十列並排時讀者是用形狀在掃，不是在讀圖示的意思。實際渲染出來看過才換：
  //   * Connection（兩個交纏的環）→ Filter 漏斗。原本讀起來是「分享／連結」，而漏斗就是那一頁瀑布
  //     圖的形狀：營收一路漏到股利。
  //   * Checked（剪貼板打勾）→ PieChart 圓餅。打勾是通用的「已檢查」，跟這一組無關；圓餅對題，因為
  //     獲利品質問的就是「淨利裡有多少變成現金」，本來就是占比。
  //   * Promotion（紙飛機）→ 刪除。紙飛機在 UI 慣例裡是「傳送」。
  //   * TrendCharts 從獲利能力移到成長動能，獲利能力改用 Histogram。上升的折線本來就是成長，擺在
  //     獲利能力是錯位；長條圖的量感對應「賺多少」，而且三根實心直柱是這一排最好認的輪廓。
  // 中途試過 Money／Wallet（兩個都是弱矩形，跟 Document 在 18px 下互相糊）和 Stamp（印章在小尺寸
  // 下讀起來像使用者頭像），都退掉了。現在十個輪廓互不重疊：燈泡／漏斗／日曆／三直柱／圓餅／折線／
  // 鎖／硬幣堆／標籤／文件。再加第一層項目時，先確認新圖示的輪廓沒有跟這十個之一撞形。
  icon?: Component
}

// 2026-09-26：parked 的六組全部放回來，同時 StockPageNavList 的 el-menu 加上 unique-opened。
// 這兩件事是同一個決定的兩面，不要只留其中一個。
//
// 問題從來不是分類錯，是展開行為。每個代號底下有 59 個目的地，而手機版的 <details> 抽屜是
// 60dvh、48px 一列，約 10 列就滿了 —— 六組同時展開＝40 列牆，2026-09-25 的反應是把六組整批藏
// 起來，那是在治症狀。unique-opened 讓同一層一次只展開一組，而 openGroupsFor 本來就會展開「你
// 現在所在的那一組」，所以任何一頁看到的是：10 列骨幹 ＋ 自己的鄰居，最多 18 列。
//
// 因此第一層的列數上限是硬的：收合狀態不得超過手機抽屜裝得下的高度。要新增第一層組別之前，先
// 量那個高度，不要先加了再說。
//
// 兩列 2026-09-25 暫放第一層的項目在這次歸位（當時的註解自己寫明「neither is a permanent
// top-level subject… while the categories are being rebuilt」，重建就是這次）：
//   * 毛利率 → 獲利能力／財報三率。它字面上就是三率之一，而且原本同時存在於兩個陣列，不處理會
//     產生重複目的地。
//   * 每股營業成本 → 移出導覽。它是損益表那條鏈的 16 頁之一，而整條鏈這次決定不進 sidebar：沒有
//     人會在選單裡「找」每股其他利益及損失，讀者是在 /dividend-source 的表格上看到某一列才起了
//     好奇心。那一頁的「每一環還可以往下看什麼？」28 個鉤子就是這 16 頁的入口。路由、sitemap、
//     canonical 全部沒動，跟葛拉漢倍數／PEG／指標歷史 走的是同一條 nav-entry-out 拆法。
export const STOCK_NAV_ITEMS: StockNavNode[] = [
  { label: '亮點與風險', icon: Opportunity, to: code => `/stock/${code}` },
  // 配息從哪來 2026-09-24（「sidebar 亮點與風險下面加一個…我這一頁要放從現金殖利率倒推回營收的每
  // 個環節」, named「對 本質上是股息從哪來 找回來 然後改名成 配息從哪來」）. The 股息從哪裡來 section
  // deleted from /dividend earlier the same day comes back here — it was never wrong, it was on a
  // page whose subject was「殖利率是多少」and made that page carry two subjects.
  //
  // A TOP-LEVEL LEAF rather than a child of 配股配息, although its subject starts there, because
  // the chain it walks ends in 營收: it crosses 配股配息 → 獲利能力 → 財報三率 → 成長動能, i.e. four
  // of the groups below. Filing it under any one of them would name it after its first step. It is
  // the second row with an icon-and-no-children for the same reason 亮點與風險 above has one.
  //
  // The chain is a chain of IDENTITIES, not of correlations, which is what makes the page sayable
  // at all under 投信投顧法 — verified against live data before building（2330 2026Q2: 每股營收
  // 171.23 × 稅後淨利率 50.38% = EPS 86.27, and 86.27 × 盈餘發放率 23.76% = 每股股利 20.50, both to
  // the cent）. Nothing on it predicts a future figure.
  { label: '配息從哪來', icon: Filter, to: code => `/stock/${code}/dividend-source` },
  // 月營收 2026-09-28 從固定四列移除（「月營收從 sidebar 固定的部分移除」）。它 2026-09-25 才放回
  // 第一層，理由是「最早出現的數字」——那個理由沒有變，變的是 b1a093d 之後它在 STOCK_METRIC_INDEX
  // 裡可以被釘選。固定一列給所有人，跟讓想看的人自己釘，後者不佔滿那幾列的預算。
  // 2026-09-26 第二刀（「Sidebar 塞了這麼多面向還是太雜亂了。我需要把這些東西從 sidebar 移除，開一
  // 個頁面專門找尋這幾類指標」）。同一天早上才把六組放回來、加上 unique-opened，收合 10 列、展開最多
  // 18 列——數字上成立，看起來仍然雜亂。使用者看了實品才下的判斷，所以這裡不是推翻上一個決定，是上一個
  // 決定讓真正的問題露出來：**側邊欄和目錄是兩件事**，一個元件同時做只會兩邊都做不好。
  //
  // 側邊欄從此只回答「我現在在哪、旁邊還有什麼」，永遠三到四列。那七組整批搬到下面的 STOCK_METRIC_INDEX，
  // 由 /stock/{code}/metrics 這一頁渲染成「問句 h2 ＋ 一張表」——分類全部保留，連同每一組當初為什麼這樣
  // 分的註解，換的只是呈現的地方。
  { label: '全部指標', icon: Grid, to: code => `/stock/${code}/metrics` },
]

// 個股指標目錄，/stock/{code}/metrics 專用。節點型別跟側邊欄共用，多兩個欄位：
//   * group.question —— 那一段的 <h2>。站規要求問句 <h2> 至少三個，而且這一頁本來就該用讀者的問題當
//     標題，不是用「獲利能力」這種行話。分類名留在 label 供其他用途，不渲染。
//   * leaf.hook —— 一句白話，回答「我什麼都不懂，為什麼要點這個」。高中生聽得懂為準。
//
// 這裡沒有的三頁是刻意的：葛拉漢倍數／PEG／F-Score 走上面 R5 那條「更忠於財報，避免複合運算」的排除，
// 入口是 /stock/{code} 的徽章表；指標歷史 2026-09-20 起隱藏。三頁的路由都還活著。
// 指標目錄：11 個母項 × 視角（2026-09-27 重排）。
//
// 取代的是 2026-09-26 建立的 9 組問句分類（「這家公司賺不賺錢？」「遇到壞年頭，它撐得住嗎？」）。
// 那套用讀者的話而不是行話，是刻意的、也確實好讀，但它有一個結構性缺陷：**同一個財報科目被拆散在
// 不同問句底下**。淨值相關的目的地曾經散在市場估值（股價淨值比）、獲利能力（ROE）、成長動能（淨值
// 從哪來、淨值成長年增率）三組，讀者想「把淨值這件事看完」時沒有一個地方可以去。
//
// 新規則一句話：**母項是這個指標在問哪一個主體，視角是「用什麼當分母／做了什麼變換」。**
//
// 立刻看得到的效果是每股研發費用（每股）與研發費用率（佔比）第一次同組——這兩支原本分屬「損益表
// 拆解」與「成長動能」，是舊分類最明顯的破口。
//
// ## 「主體」是逐支的判斷，不是機械規則——這一段是更正
//
// 這條規則第一版寫成「比率歸到**分子**的那個科目」。那句話乾淨，但它不描述這份資料：拿型錄的實際
// 公式對 22 支比率，**7 支不成立**，而且成群出現——
//
//   資本報酬 的四支     roe/roa 分子是 NetIncome、roic/roce 分子是 NOPAT/EBIT → 規則說該進「盈餘」
//   償債能力 的三支     currentRatio/quickRatio 分子是 CurrentAssets → 該進「資產」；
//                       interestCoverage 分子是 EBIT → 該進「盈餘」
//   股利 的一支         dividendCoverageRatio 分子是 FCF → 該進「現金流」
//
// 改成「分母」也不成立（grossMargin 分母是 Revenue、peRatio 分母是 EPS）。
//
// 真相是：**比率的主體有時是分子、有時是分母。** ROE 的主體是資本不是淨利——讀者問的是「這些錢
// 用得好不好」；流動比率的主體是償債能力不是流動資產。所以歸類時問的是「讀者拿這個數字在問什麼」，
// 分子只是常見的線索之一。照著「分子」那條假規則搬東西會搬錯，這就是把它寫下來的原因。
//
// ## 一條被退休的舊規則：組名不再跟 GET /metrics 的類別對齊
//
// 舊註解反覆主張「nav 的組名要跟型錄的 category 一致，這樣不會有第二份會漂移的對照表」。那條規則
// **在這次退休**，因為型錄的 7 個類別（市場評價／股東政策／安全韌性／獲利品質／獲利能力／營運效率／
// 成長動能）是按「問題領域」分的，而母項是按「財報科目」分的，兩套本來就不同構——roe 在型錄是
// 獲利能力，在這裡是資本報酬率；capexToRevenue 在型錄是營運效率，在這裡是現金流。
//
// 退休的代價要知道：這裡確實多了一份人工維護的對照。換到的是讀者能把一個科目看完。既然不再宣稱
// 對齊，就不要再寫「已確認 X 的 category 真的是 Y」那種註解——那是舊規則的檢查動作，現在沒有意義。
//
// ## 排序
//
// 母項**跟著三張報表走**（2026-09-28 決定）：
//
//   股價倍數 → 本業損益 → 業外損益 → 盈餘 → 現金流 → 營運資金 → 淨值 → 償債能力 → 資本報酬
//   → 股利 → 原始財報
//
// 順序 2026-09-28 改成「股價倍數 → 股利 → 資本報酬 → 本業損益 → 業外損益 → 盈餘 → 現金流 →
// 營運資金 → 淨值 → 償債能力 → 原始財報」（「資本報酬 股利 這兩組要往前面放」）。
//
// 前一版的敘事線是「價格 → 賺多少 → 收到現金沒 → 家底 → 用得好不好 → 分我多少 → 原始資料」，
// 也就是照財報自己的順序走，把「用得好不好」與「分我多少」放在最後兩組。那條線對照著報表讀是順的，
// 但它假設讀者會從頭讀到尾；實際上退休族最先問的就是那兩件事——這家公司把我的錢用得好不好、會分我
// 多少——而它們原本排在第九與第十，收合狀態下要捲到最底才看得到。
//
// 所以現在的線是「先給答案，再給推導」：股價倍數（現在多少錢）→ 股利（我拿得到什麼）→ 資本報酬
// （公司把錢用得好不好）→ 損益表那一串（為什麼是這樣）→ 原始財報。股利在資本報酬前面是同日的第二次
// 調整：兩組都往前之後，先問「分我多少」再問「用得好不好」——前者是現金、後者是解釋。代價是損益表的三組（本業／業外／盈餘）不再緊接
// 在最前面，但它們彼此仍然相鄰，前一版最在意的「同一張報表的主體不要被拆散」沒有破。
//
// 股價倍數仍然第一（2026-09-26「現在的股價，相當於公司的幾倍？ 會是常用的 希望放第一個」），
// 原始財報仍然墊底。視角在每個母項裡照 MetricPerspective 的宣告順序寫——metrics.vue 的分群刻意
// 不排序，靠的就是這裡的撰寫順序。
//
// 命名一律 2–4 字的名詞、不帶標點。第一版有四個不合（股價的倍數多一個「的」、資本報酬率是比率
// family 而不是科目、損益表：營收到營業利益 有冒號而且是別人的 2.5 倍長、負債與償債 名詞混動作），
// 在十一列並排的收合清單裡那種長度差本身就是雜訊。
//
// ## 關係頁永遠排母項第一列
//
// dupont／margins／solvency／cash-cycle／equity-source 五頁不是單一指標，是把一組數字串起來的頁。
// 它們固定拿視角「組成」並排第一個，跟舊版「三率的關係領頭財報三率、安全韌性的組成領頭安全韌性」
// 是同一條規則，只是現在有名字了。
export const STOCK_METRIC_INDEX: StockNavNode[] = [
  // 分子是**股價**不是財報科目，所以自成一組而不是散進三個母項的「相對股價」。它們共用的性質是
  // 型錄自己的 EOD-only 資料牆（見 METRIC_PAGES 對這三支為什麼指向 peRatio/pbRatio 而不是交易所
  // 公布的 exchangePeRatio/exchangePbRatio 的說明），那個性質屬於這三支，不屬於它們的分母。
  //
  // 葛拉漢倍數與 PEG 2026-09-21 由直接指示移出導覽（「SIDEBAR的選項希望更忠於財報 避免葛拉漢數字
  // 這種 複合運算 徽章性質遠勝於指標性質的」）。那條判準逐支套用的結果：
  //   * 葛拉漢倍數 = PER × PBR，比對 22.5 —— 比率的比率，存在的目的就是跟一條公布的規則比。
  //   * PEG = PER ÷ 盈餘成長率，比對 1 —— 同樣的構造。
  //   * PER / PBR / PSR 各自是股價（或市值）÷ 一個申報數字，離報表一步，在任何門檻被附加之前就
  //     已經是指標。留下。
  // 那兩頁 2026-09-28 刪掉了（「徽章不要歷史，有歷史的只有指標」）：/graham-number 與 /peg，加上
  // /f-score，是當時僅有的三個「只有徽章那一列連得到」的頁，所以它們是純徽章、不是指標。徽章表那
  // 三列改開對話框，跟型錄裡另外 23 支有徽章卻沒有頁的指標一樣。上面那條「離報表幾步」的推理沒有變，
  // 變的是結論從「導覽拿掉、路由留著」變成「連路由一起拿掉」。
  {
    label: '股價倍數',
    answer: '同樣一個股價，除以獲利、除以帳面家底、除以營業額，會得到三個不一樣的倍數。虧錢的公司算不出本益比，那時候另外兩個還在。',
    children: [
      { label: '本益比', perspective: '相對股價', to: code => `/stock/${code}/pe-ratio`, hook: '用現在的股價買，要幾年的獲利才回本' },
      { label: '股價淨值比', perspective: '相對股價', to: code => `/stock/${code}/pb-ratio`, hook: '現在的股價，是公司帳面家底的幾倍' },
      { label: '股價營收比', perspective: '相對股價', to: code => `/stock/${code}/psr`, hook: '現在的市值，是一年營業額的幾倍' }
    ]
  },
  // 股利。分子是發出去的錢，所以殖利率（÷股價）、發放率（÷盈餘）、保障倍數（÷現金流）雖然分母各異，
  // 都歸在這裡。
  //
  // 填權填息不是股利的變換而是**除息後的股價**，視角因此是相對股價，跟現金殖利率、股東總回饋率
  // 同一格，不必為它開新的視角字。
  //
  // 殖利率（dividendYield）仍然沒有自己的頁：它只有 EOD 一種節奏（快照，不是申報的期間數字），
  // 沒有 TTM/Q/FY 數列可以建指標頁。需求已送 analysis-ts，在那之前由現金殖利率那一頁回答。
  {
    label: '股利',
    answer: '公司把賺到的錢分多少出來，以及那些錢相對股價、相對盈餘、相對現金流各是多少。',
    children: [
      { label: '盈餘發放率', perspective: '佔比', to: code => `/stock/${code}/dividend-payout-ratio`, hook: '這一年賺的錢，發了幾成出去' },
      { label: '股利保障倍數', perspective: '倍數', to: code => `/stock/${code}/dividend-coverage-ratio`, hook: '賺到的現金夠不夠支撐這次配息' },
      { label: '現金殖利率', perspective: '相對股價', to: code => `/stock/${code}/dividend`, hook: '用今天的股價買進，一年可以領回幾 %' },
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
      { label: '已動用資本報酬率', perspective: '報酬率', to: code => `/stock/${code}/roce`, hook: '股東的錢加長期借款，在付利息繳稅之前賺回幾 %' }
    ]
  },
  // 損益表：營收到營業利益。順序是損益表自己的，由上往下（營收 → 毛利 → 營業利益），不是照字母也
  // 不是「已有的頁面排前面」——那個遞減本身就是概念。
  //
  // 舊版把 16 個每股科目放成一整組「損益表拆解」，這次拆成這一組（13 支，營收到營業利益的連續遞減）
  // 與業外損益（6 支），並且把稅前／所得稅移進盈餘。拆的理由是前半段是一條**連續的刀口**，後半段
  // 是彼此無關的雜項，混在一起會讓 16 列讀起來像一份清單而不是一條鏈。
  //
  // 三率的關係在這裡拿「組成」：它是唯一同時顯示三個比率、並且花篇幅講它們之間的間隙（推銷管理
  // 費用率／研發費用率／業外損益與所得稅）的頁。三率是這個市場的單一概念（三率三升），三個比率是
  // 沿著損益表互相對讀的，不是一次看一個。
  //
  // 每股研發費用與研發費用率第一次同組——舊版前者在損益表拆解、後者在成長動能。同一個科目的兩個
  // 視角分居兩組，正是這次改分類要解決的事。
  //
  // label 與 hook 沿用 CHAIN_INDEX 已經寫好的，沒有重寫：重寫等於製造第二份會漂移的文案。
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
  // 現金流。五支全是「佔比」，分母各不相同（淨利／營收／總資產），分母寫在 label 與 hook 裡。
  //
  // 資本支出佔營收比的分子是現金流量表科目、沒有自己的母項，掛在這裡——跟 METRIC_PAGES 自己記錄的
  // 「唯一分類例外」一致。
  //
  // **這個母項還沒有「組成」頁**，是分類表上唯一的洞。營業／投資／融資三段的拆解卡在上游：
  // net_cash_flows_from_used_in_investing_activities 在 40 檔裡 30 檔是 null（2026-09-27 實測，
  // mops 欄位 9/07 才擴充、更早寫入的列全是 null），而 114Q4 另有一個單季推導 bug（全市場 674 家，
  // 累計相減時把 null 當成 0，所以 114Q4 單季裝的是全年累計）。兩個缺口都已回報。
  // 決定是**等原生欄位，不用恆等式推第三段**：推出來的第三段讓恆等式在建構上必然成立，圖上就再也
  // 驗不出任何東西，而那張圖全部的價值就是「三段真的加得回來」。
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
  // 指標歷史 2026-09-20 起隱藏（「指標歷史先隱藏」），維持註解掉而不是刪除，跟 APP_FEATURES 停放
  // 暫時下架項目的做法一致；要復原就把註解拿掉。頁面本身還活著、有 canonical，只是不在 sitemap
  // 裡，狀態是「可達但不宣傳」。它沒有變成孤兒：dividend.vue 與 financial-statements.vue 的內文
  // 都還連得到它。
  // { label: '指標歷史', perspective: '原始報表', to: code => `/stock/${code}/metrics-history` },
  {
    label: '原始財報',
    answer: '上面那些比率都是從這三張表算出來的。要自己核對，從這裡進去。',
    children: [
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

// Every group whose subtree contains `path`, by the index StockPageNavNode gives its el-sub-menu.
// el-menu's `default-openeds` wants those ids, and this is what keeps the branch you arrived on
// expanded — landing on /balance-sheet must not hide the group it belongs to.
export function openGroupsFor(nodes: StockNavNode[], code: string, path: string): string[] {
  const open: string[] = []
  const walk = (list: StockNavNode[]): boolean =>
    list.reduce((hit, node) => {
      if (!node.children) return node.to?.(code) === path || hit
      if (!walk(node.children)) return hit
      open.push(`group:${node.label}`)
      return true
    }, false)
  walk(nodes)
  return open
}

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
