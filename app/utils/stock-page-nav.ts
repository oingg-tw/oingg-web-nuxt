import type { Component } from 'vue'
import { Calendar, Coin, Document, Filter, Grid, Histogram, Lock, Odometer, Opportunity, PieChart, PriceTag, Sort, TrendCharts } from '@element-plus/icons-vue'

// The 個股頁面 nav tree. Extracted out of StockPageNavList.vue 2026-09-20 so the recursive node
// component (StockPageNavNode.vue) and the list itself can share the type without importing each
// other in a cycle.
//
// A node is either a LEAF (has `to`, no children) or a GROUP (has children, no `to`). A group is
// deliberately not also a link: el-sub-menu's title is its expand/collapse control, so making it
// navigate too would put two actions on one target. Where the parent has a real page of its own,
// that page becomes the group's FIRST child under its own descriptive label — see 財務報表 below,
// where「瀏覽任意季度」actually describes that page better than repeating the group name would.
export interface StockNavNode {
  label: string
  to?: (code: string) => string
  children?: StockNavNode[]
  // STOCK_METRIC_INDEX 專用，側邊欄不讀。question 是那一組在指標目錄頁的問句 <h2>；hook 是一句白話，
  // 回答「我什麼都不懂，為什麼要點這個」。
  question?: string
  // 問句底下那一句答句。每一組都寫一句真的有內容的話，不是「這一組有 N 項」那種可以套版的字——站規
  // 明文反對為了滿足結構而發明的薄內容，七頁一模一樣的句型就是那種東西。
  answer?: string
  hook?: string
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
  // 月營收 2026-09-25（「月營收先放回 sidebar，放第一層就好」）— a TOP-LEVEL LEAF, the third one,
  // alongside 亮點與風險 and 配息從哪來, so it takes an icon by this file's own rule.
  //
  // It was a child of 成長動能 until that group was parked. First back out because it is the
  // EARLIEST number a reader gets about a company's current trading — filed by the 10th of the
  // following month, where every other line in the nav waits for a quarterly statement. That
  // cadence is also why it does not belong under any of the quarterly groups: being monthly IS its
  // distinguishing property, and filing it beside quarterly siblings is what hid it.
  { label: '月營收', icon: Calendar, to: code => `/stock/${code}/monthly-revenue` },
  // 2026-09-26 第二刀（「Sidebar 塞了這麼多面向還是太雜亂了。我需要把這些東西從 sidebar 移除，開一
  // 個頁面專門找尋這幾類指標」）。同一天早上才把六組放回來、加上 unique-opened，收合 10 列、展開最多
  // 18 列——數字上成立，看起來仍然雜亂。使用者看了實品才下的判斷，所以這裡不是推翻上一個決定，是上一個
  // 決定讓真正的問題露出來：**側邊欄和目錄是兩件事**，一個元件同時做只會兩邊都做不好。
  //
  // 側邊欄從此只回答「我現在在哪、旁邊還有什麼」，永遠四列。那七組整批搬到下面的 STOCK_METRIC_INDEX，
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
export const STOCK_METRIC_INDEX: StockNavNode[] = [
  // 2026-09-26 移到第一組（「現在的股價，相當於公司的幾倍？ 會是常用的 希望放第一個」）。這推翻了
  // 側邊欄時代的 R8「描述公司的都排在唯一依賴股價的那組上面」——那條規則管的是導覽的敘事順序（先認識
  // 公司、再看價格），但這一頁是目錄，順序該照「多少人會用」而不是照概念的先後。使用者常查的排前面。
  // 市場估值 2026-09-21（「Sidbear 下面 加開 市場估值，裡面就放 PER PBR PSR等等」）, moved up to sit
  // directly after 配股配息 on 2026-09-23（「sidebar市場估值放在配股配息後面」）. It was third-from-
  // top before, after 獲利能力, on the reasoning that the groups above answer what the COMPANY
  // earned and paid out while this is the first that depends on the share PRICE. That ordering was
  // never asked for; this one was. The price dependency is still the thing to know about the group
  // — it is why it is the one most exposed to the catalog's own EOD-only wall（see METRIC_PAGES'
  // own note on why these point at peRatio/pbRatio rather than the exchange's published
  // exchangePeRatio/exchangePbRatio）.
  //
  // The group's name follows the user's wording; GET /metrics calls this category 市場評價. That is
  // a label difference only — every member below really is in that one catalog category, which is
  // the part the「nav agrees with the catalog」rule above is actually about, and no second mapping
  // exists to drift.
  //
  // 葛拉漢倍數 and PEG were listed here for a few hours the same day and REMOVED FROM THE NAV by
  // direct instruction（「SIDEBAR的選項希望更忠於財報 避免葛拉漢數字 這種 複合運算 徽章性質遠勝於
  // 指標性質的」）. The test that instruction sets, applied to each candidate rather than only to
  // the one it named:
  //   * 葛拉漢倍數 = PER × PBR, tested against 22.5 — a ratio OF two ratios, existing only to be
  //     compared with a published rule. Badge through and through.
  //   * PEG = PER ÷ 盈餘成長率, tested against 1 — the same construct shape, a derived quantity
  //     divided by another derived quantity.
  //   * PER / PBR / PSR are each 股價（or 市值）÷ ONE filed figure. One step from the statement,
  //     quoted as metrics in their own right long before any threshold is attached. They stay.
  // The PAGES are untouched and still live（/graham-number and /peg still render, still carry their
  // canonicals and still sit in the sitemap）— this is the same nav-entry-out/route-published split
  // 指標歷史 below and ETF／特別股專區 already use. Neither is orphaned: the badge table on
  // /stock/{code} links every badge row that has a page, via findBadgePageByMetric().
  {
    label: '市場估值',
    question: '現在的股價，相當於公司的幾倍？',
    answer: '同樣一個股價，除以獲利、除以帳面家底、除以營業額，會得到三個不一樣的倍數。虧錢的公司算不出本益比，那時候另外兩個還在。',
    icon: PriceTag,
    children: [
      { label: '本益比', to: code => `/stock/${code}/pe-ratio`, hook: '用現在的股價買，要幾年的獲利才回本' },
      { label: '股價淨值比', to: code => `/stock/${code}/pb-ratio`, hook: '現在的股價，是公司帳面家底的幾倍' },
      { label: '股價營收比', to: code => `/stock/${code}/psr`, hook: '現在的市值，是一年營業額的幾倍' }
    ]
  },
  // 獲利能力 2026-09-20（「配股配息下面增加獲利能力。但是獲利能力裡面會有月營收 EPS 等等」）—
  // the first real use of this nav's own group depth. A group is not itself a link (see the rule
  // at the top of this file), so 獲利能力 has no page of its own; it is the shelf its metric pages
  // sit on. The name matches GET /metrics' own 獲利能力 category, which is where `eps` lives, so
  // the nav and the metric catalog agree without a second mapping.
  //
  // 月營收 was pencilled in here and SHIPPED ELSEWHERE（2026-09-23）: it sits at the top of 成長動能
  // below, not in this group. The block that stood here recorded why it was blocked — twse-ts's
  // endpoint was wired to a DEV database, so every symbol but 2330 read empty — and that is now
  // history: twse backfilled 58,024 rows over 2021-09～2026-08 and analysis-ts repointed at PROD
  // the same day. It also needed its own bespoke page rather than a METRIC_PAGES row, since the
  // filing has no metricCode and is monthly where that template is quarterly.
  {
    label: '獲利能力',
    question: '這家公司賺不賺錢？',
    answer: 'ROE 一個數字就講完了，杜邦分析告訴你那個數字是怎麼來的。三率走的是另一條路，從營收往下一關一關扣。',
    icon: Histogram,
    children: [
      // 杜邦分析 2026-09-22（「杜邦分析該怎麼呈現 放在哪個分類下?」→「開始做」）— this group's own
      // relationship page, the slot /margins holds in 財報三率 and /solvency holds in 安全韌性, so
      // it leads rather than sitting among the single-metric pages.
      //
      // Filed HERE although its five factors span three catalog categories（淨利率-side in 獲利能力,
      // 資產週轉 in 營運效率, 權益乘數 in 安全韌性）. That spread is the page's subject rather than a
      // filing problem: ROE is what it decomposes, ROE is in 獲利能力, and a reader asking「ROE 為什麼
      //是這個數字」looks here. A fourth top-level group holding one page is the thin structure this
      // nav rejects everywhere else; the page states the cross-group nature and links out instead.
      { label: '杜邦分析', to: code => `/stock/${code}/dupont`, hook: '把 ROE 拆成三塊，看賺錢靠的是本業、週轉，還是借錢' },
      { label: '每股盈餘', to: code => `/stock/${code}/eps`, hook: '每一股賺多少，新聞上最常講的那個數字' },
      // ROE 2026-09-21（「sidebar獲利能力那邊要新增ROE」）— points at the EXISTING badge page
      // (/stock/:code/roe, BADGE_PAGES in hub-slugs.ts, shipped 2026-09-20), not a new registry
      // entry: the page already exists and was only reachable via the badge table/dialog links
      // until now, not the nav tree. Confirmed roe's own GET /metrics category really is 獲利能力
      // (not assumed from the label) before adding it here, same "nav agrees with the catalog"
      // rule this group's own comment states above.
      // 三個換分母的報酬率（2026-09-26）。排在 ROE 後面而不是散開：它們回答的是同一個問題的四個版本
      // ——「用什麼當分母」——放在一起讀者才看得出那是一組刻度，不是四個獨立指標。
      { label: '投入資本報酬率', to: code => `/stock/${code}/roic`, hook: '扣掉沒在營運的閒置現金之後，真正投入的錢賺回幾 %' },
      { label: '已動用資本報酬率', to: code => `/stock/${code}/roce`, hook: '股東的錢加長期借款，在付利息繳稅之前賺回幾 %' },
      { label: '資產報酬率', to: code => `/stock/${code}/roa`, hook: '每動用一元資產賺回幾 %，不管那筆錢是股東出的還是借的' },
      { label: 'ROE', to: code => `/stock/${code}/roe`, hook: '股東放進去的錢，一年幫你賺回幾 %' },
      // 財報三率 2026-09-21（「sidebar 獲利能力 加上 財報三率」）— the first THREE-level branch this
      // tree actually uses（獲利能力 → 財報三率 → 毛利率）, which is what the 2026-09-20 el-menu
      // rewrite was built for. Kept as one group rather than three flat siblings because 三率 is a
      // single idea in this market's vocabulary（三率三升）: the three rates are read against each
      // other down the income statement, not one at a time.
      //
      // Order is the income statement's own, top to bottom（營收 → 毛利 → 營業利益 → 稅後淨利）, not
      // alphabetical and not "existing pages first" — that descent IS the concept.
      //
      // The three destinations deliberately come from DIFFERENT registries, because the metrics
      // themselves differ (all three checked live against GET /metrics, per this group's own
      // "nav agrees with the catalog" rule above — and all three really are in its 獲利能力
      // category): 毛利率/稅後淨利率 have real badge definitions and are BADGE_PAGES, 營業利益率 has
      // none and is a METRIC_PAGES entry. 毛利率 needed no new page at all — /gross-margin has
      // existed since 2026-09-20 and was only reachable from the badge table until now, the same
      // thing that was true of ROE above.
      //
      // 營業利益率's page went live a few hours ahead of its own catalog copy and carried `noindex`
      // until analysis-ts wrote it (face95d8, same day — see METRIC_PAGES' own comment on that
      // entry). It was listed here from the start regardless: a backend text gap was never a reason
      // to show a 三率 group with two rates in it, and the DATA behind all three was equally real
      // throughout (TTM+Q, 20 periods on 2330).
      {
        label: '財報三率',
        children: [
          // 三率的關係 2026-09-21（「希望有頁面同時解釋 三率 的 關係」）— the group's own page, and
          // therefore its FIRST child under a descriptive label, exactly the rule 配股配息 and
          // 財務報表 already follow (see the top of this file). It is the only page that shows the
          // three rates TOGETHER and spends the gaps between them（推銷管理費用率／研發費用率／
          // 業外損益與所得稅）; the three below each answer about one rate on its own.
          { label: '三率的關係', to: code => `/stock/${code}/margins`, hook: '三個比率一起看，錢是在哪一關被吃掉的' },
          { label: '毛利率', to: code => `/stock/${code}/gross-margin`, hook: '同樣賣一百元，扣掉成本後留下幾元' },
          { label: '營業利益率', to: code => `/stock/${code}/operating-margin`, hook: '本業每一百元營業額，最後留下幾元' },
          { label: '稅後淨利率', to: code => `/stock/${code}/net-profit-margin`, hook: '營業額最後有幾成變成獲利' }
        ]
      }
    ]
  },
  // 獲利品質 2026-09-21（「獲利品質需要跟獲利能力分開做嗎？在sidebar上面」）— yes, separate, and
  // placed directly after 獲利能力 because the pair reads as one question split in two: 獲利能力
  // asks how MUCH profit a company made, 獲利品質 asks whether that profit is real — backed by cash
  // rather than by accruals. For this app's own audience that second question is arguably the more
  // useful of the two, which is why it gets its own group rather than a few extra rows on the first.
  //
  // Name matches GET /metrics' own 獲利品質 category with no rename needed. Membership picked from
  // its 15 metrics by the standing「更忠於財報，避免複合運算、徽章性質遠勝指標性質」test — see
  // METRIC_PAGES' own note for what was excluded and why.
  //
  // 淨利 → 營業現金流 → 自由現金流 is a real chain here, the same shape 財報三率 and 安全韌性 each
  // got a 關係頁 for. Not built yet: the group's metric pages come first, the way both of those did.
  {
    label: '獲利品質',
    question: '帳上賺到的，有變成現金嗎？',
    answer: '利潤是算出來的，現金是收到的。下面每一項都在量這兩者差多遠。',
    icon: PieChart,
    children: [
      { label: '營業現金流對淨利比', to: code => `/stock/${code}/ocf-to-net-income`, hook: '帳面賺一元，實際收到幾元現金' },
      { label: '自由現金流轉換率', to: code => `/stock/${code}/fcf-conversion-rate`, hook: '扣掉買設備的錢之後，還剩多少可以自由運用' },
      { label: '營業現金流利潤率', to: code => `/stock/${code}/ocf-margin`, hook: '每一百元營業額，變成本業現金的有幾元' },
      { label: '應計項目比率', to: code => `/stock/${code}/accruals-ratio`, hook: '獲利裡有多少還只是帳上的數字，錢沒真的收到' }
      // 連續獲利年數 removed with its registry entry 2026-09-22 — its series doesn't behave
      // annually（see hub-slugs.ts for the measurements）.
    ]
  },
  // 營運周轉 2026-09-26（「metrics 要加上營運周轉 指標群」）。緣起是「庫存應該放在哪裡」——答案是
  // 損益表第二刀（營業成本／毛利）底下，因為 `營業成本 = 期初存貨 + 本期進貨 − 期末存貨`，還堆在倉庫
  // 裡的貨根本沒走進損益表，存貨是那一刀上唯一的閥門。
  //
  // 排在獲利品質後面：兩者是相鄰的問題。獲利品質問「帳上賺到的有沒有變成現金」，這一組問「那筆現金
  // 在公司裡轉一圈要多久」。
  //
  // 六支是一條恆等鏈，可以自己驗算（2330 TTM 實測閉合到分）：存貨天數 ＋ 收現天數 ＝ 營運週期；
  // 營運週期 − 付現天數 ＝ 現金轉換循環。這跟損益表那條鏈是同一種東西，也是它在本站說得出口的原因。
  //
  // 同分類另外 10 支沒有納入：GET /metrics 上沒有 description，沒有文案就不開頁。
  {
    label: '營運周轉',
    question: '錢在公司裡轉一圈要多久？',
    answer: '貨進來、賣掉、收到錢，這一趟叫營運週期。扣掉可以晚點再付給供應商的那幾天，剩下的才是公司自己要墊的。',
    icon: Odometer,
    children: [
      // 這一組自己的關係頁，所以排第一個——跟「三率的關係」領頭財報三率、「安全韌性的組成」領頭
      // 安全韌性同一條規則（見本檔案頂端）。單指標頁各自回答一個天數，只有這一頁把它們串起來。
      { label: '現金循環的組成', to: code => `/stock/${code}/cash-cycle`, hook: '三個天數怎麼加減出營運週期和現金轉換循環' },
      { label: '存貨週轉天數', to: code => `/stock/${code}/inventory-days`, hook: '貨平均要在倉庫放幾天才賣出去' },
      { label: '存貨占營收比', to: code => `/stock/${code}/inventory-to-revenue`, hook: '倉庫裡的貨，大約等於一年營收的幾成' },
      { label: '應收帳款收現天數', to: code => `/stock/${code}/receivables-days`, hook: '東西賣出去之後，平均等幾天才收到錢' },
      { label: '應付帳款付現天數', to: code => `/stock/${code}/payables-days`, hook: '跟供應商買了東西，平均過幾天才付錢' },
      { label: '營運週期', to: code => `/stock/${code}/operating-cycle`, hook: '從進貨、賣出去到收回貨款，整趟要幾天' },
      { label: '現金轉換循環', to: code => `/stock/${code}/cash-conversion-cycle`, hook: '錢被卡住幾天。營運週期減掉可以晚一點付的那幾天' }
    ]
  },
  // 成長動能 2026-09-21（「sidebar 加一個成長動能，裡面放 淨值成長 投資支出 等等」）. Last of the
  // metric groups, after 安全韌性: the four before it describe what the company earned, what it is
  // priced at and whether it can pay its bills — all about the period just filed — while this one
  // is the only group about the DIRECTION between periods.
  //
  // Name matches GET /metrics' own 成長動能 category with no rename needed, unlike 市場估值 and
  // 安全韌性 above. Four of the five members come from it; 資本支出佔營收比 is the exception and
  // METRIC_PAGES' own note says why.
  //
  // 淨值成長 and 投資支出 are the two the request named: equityGrowthRate is literally the
  // catalog's 淨值成長年增率, and 投資支出 is capexToRevenue — 資本支出 on the cash-flow statement
  // as a share of revenue, which is the filed form of that idea. 研發費用率 joins them as the other
  // spend-for-the-future line, and is the one metric this group shares with /margins' own
  // decomposition.
  {
    label: '成長動能',
    question: '這家公司有沒有在長大？',
    answer: '比較的對象是去年同一期。跟上一季比會被淡旺季帶著走，很多產業第四季本來就比第三季旺。',
    icon: TrendCharts,
    children: [
      // 月營收 moved OUT of this group to the top level 2026-09-25（「月營收先放回 sidebar，放第一層
      // 就好」）. Its sibling below keeps 單季 in its name anyway: the disambiguation that word does
      // （measured, 14 of 22 symbols with both series differ, up to 26pp — see hub-slugs.ts）is
      // between the two NUMBERS, not between two adjacent rows, so it survives them being apart.
      { label: '單季營收成長年增率', to: code => `/stock/${code}/revenue-growth`, hook: '這一季的營收，比去年同一季多了幾 %' },
      { label: '淨利成長年增率', to: code => `/stock/${code}/net-income-growth`, hook: '營收成長不一定等於獲利成長，這一項看的是後者' },
      // 淨值從哪來 排在淨值成長年增率前面：那一頁只給一個成長率，這一頁拆給你看那個成長率是誰推的。
      // 2026-09-27 從 /balance-sheet 搬出來——那一組（財務報表）要忠實還原 XBRL，放分析會讓稽核用意失焦。
      { label: '淨值從哪來', to: code => `/stock/${code}/equity-source`, hook: '淨值是股東投的還是公司賺的，逐年怎麼變' },
      { label: '淨值成長年增率', to: code => `/stock/${code}/equity-growth`, hook: '賺來的錢留在公司多少，會累積在這裡' },
      { label: '資本支出佔營收比', to: code => `/stock/${code}/capex-to-revenue`, hook: '把多少錢拿去買設備蓋廠房。那些錢就不會變成股利' },
      { label: '研發費用率', to: code => `/stock/${code}/rd-intensity`, hook: '研發佔營業額的比率。要跨公司比較投入程度，用比率' }
      // 盈餘創新高比率 removed with its registry entry 2026-09-22 — analysis-ts retired the badge
      // it was built on, and this group has no badge page any more.
    ]
  },
  // 安全韌性 2026-09-21（「sidebar 底下增加此 分類 底下要放入 流速動比 長債比例 等等的 指標」）.
  //
  // The NAME came from「財務韌性 改叫安全韌性」, and the rename was done where the string is OWNED
  // rather than here: 財務韌性 was a backend value in GET /metrics' own category name and in
  // GET /stocks/:symbol/badges' categoryDisplayName. analysis-ts renamed both the same day
  //（8f7b4ddd, categoryKey `resilience` untouched）and bff-ts re-synced, so this label and the
  // catalog AGREE — no second mapping, unlike 市場估值 above which still differs from 市場評價.
  //
  // A third surface was reported alongside those two and turned out NOT to be one: GET /screener/
  // templates also has a template literally named 財務韌性, which SCREENER_TEMPLATE_SLUGS is keyed
  // by, so renaming it would have silently dropped that link the way 股利穩健→股利連續性 did on
  // 2026-09-20. bff-ts clarified it is a same-name coincidence in their own PresetTemplate table,
  // not a downstream of the category — it is still called 財務韌性 today and that key is still
  // correct. If the template is ever renamed too, THAT is when the key needs changing (slug stays
  // financial-resilience, a live sitemap URL).
  //
  // Membership follows the same「更忠於財報」test as 市場估值 above, applied to all 25 metrics in
  // that category: out go the four regression SCORES（Altman Z / Z″ / Ohlson O / Zmijewski）as
  // composite badge constructs, out go the five bank-only capital ratios（不適用 on ~95% of
  // symbols）, and out go every candidate whose series is one period deep — see METRIC_PAGES' own
  // note, which is also why 長債比例 has no entry here despite being named in the request.
  // What is left is five one-step statement ratios: two liquidity, two leverage, one coverage.
  {
    label: '安全韌性',
    question: '遇到壞年頭，它撐得住嗎？',
    answer: '還得出錢嗎，跟借得多不多，是兩件事。流動比率和速動比率答前面那個，負債比率和利息保障倍數答後面那個。',
    icon: Lock,
    children: [
      // 安全韌性的組成 2026-09-21（「只有單一一個指標呈現好像沒甚麼意思」→「那先做安全韌性」）—
      // the group's own page, and therefore its FIRST child, the same rule 財報三率／配股配息／
      // 財務報表 follow. It is the only page that shows these ratios TOGETHER and spends the gaps
      // between them（存貨、應收帳款等其他速動資產）, plus the 負債＋權益＝100% split; the five
      // below each answer about one ratio on its own.
      { label: '安全韌性的組成', to: code => `/stock/${code}/solvency`, hook: '這幾個比率一起看，公司的還債能力長什麼樣' },
      { label: '流動比率', to: code => `/stock/${code}/current-ratio`, hook: '一年內要還的錢，手上一年內能變現的資產夠不夠' },
      { label: '速動比率', to: code => `/stock/${code}/quick-ratio`, hook: '同上，但不把還沒賣掉的存貨算進去' },
      { label: '負債比率', to: code => `/stock/${code}/debt-ratio`, hook: '公司的資產裡，有幾成是借來的' },
      { label: '有息負債權益比', to: code => `/stock/${code}/interest-bearing-debt-to-equity`, hook: '要付利息的債，相當於股東資本的幾倍' },
      { label: '長期負債對淨流動資產比', to: code => `/stock/${code}/long-term-debt-to-net-current-assets`, hook: '長期的債，短期資產扛不扛得住' },
      { label: '利息保障倍數', to: code => `/stock/${code}/interest-coverage`, hook: '一年賺的錢，夠付幾次利息' }
    ]
  },
  // 配股配息 became a group 2026-09-21（「sidebar 配股配息底下要拆子項目，就像是獲利能力底下拆 EPS
  // 出來一樣」）— same rule as 財務報表/獲利能力 above/below: the parent still has a real page of its
  // own (five question sections: 現金殖利率/近幾季/歷年/股息來源/除權息日期), so it stays reachable
  // as the group's FIRST child rather than moving behind the group title. 殖利率 — the single most
  // intuitive split candidate — is NOT one of the three children: checked live and rejected, its
  // only cadence is EOD (a snapshot, not a filed periodic figure), so it has no TTM/Q/FY series to
  // build a metric page from at all. It stays answered on the group's own first child until that's
  // resolved (request sent to analysis-ts); see METRIC_PAGES' own comment on the three that shipped
  // instead.
  {
    label: '配股配息',
    question: '它會分多少給我？',
    answer: '現金殖利率算的是你用今天的股價買，一年能領回幾 %。但配息要發得出來才算數，所以後面幾項在看公司的錢夠不夠。',
    icon: Coin,
    children: [
      // 總覽→現金殖利率 2026-09-21（「也就是把sidebar的總覽改名為 現金殖利率」）— matches
      // dividend.vue's own scope-down the same day: that page dropped its 總覽 framing to answer
      // just 現金殖利率 specifically (dividendPerShare/dividendPayoutRatio/shareholderYield/
      // consecutiveDividendYears moved out of its lead sentence; the aggregate "cash + buyback"
      // view belongs on 股東總回饋率 now).
      { label: '現金殖利率', to: code => `/stock/${code}/dividend`, hook: '用今天的股價買進，一年可以領回幾 %' },
      // 填權填息 2026-09-24（「配股配息底下 新增一個填權填息，把現在現金殖利率的部分資訊搬過去」）—
      // the 填息 table and its reasoning moved off /dividend, which was carrying two subjects.
      { label: '填權填息', to: code => `/stock/${code}/dividend-fill`, hook: '除息之後股價有沒有漲回來。領到股利不等於賺到，差別在這裡' },
      { label: '盈餘發放率', to: code => `/stock/${code}/dividend-payout-ratio`, hook: '這一年賺的錢，發了幾成出去' },
      { label: '股利保障倍數', to: code => `/stock/${code}/dividend-coverage-ratio`, hook: '賺到的現金夠不夠支撐這次配息' },
      { label: '股東總回饋率', to: code => `/stock/${code}/shareholder-yield`, hook: '除了現金股利，公司買回自己的股票也算還錢給股東' }
    ]
  },
  // 指標歷史 hidden 2026-09-20（「指標歷史先隱藏」）— commented out rather than deleted, the same
  // way APP_FEATURES parks its temporarily-shelved entries; re-add by uncommenting. The PAGE is
  // untouched and still live: /stock/{code}/metrics-history still renders and carries its own
  // canonical. It has since LEFT the sitemap too（verified 2026-09-22: zero occurrences）, so the
  // state is now "reachable, not advertised" rather than the half-way one this comment described. That matches how
  // ETF 專區/特別股專區 were hidden (nav entry out, route left published). It does NOT orphan the
  // page: dividend.vue and financial-statements.vue both still link to it from their own body
  // copy. Unpublishing it properly (sitemap suffix out + noindex, what 公司健檢 below got) would
  // be a different, bigger call and is not what this change did.
  // { label: '指標歷史', to: code => `/stock/${code}/metrics-history` },
  // 公司健檢 was removed 2026-09-19 (unpublished pending a redesign — see that page's own comment).
  //
  // 損益表拆解 2026-09-26（「每一環還可以往下看什麼？ 這邊的指標就也可以放到 metrics 中了對嗎」）。
  //
  // 對，但只有 16 個。/dividend-source 的索引段有 28 個連結，其中 12 個（月營收、毛利率、EPS、盈餘
  // 發放率…）在上面的組別裡已經有家了，整段搬過來會製造 12 組重複。這裡放的是**真正無家可歸的那 16
  // 頁**——側邊欄沒有、metrics 其他組也沒有，先前只靠 /dividend-source 活著。
  //
  // 加這一組的理由不是「順手補齊」，是側邊欄那一列叫「全部指標」而它少了 16 頁，名字對不上內容。
  //
  // /dividend-source 的索引段**不能拆**：那一頁剛好只有三個問句 <h2>（站規下限），拿掉就掉到兩個、
  // 直接 FAIL。而且兩邊的職責本來就不同——那一段按 ①～⑤ 帶讀者走一遍鏈，這一組是給已經知道要找什麼
  // 的人用的目錄。同樣 16 個連結出現在兩頁不是重複，是兩種找法。
  //
  // label 與 hook 直接沿用 CHAIN_INDEX 已經寫好的，沒有重寫：重寫等於製造第二份會漂移的文案。
  {
    label: '損益表拆解',
    question: '營收一路扣到最後，中間有哪些科目？',
    answer: '從營收開始，一刀一刀扣到每股盈餘。想看它們串起來的樣子，配息從哪來那一頁有整張圖。',
    icon: Sort,
    children: [
      { label: '每股營收', to: code => `/stock/${code}/revenue-per-share`, hook: '這一年每一股對應到多少營業額' },
      { label: '每股營業成本', to: code => `/stock/${code}/cost-of-goods-sold`, hook: '做出產品本身花了多少，原料漲價會先反映在這裡' },
      { label: '每股毛利', to: code => `/stock/${code}/gross-profit`, hook: '賣掉之後扣掉成本，還剩下多少' },
      { label: '每股營業費用', to: code => `/stock/${code}/operating-expense`, hook: '賣東西和管理公司花的錢，跟做出產品本身無關' },
      { label: '每股推銷費用', to: code => `/stock/${code}/selling-expense`, hook: '廣告、通路、業務團隊的錢' },
      { label: '每股管理費用', to: code => `/stock/${code}/administrative-expense`, hook: '總部、人事、法務這些後勤的錢' },
      { label: '每股研發費用', to: code => `/stock/${code}/rd-expense`, hook: '投入新產品的錢。想知道公司為以後準備了多少，看這個' },
      { label: '每股營業利益', to: code => `/stock/${code}/operating-income`, hook: '本業做完一輪之後真正賺到的' },
      { label: '每股業外損益', to: code => `/stock/${code}/non-operating-income`, hook: '不是本業賺的那一塊。想知道獲利有多少不靠本業，看這個' },
      { label: '每股利息收入', to: code => `/stock/${code}/interest-income`, hook: '帳上現金存著、借出去，收到的利息' },
      { label: '每股財務成本', to: code => `/stock/${code}/finance-cost`, hook: '借錢要付的利息。想知道負債壓力多大，從這裡看' },
      { label: '每股其他收入', to: code => `/stock/${code}/other-income`, hook: '零星的其他進帳' },
      { label: '每股其他利益及損失', to: code => `/stock/${code}/other-gains-losses`, hook: '匯兌、資產評價、處分這些一次性的損益' },
      { label: '每股權益法投資損益', to: code => `/stock/${code}/equity-method-income`, hook: '轉投資的公司分回來的損益' },
      { label: '每股稅前淨利', to: code => `/stock/${code}/pretax-income`, hook: '繳稅之前的獲利' },
      { label: '每股所得稅費用', to: code => `/stock/${code}/income-tax-expense`, hook: '這一年繳了多少稅。有時候是負的，那是所得稅利益' }
    ]
  },
  // 財務報表 became a group 2026-09-20 when the latest filing's three tables moved to their own
  // URLs. It stays reachable as its own page through the first child rather than through the group
  // title, per the rule above.
  {
    label: '財務報表',
    question: '想直接看原始財報怎麼辦？',
    answer: '上面那些比率都是從這三張表算出來的。要自己核對，從這裡進去。',
    icon: Document,
    children: [
      { label: '瀏覽任意季度', to: code => `/stock/${code}/financial-statements`, hook: '自己挑年度和季別，看那一期的三張表' },
      { label: '資產負債表', to: code => `/stock/${code}/balance-sheet`, hook: '公司當下有什麼、欠什麼，剩下多少是股東的' },
      { label: '損益表', to: code => `/stock/${code}/income-statement`, hook: '這一期賣了多少、花了多少，最後賺多少' },
      { label: '現金流量表', to: code => `/stock/${code}/cash-flow-statement`, hook: '錢實際從哪裡進來、往哪裡出去' }
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
