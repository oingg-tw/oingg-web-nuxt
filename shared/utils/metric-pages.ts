// 個股 × 徽章／指標專頁的登記表（/stock/{code}/{slug}，2026-09-20；2026-10-08 從 hub-slugs.ts 拆出來）。兩份登記表餵同一個
// 萬用路由 app/pages/stock/[code]/[slug].vue（Nuxt 一個目錄只能有一個動態段），它只做分派：解析 slug、掛對應的模板。
// 兩個 slug 空間必須不相交，assertMetricPagesDisjoint() 是可執行的檢查。
// 每個專頁都列在這裡——sitemap 的列舉、徽章表格每列的連結、導覽都讀這一份，所以不在這裡的頁沒有連結也沒有網址；刪一頁＝刪一行。
// **這個檔案刻意不 import 任何東西**：scripts/check-*.mjs 用 Node 直接載入它（只剝型別），而 useStockPinnedMetrics 在 app.vue
// 的初始化路徑上也讀它。

// 徽章頁：主軸是門檻（符合／未符合）與計算依據表。
export interface BadgePageDefinition {
  // URL 段。手寫而不是 metricSlug(metricCode)：那會把 liveGrahamNumber 變成無意義的 live-graham-number（EOD／TTM 的 live 前綴是
  // 內部慣例）。跟 /metrics/{slug} 是兩個獨立的詞彙表，不要互相引用。
  slug: string
  // GET /metrics 的 key；徽章定義與 GET /stocks/:symbol/badges 的逐家判定都用它
  metricCode: string
  // 計算依據表用的 metric-provenance metricCode。通常等於 metricCode；liveGrahamNumber（hasProvenance false）用 grahamNumber 的季基準
  // 溯源，頁面自己的註解說明因此產生的數字差（今日收盤 vs 最後知識日收盤）不能抹平
  provenanceMetricCode?: string
  // <h1> 第三段與麵包屑最後一層
  topic: string
  // <title> 的長尾片語：`{短名} {代碼} {titleKeywords}`＋品牌後綴要 ≤ 32 個 CJK 等效字（check-stock-pages 的 cjkLength），逐筆驗
  titleKeywords: string
  // 目前值卡片的歷史圖用哪個期別（2026-09-21「gross-margin 這邊也要用圖表，以後 EPS 營收 ROA 這種指標都要有」）。只有 EOD 的徽章
  // 不設（快照值沒有期別可畫，metrics-history 也只接受 EOD）。不必等於 METRIC_PAGES 的 timeframe。2026-10-08 起有 TTM 的一律 TTM，
  // 見 MetricPageDefinition.timeframe
  chartTimeframe?: 'TTM' | 'Q' | 'FY'
  // 改畫河流圖（2026-09-21「PSR 是不是也用河流圖比較適合?」）；只有「股價 ÷ 每股某值」的比率才做得出帶狀，設了就不用 chartTimeframe
  riverKind?: 'pe' | 'pb' | 'ps'
  // 一起畫在圖上的第二支指標，同 MetricPageDefinition 的同名欄位。配對由我們決定、讀者沒有選單（2026-09-29 做過自選版，使用者判斷
  // 「很混淆難用」）；只在「單獨看會被誤讀、而某一支剛好能說明誤讀來源」時才設
  compareMetricCode?: string
  // 接著讀的其他 /stock/{code}/… 頁，規則見 MetricPageDefinition.related
  related?: string[]
}

export const BADGE_PAGES: BadgePageDefinition[] = [
  // 三頁刪除 2026-09-28（「徽章不要歷史，有歷史的只有指標」）：f-score、graham-number、peg 是當時唯一只有徽章列連得到的頁；其餘七頁
  // 同時是 STOCK_METRIC_INDEX 的目的地所以留著。刪掉的三支回到「徽章列開對話框」的處理（StockGuruBadgeDialog 本來就畫 Piotroski 的
  // 九項訊號）。連帶拿掉：ownRoute 欄位、[slug].vue 的 404 防線、SERIES_PLANS 的 'f-score' 與 cachedPiotroskiBreakdown、
  // check-stock-pages 對 /f-score 的 ssrTables 豁免。
  // chartTimeframe 跟徽章自己的 timeframe（GET /stocks/:symbol/badges 逐徽章回傳，實測 grossMargin／netProfitMargin／roe 是 TTM、
  // piotroskiFScore 是 Q、liveGrahamNumber 是 EOD），不跟指標頁 2026-09-21 的「預設單季」走：門檻是在那個基準上判定的，
  // 圖用別的基準會讓同一頁印出兩個「目前毛利率」（2330：64.23% TTM 對 67.72% Q），當天換過又換回。
  // roe 預設對照 ROA（2026-09-29「roe 這一頁要怎麼跟借錢多搭在一起看?」）：分子相同、分母一個是自有資本一個是全部資產，差就是
  // 「資產裡有多少不是股東出的」。抽 60 檔：負債比率最低 1/3 的 ROE−ROA 平均 1.9pp、最高 1/3 平均 10.3pp，78% 的公司 ROE ≥ ROA。
  // 不選 debtRatio 本身：它只有單季，跟徽章釘住的 TTM 共不了軸。杜邦分析回答這個徽章只陳述的事（ROE 是五件事的乘積）。
  { slug: 'roe', metricCode: 'roe', provenanceMetricCode: 'roe', compareMetricCode: 'roa', topic: '股東權益報酬率', titleKeywords: 'ROE 股東權益報酬率與門檻', chartTimeframe: 'TTM', related: ['dupont', 'roa', 'eps'] },
  { slug: 'gross-margin', metricCode: 'grossMargin', provenanceMetricCode: 'grossMargin', topic: '毛利率', titleKeywords: '毛利率與護城河門檻', chartTimeframe: 'TTM' },
  // 稅後淨利率 2026-09-21（「sidebar 獲利能力加上財報三率」）：三率裡唯一有徽章的（巴菲特淨利率，Mary Buffett & Clark 2008），
  // 文案與 TTM＋Q 歷史都齊（2330 20 期、1101 10 期）；營業利益率沒有徽章，在 METRIC_PAGES
  { slug: 'net-profit-margin', metricCode: 'netProfitMargin', provenanceMetricCode: 'netProfitMargin', topic: '稅後淨利率', titleKeywords: '稅後淨利率與獲利門檻', chartTimeframe: 'TTM' },
  // 市場估值 2026-09-21（「Sidebar 下面加開市場估值，放 PER PBR PSR」）。psr 文案與徽章都齊（2330 20/20 期）；金融股（2891）讀到 0 期
  // 是對的——銀行沒有營業收入，那些頁自己 noindex
  { slug: 'psr', metricCode: 'psr', provenanceMetricCode: 'psr', topic: '股價營收比', titleKeywords: 'PSR 股價營收比與門檻', riverKind: 'ps' },
  // 安全韌性 2026-09-21（「sidebar 底下增加此分類，放流速動比、長債比例等等」）：有徽章的兩支。chartTimeframe 照各徽章自己的
  // 基準（currentRatio 是 Q、interestCoverage 是 TTM，實測）
  { slug: 'current-ratio', metricCode: 'currentRatio', provenanceMetricCode: 'currentRatio', topic: '流動比率', titleKeywords: '流動比率短期償債能力', chartTimeframe: 'Q' },
  { slug: 'interest-coverage', metricCode: 'interestCoverage', provenanceMetricCode: 'interestCoverage', topic: '利息保障倍數', titleKeywords: '利息保障倍數與償債門檻', chartTimeframe: 'TTM' },
  // 獲利品質 2026-09-21：有徽章的那一支（TTM，實測）
  { slug: 'accruals-ratio', metricCode: 'accrualsRatio', provenanceMetricCode: 'accrualsRatio', topic: '應計項目比率', titleKeywords: '應計項目比率與盈餘品質', chartTimeframe: 'TTM' },
  // 盈餘創新高比率：2026-09-21 上線（第一個 percentileRank 徽章頁，門檻是相對的五分位），09-22 下架——analysis-ts 把徽章本身退役
  // （354f590d），沒有徽章的徽章頁無事可做；指標仍在型錄，若要回來會是指標頁，但它只有 Q 的百分位序列、太薄。
  // 留這段是因為它怎麼來的：hasProvenance 原本是 false，我寫成「做不到」，被更正「為什麼不能驗證？可以跟 analysis 提需求啊」，
  // 當天就補上了（fd8d276e）。教訓成立，頁面不在了。
]

export function findBadgePage(slug: string): BadgePageDefinition | null {
  return BADGE_PAGES.find(page => page.slug === slug) ?? null
}

// 能不能當自選指標（2026-10-07「加入指標的這些內容，每個都有圖表嗎? 沒有的請移出，比如指標歷史」）：自選指標在指標速覽裡畫它
// 那一頁的圖，所以「能釘」＝「速覽畫得出它的圖」——指標頁（河流圖或互動卡片）、有圖的徽章頁、配股配息（殖利率分布卡）。
// 量於 2026-10-07：目錄 66 項中 54 項可釘；不可釘的 12 項裡，杜邦／三率／月營收／淨值從哪來／安全韌性 5 頁自己有圖（多線、瀑布、
// 堆疊），只是速覽還不會畫，接上之後在這裡放行即可。放在這裡而不是 useStockPinnedMetrics：那一支在 app.vue 的初始化路徑上。
export function hasPinnableChart(slug: string): boolean {
  if (slug === 'dividend' || METRIC_PAGES.some(page => page.slug === slug)) return true
  const badge = BADGE_PAGES.find(page => page.slug === slug)
  return !!badge && !!(badge.riverKind || badge.chartTimeframe)
}

// 目前值圖真正查的 metricCode：有 provenanceMetricCode 就用它（徽章自己的 metricCode 可能沒有常規歷史序列），兩個呼叫端
// （badge.get.ts、StockBadgeDetailPage）共用這一支
export function badgePageChartMetricCode(page: BadgePageDefinition): string {
  return page.provenanceMetricCode ?? page.metricCode
}

// 反查：給徽章的 GET /metrics key（GuruBadge.id）找它的專頁；其餘約 32 個徽章只有共用對話框
export function findBadgePageByMetric(metricCode: string): BadgePageDefinition | null {
  return BADGE_PAGES.find(page => page.metricCode === metricCode) ?? null
}

export function badgePagePath(code: string, slug: string): string {
  return `/stock/${code}/${slug}`
}

// 指標專頁：沒有徽章的指標（2026-09-20「stock/2330/eps 這樣的，除了看到 2330 EPS 多少，也可以知道甚麼是 EPS」「月營收等等
// 也比照這個模板」）。跟徽章頁是兩份登記表、兩個模板（使用者：「把徽章與指標頁面區分成兩個模板會比較容易些」）：徽章頁的主軸是
// 門檻與計算依據，EPS 沒有這兩樣——它有數值、歷史與定義。共用一個模板會讓每一段都掛 v-if="isBadge"。
export interface MetricPageDefinition {
  // 手寫 slug（同徽章頁），不能撞到徽章 slug 或具名的兄弟路由（dividend、balance-sheet…）：Nuxt 先解析靜態檔，撞到會被靜默遮蔽
  slug: string
  // GET /metrics 的 key，也是 GET /stocks/:symbol/metrics-history 吃的
  metricCode: string
  // 這一頁的資料讀哪個期別：歷史表、圖表預設、首句的近四季數字。**2026-10-08 起有 TTM 的一律預設 TTM**（使用者推翻 10-07 的
  // 「所有指標預設單季」）；文案與 <title> 仍單季優先（2026-09-21 決定），StockMetricDetailPage 另外抓 Q 的數字寫那一句。
  // 對 GET /metrics 的 fields 量（2026-10-08）：有 Q 也有 TTM 的 33 個指標頁與 5 個徽章頁由 Q 改成 TTM；仍是 Q 的 9 頁型錄只有 Q
  // 或 Q+FY（流動／速動比率、負債比、每股淨值、每股現金…季末存量，以及淨值成長年增率）。要是指標真的提供的期別：沒資料的
  // 期別回空序列不是錯誤（dividendPayoutRatio／dividendCoverageRatio／shareholderYield 當時沒有 Q，實測）。
  timeframe: 'TTM' | 'Q' | 'FY'
  // <h1> 第三段與麵包屑最後一層
  topic: string
  // <title> 的長尾片語，同徽章頁 ≤ 32 CJK 等效字的預算
  titleKeywords: string
  // 「本季比去年同季變多少」那一行字用的 metricCode，固定問 Q——因為這個欄位寫的就是那一句，不是因為其他期別的年增率沒意義
  // （2026-10-05 更正：TTM 對去年同期 TTM 是標準的成長衡量，上游也補了 TTM／FY）。只在型錄確認有這支年增率時才設。
  quarterlyGrowthMetricCode?: string
  // 改畫河流圖（2026-09-21「我希望 PER PBR 都改用河流圖而非長條圖」）：只有 /pe-ratio、/pb-ratio、/psr——河流圖要比率、它除的每股
  // 基數（EPS／每股淨值／每股營收）和股價。**這三頁沒有期別切換器是確認過的決定**（使用者 2026-10-02）：x 軸是日線股價、帶狀是
  // 每股基數 × 倍數，換期別只改帶狀解析度，不是讀者在問的事。
  riverKind?: 'pe' | 'pb' | 'ps'
  // 接著讀的其他頁（兩份登記表的 slug 都可）。2026-09-22 從「該不該把 EPS、淨利與淨利成長合成一頁」來的：散落是真的（EPS 在獲利能力、
  // 成長率在成長動能，讀完 EPS 沒路到成長率），但合併是錯的修法——/eps 是這個家族最高價值的長尾頁；合併頁得是關係頁，而關係頁靠
  // 真的成立的恆等式，(1+EPS成長)=(1+淨利成長)÷(1+股數成長) 只有 17/25 在 ±0.5pp 內（台泥就不成立）。所以用連結不用架構；
  // 只設讀者真的需要的那幾條，連到所有相鄰頁等於沒連。
  related?: string[]
  // 組成成分（2026-09-28「現在就把費用組成頁做起來，希望可以做成模板重用」）：有這一欄的頁多一段「由哪些項目組成」（堆疊柱＋表），
  // 名稱與單位從型錄讀。加一支組成頁＝多寫一行：metric.get.ts 把母項與成分在同一次 metrics-history 呼叫取回（上限 10 支）。
  // 前提是恆等式在上游成立：營業費用實測（2026-09-28 抽 8 檔 TTM）最大差 0.01（四捨五入進位差），金融業四項全 null 時整段不渲染。
  // **成分與母項必須來自同一支端點**（2026-09-30 bff-ts 警告）：metrics-history 的每股值換算到今天的股數基準、財報欄位是申報
  // 原值，混用會在有股數變動的公司失效（3041 2025Q2：−0.67 vs −0.70，2025-05 增資 +19.77%）；閉合只證明同一基準下加得起來。
  // 銀行三支成分（2026-09-29 analysis-ts 上線，母項沿用 operatingExpensePerShare）跟一般業四支放同一個陣列不分業態：對方的
  // 成分是 null、compositionRow 只拿有值的成分驗恆等式、全期 0 的層會丟掉，所以兩邊各自閉合（彰銀 1.21+0.15+0.52=1.88）。
  // 接線陷阱：bankOtherOperatingExpensePerShare 是差額推算的殘差不是申報科目；zh「其他業務及管理費用」對應四個元素，要的是
  // ifrs-full:GeneralAndAdministrativeExpense；純銀行與金控的第三項來自不同的表要 coalesce。金控數字是全集團合併，頁面要寫。
  // 守衛驗的是自洽不是正確性（6776 母項與成分一起壞恆等式照樣過）。
  partMetricCodes?: string[]
  // 「跟某個指標一起看」的策展預設（2026-09-29「希望模板頁都建立類似機制」）；讀者可在圖上自己換，這裡是打開時已選好的那一支。
  // 同單位同基準的候選實測 ROIC 有 33 支（% 67、元 34、倍 31），所以機制值得做、逐頁硬綁是錯的形狀。先有的三個：roic→roe、
  // equity-growth→bvpsGrowthRate、net-income-growth→epsGrowthRate（總額與每股成長率的差就是股數稀釋，21.5% 的期別差超過 1pp，
  // 最大 117.5pp）。頁面只陳述算術差，解釋留在 METRIC_COPY 的 compare：只是相關的配對會暗示一個關於公司的主張。
  compareMetricCode?: string
  // 拆不出來的時候寫這裡（2026-09-28）：有 partMetricCodes 就畫組成，只有這一欄就用一段話回答「為什麼只有一個數字」，同一個位置、
  // 同一個問句。存在的理由是營業成本：它比營業費用大一個量級（6505 是 53.8 倍），而站上只拆得出小的那一邊。措辭是「看不到，
  // 而且不是暫時的」：mops 掃 55 份 115Q2 文件 0/55 標記那些元素，而 TIFRS taxonomy 的一般業與保險業根本沒有「員工福利費用」
  // 「折舊攤銷」兩個科目——不是沒標，是欄位不存在，重爬無效。tifrs-notes:ShortTermEmployeeBenefits 看起來像員工福利，實際是
  // 主要管理階層薪酬（2330 115Q2 50.8 億）。之後真的拿到成分，就把這一欄換成 partMetricCodes。
  compositionNote?: string
  // 同一支指標開第二頁時用（2026-10-09「總負債比率與負債組成拆開成兩個頁面」）。valueTopic：數值句裡的名字（「負債比率為 30.94%」），
  // topic 留給頁面本身（標題、「是什麼」）；有它時 <title> 固定用 titleKeywords，不跟原頁的「第 N 季 X 為…」標題撞。copyKey：文案取
  // METRIC_COPY 的哪一份，不然兩頁會是一字不差的重複內容。兩個都預設等於原本的值。
  valueTopic?: string
  copyKey?: string
}

// 2026-09-26：topic 改用中文全稱（EPS→每股盈餘、PER→本益比…），跟 GET /metrics 的 name 對齊——篩選器與指標歷史表直接讀即時型錄，
// 不跟的話同一個東西站內會有兩個名字。titleKeywords 不動：它同時寫了縮寫與中文，兩種搜尋字都涵蓋。
export const METRIC_PAGES: MetricPageDefinition[] = [
  // quarterlyGrowthMetricCode（2026-09-21「eps 要可以呈現單季與 YOY」）：型錄只有 epsGrowthRate（單季對去年同季）與多年 CAGR，沒有
  // 季增，所以照「YOY」這個字做。related 是這個欄位當初為它加的那一筆：EPS 在獲利能力、淨利成長在成長動能，讀完沒路到
  // 「公司到底有沒有賺更多」；杜邦是另一半（EPS 是每股利潤，杜邦講利潤怎麼來）。
  { slug: 'eps', metricCode: 'eps', timeframe: 'TTM', topic: '每股盈餘', titleKeywords: 'EPS 每股盈餘逐季數據', quarterlyGrowthMetricCode: 'epsGrowthRate', related: ['net-income-growth', 'roe', 'dupont'] },
  // 配股配息三頁 2026-09-21（「sidebar 配股配息底下要拆子項目」）：從資料完整度挑的。殖利率落選——只有 EOD（即時股價快照），
  // metrics-history 拒絕 TTM／Q／FY，已向 analysis-ts 提需求，先留在配股配息頁的區塊。三支都有真的 TTM 歷史＋完整三段文案。
  // 盈餘發放率預設年度（FY），是「有 TTM 就預設 TTM」通則的唯一例外（使用者 2026-09-28「這一頁應該用 FY 而不是近四季去計算」，
  // 2026-10-08 年度資料到齊後確認）：近四季的分子是過去四季付出去的現金、分母是過去四季淨利，不是同一段盈餘；年度口徑是
  // 「那一年盈餘配出的股利 ÷ 那一年 EPS」。2330 2023：近四季 34.79%、年度 40.2%。
  { slug: 'dividend-payout-ratio', metricCode: 'dividendPayoutRatio', timeframe: 'FY', topic: '盈餘發放率', titleKeywords: '盈餘發放率配息保守或激進' },
  { slug: 'dividend-coverage-ratio', metricCode: 'dividendCoverageRatio', timeframe: 'TTM', topic: '股利保障倍數', titleKeywords: '股利保障倍數自由現金流支撐' },
  // shareholderYield 當時只有 8 期（2 年）TTM 歷史，低於本站約 10 年的門檻，使用者決定照放（跟月營收那種整個市場缺的不同）；深度沒長就重看
  // 堆疊組成（2026-10-08 使用者「股東總回饋率 能改成 stackedbar 嗎」）：只疊真的流向股東的現金。量到最新一期 10/10 檔
  // 現金股利＋買回＝總數（誤差 ≤0.01），更早的期別成分還在回填，未滿兩期成立時組成段不顯示。減資退還現金（capitalReductionYield）
  // 上游還沒出，到了加進來；上游把它併進總數之後、加進來之前，有減資的期別會因為加不起來被跳過，不會畫錯。
  { slug: 'shareholder-yield', metricCode: 'shareholderYield', timeframe: 'TTM', topic: '股東總回饋率', titleKeywords: '股東總回饋率配息加買回庫藏股', partMetricCodes: ['cashDividendYield', 'buybackYield'] },
  // ── 三個換分母的報酬率（2026-09-26）── 使用者問「ROIC 不見了？」，答案是從來沒開過：沒有文案就開不了頁。三支一起要（獲利能力
  // 原本只有 ROE 一個報酬率，看不到「換分母看到不同東西」）；croic 刻意不要（複合運算，見 stock-page-nav.ts 的「更忠於財報」）。
  // roic 的覆蓋率與深度比另外兩支低（抽 41 家：roa 41、roic 32，期數中位 19 vs 13），analysis-ts 查過是結構性的：有效稅率要
  // 「所得稅 ÷ 稅前淨利」，稅前虧損那一季算不出來、近四季一季虧整期就 null，已寫進它的 limitations。
  // roce 2026-09-30 整支刪除（analysis-ts 4c69d0ca）：跟 ROE 的全市場排名相關係數 0.971（2026Q2、1,847 家），幾乎沒有額外資訊。
  { slug: 'roa', metricCode: 'roa', compareMetricCode: 'roe', timeframe: 'TTM', topic: '資產報酬率', titleKeywords: 'ROA 資產報酬率與資產運用效率', related: ['roe', 'dupont', 'roic'] },
  { slug: 'roic', metricCode: 'roic', compareMetricCode: 'roe', timeframe: 'TTM', topic: '投入資本報酬率', titleKeywords: 'ROIC 投入資本報酬率與閒置現金', related: ['roe', 'roa', 'dupont'] },
  // 營業利益率 2026-09-21：三率中間那一支，沒有徽章所以在這裡。上線時型錄三段文案是 null（資料本來就齊：20 期 TTM＋Q），頁面
  // 自己 noindex；analysis-ts 同日補了文案（face95d8），sitemap 依即時型錄的 description 過濾，所以頁面自己回到 sitemap
  // （0 → 176 條），這裡不用翻任何旗標——下次頁面先於文案就緒時照這個模式。
  { slug: 'operating-margin', metricCode: 'operatingMargin', timeframe: 'TTM', topic: '營業利益率', titleKeywords: '營業利益率本業獲利占比' },
  // 市場估值的兩支沒有徽章的。metricCode 很重要：型錄每個比率有兩支，exchangePeRatio／exchangePbRatio 是交易所公布值、只有 EOD、
  // 沒有溯源，metrics-history 回不了東西；peRatio／pbRatio 是計算值，有序列（2330 20/20）與溯源。別因為名字看起來官方就改。
  { slug: 'pe-ratio', metricCode: 'peRatio', timeframe: 'TTM', topic: '本益比', titleKeywords: 'PER 本益比與歷年區間', riverKind: 'pe' },
  // 第一個只有 Q 的指標頁（pbRatio 的 fields 只有 Q）：latest 與單季數字是同一期，StockMetricDetailPage 的 hasTrailingFigure 守這個
  { slug: 'pb-ratio', metricCode: 'pbRatio', timeframe: 'Q', topic: '股價淨值比', titleKeywords: 'PBR 股價淨值比逐季數據', riverKind: 'pb' },
  { slug: 'bvps', metricCode: 'bvps', timeframe: 'Q', topic: '每股淨值', titleKeywords: '每股淨值逐季變化與帳面價值', related: ['pb-ratio', 'equity-source', 'equity-growth'] },
  // 安全韌性 2026-09-21：沒有徽章的三支，全部只有 Q。不在這裡的：長債比例（longTermDebtToNetCurrentAssets 當時 2330 8 期、其他
  // 1 期；totalDebtToCapital／equityRatio／debtToFcf 同樣只有 1 期，一列的歷史表是薄頁）→ 回填後加回（見下面那筆）；
  // altmanZScore／ohlsonOScore／zmijewskiScore 等多變數迴歸分數（「複合運算、徽章性質遠勝於指標性質」）；五支銀行比率
  //（約 95% 的公司讀 不適用）。
  { slug: 'quick-ratio', metricCode: 'quickRatio', timeframe: 'Q', topic: '速動比率', titleKeywords: '速動比率扣除存貨的償債力' },
  // 堆疊組成（2026-10-09，使用者「負債比率可以拆成流動負債、非流動負債、負債總計就好」）：analysis-ts 1e7c7d0f 新增兩支，分母同為期末
  // 總資產、相加＝debtRatio（排除金融保險後 108Q3～115Q2 不相等 0 筆），金融業 not_applicable_industry。全市場回填中：一期都拆不開時
  // 圖退回單色長條、組成段不顯示，所以先接上不會畫錯。
  { slug: 'debt-ratio', metricCode: 'debtRatio', timeframe: 'Q', topic: '負債比率', titleKeywords: '負債比率總負債佔總資產', related: ['debt-composition'] },
  // 負債組成：同一個母項的第二頁（2026-10-09 使用者要求拆開），只多組成段與自己的文案。
  // 2026-10-09 換成九項（使用者選「九項逐科目」，analysis-ts bef862d4）：流動五項相加＝流動負債、非流動四項相加＝非流動負債，
  // 九項合計＝debtRatio；兩個「其他」是上游推算的差額（型錄有寫明），前端不做任何相減。
  { slug: 'debt-composition', metricCode: 'debtRatio', timeframe: 'Q', topic: '負債組成', valueTopic: '負債比率', copyKey: 'debtComposition', titleKeywords: '負債組成借款應付帳款與公司債', partMetricCodes: ['shortTermBorrowingsToAssets', 'accountsPayableToAssets', 'contractLiabilitiesToAssets', 'currentPortionOfLongTermDebtToAssets', 'otherCurrentLiabilitiesToAssets', 'longTermBorrowingsToAssets', 'bondsPayableToAssets', 'leaseLiabilitiesToAssets', 'otherNonCurrentLiabilitiesToAssets'], related: ['debt-ratio'] },
  // 有息負債權益比：上線前撤回、同一小時加回（analysis-ts 8f7b4ddd）——formulaLatex 乘了 100 而 unit 寫 倍，把 13.44% 印成
  // 「13.4 倍」（對照 debtRatio 30.94%、equityRatio 69.06% 抓到）；存值一直是百分比，只有單位標錯。slug 與 topic 跟著改名後的指標：
  // 分子只有有息負債，`debt-to-equity` 會承諾傳統的總負債÷權益；舊 slug 沒發布過，沒有網址要保留。
  { slug: 'interest-bearing-debt-to-equity', metricCode: 'deRatio', timeframe: 'Q', topic: '有息負債權益比', titleKeywords: '有息負債權益比槓桿水準' },
  // 長債比例（2026-09-21 analysis-ts 同日回填後加回）：重量 2330／1101／2454 都 10/10；1216 仍 1/10 是對的——食品公司多數季度
  // 沒有長期負債，頁面逐期顯示 尚無資料
  { slug: 'long-term-debt-to-net-current-assets', metricCode: 'longTermDebtToNetCurrentAssets', timeframe: 'Q', topic: '長期負債對淨流動資產比', titleKeywords: '長期負債對淨流動資產比' },
  // 成長動能 2026-09-21（「sidebar 加一個成長動能，放淨值成長、投資支出等等」）：五支都沒徽章。排除 ruleOf40／sue／sgr／
  // priceToResearchRatio／threeMarginsRising（「更忠於財報」），六支 CAGR 因長度不放。capexToRevenue 的型錄分類是營運效率不是
  // 成長動能，是這條「導覽群組＝型錄分類」規則的刻意例外（要求點名了投資支出）。營收成長與淨利成長互指：兩者的差是財報三率回答的。
  // revenue-growth 跟 /monthly-revenue 並存（2026-09-23 問過兩次「還有保留必要嗎」）：revenueGrowthRate.Q 是合併報表數字，
  // 月營收是母公司申報——抽 30 檔 22 檔兩者都有，14 檔不一致（5301 差 26.2pp、1101 每一季都差到 5.3pp），大型電子股剛好一致才
  // 看起來像重複。related 把月營收放第一：同一個問題早兩到四個月的答案。
  { slug: 'revenue-growth', metricCode: 'revenueGrowthRate', timeframe: 'TTM', topic: '營收成長年增率', titleKeywords: '營收成長年增率與逐季變化', related: ['monthly-revenue', 'net-income-growth', 'margins'] },
  { slug: 'net-income-growth', metricCode: 'netIncomeGrowthRate', compareMetricCode: 'epsGrowthRate', timeframe: 'TTM', topic: '淨利成長年增率', titleKeywords: '淨利成長年增率逐季變化', related: ['eps', 'revenue-growth', 'margins'] },
  { slug: 'equity-growth', metricCode: 'equityGrowthRate', compareMetricCode: 'bvpsGrowthRate', timeframe: 'Q', topic: '淨值成長年增率', titleKeywords: '淨值成長年增率逐季變化', related: ['equity-source', 'capex-to-revenue', 'net-income-growth', 'dividend-payout-ratio'] },
  { slug: 'capex-to-revenue', metricCode: 'capexToRevenue', timeframe: 'TTM', topic: '資本支出佔營收比', titleKeywords: '資本支出佔營收比投資強度' },
  { slug: 'rd-intensity', metricCode: 'rdIntensity', timeframe: 'TTM', topic: '研發費用率', titleKeywords: '研發費用率佔營收比重' },
  // 獲利品質 2026-09-21（跟獲利能力分開：一個是賺多少、一個是賺的有沒有現金撐）：沒徽章的三支，深度齊、有溯源。排除 beneish 三支、
  // piotroskiFScore（有自己的頁）、abnormalCapexRatio（模型偏差不是申報比率）；fcfMargin 只有 1 期（回填後再看）。
  // 連續獲利年數 2026-09-22 下架（「資料怪怪的」）：basis=FY 同一年回好幾列而且計數會動（2330 2024=5,5,5,6；1101 2025 年中歸零；
  // 2454 與 2891 序列相同），型錄 metadata 沒錯、是序列不按年；等 analysis-ts 確認一年一列且單調再加回。
  { slug: 'ocf-to-net-income', metricCode: 'ocfToNetIncome', timeframe: 'TTM', topic: '營業現金流對淨利比', titleKeywords: '營業現金流對淨利比' },
  { slug: 'fcf-conversion-rate', metricCode: 'fcfConversionRate', timeframe: 'TTM', topic: '自由現金流轉換率', titleKeywords: 'FCF 轉換率現金含金量' },
  { slug: 'ocf-margin', metricCode: 'ocfMargin', timeframe: 'TTM', topic: '營業現金流利潤率', titleKeywords: 'OCF 利潤率營收轉現金比率' },

  // ── 損益表那一條鏈（2026-09-25）── 由下而上做的分組：量哪些申報值相加會閉合，長出來的就是損益表本身——營收 −營業成本 = 毛利
  // −營業費用 = 營業利益 ＋業外 = 稅前 −稅 −少數股權 = EPS；全是恆等式不是相關性（/dividend-source 在投信投顧法下說得出口的同一個理由）。
  // 營業費用＝推銷＋管理＋研發＋預期信用減損；業外＝利息收入＋其他收入＋其他利益損失＋權益法 −財務成本（財務成本以正數申報，該減）。
  // 閉合率 2026-09-25 實測 94.8%（母體 1883）／95.1%（1865）——同日稍早是 96.3%，差別是金融股進了母體，不是資料變壞。閉合 ≠ 可畫：
  // 預期信用減損 22.5% 為負、權益法 35.4%、其他利益損失 24.4% 為負，部分-整體的長條畫不出負塊。覆蓋率刻意不寫（回填中會變）。
  // 砍掉兩支：每股少數股東損益 49.5% 的公司值為 0、每股預期信用減損 30.2% 為 0——noindex 擋「沒有值」擋不了「值是 0」。
  { slug: 'revenue-per-share', metricCode: 'revenuePerShare', timeframe: 'TTM', topic: '每股營收', titleKeywords: '每股營收逐季數據', related: ['revenue-growth', 'gross-profit', 'psr'] },
  { slug: 'cost-of-goods-sold', metricCode: 'operatingCostsPerShare', timeframe: 'TTM', topic: '每股營業成本', titleKeywords: '每股營業成本與毛利的關係', compositionNote: '看不到，而且不是暫時的。損益表只申報一個營業成本總額，材料、人工、製造費用的明細不在申報用的科目表裡——一般產業與保險業連「員工福利費用」「折舊攤銷」這兩個欄位都沒有，所以不是等誰去補。折舊與攤銷只有全公司一個總數，沒有拆成營業成本與營業費用各多少。想知道成本佔營收多少，看毛利率；想知道這家公司的資產有多重，看每股折舊攤銷——但那是全公司的折舊加攤銷、含非營業的部分，不是營業成本裡的一項。', related: ['revenue-per-share', 'gross-profit', 'gross-margin'] },
  { slug: 'gross-profit', metricCode: 'grossProfitPerShare', timeframe: 'TTM', topic: '每股毛利', titleKeywords: '每股毛利逐季數據', related: ['gross-margin', 'cost-of-goods-sold', 'operating-income'] },
  { slug: 'operating-expense', metricCode: 'operatingExpensePerShare', timeframe: 'TTM', topic: '每股營業費用', titleKeywords: '每股營業費用的四個組成', partMetricCodes: ['sellingExpensePerShare', 'administrativeExpensePerShare', 'researchAndDevelopmentExpensePerShare', 'impairmentLossGainIfrs9PerShare', 'bankEmployeeBenefitsExpensePerShare', 'bankDepreciationAmortisationExpensePerShare', 'bankGeneralAdministrativeExpensePerShare'], related: ['selling-expense', 'administrative-expense', 'rd-expense'] },
  { slug: 'selling-expense', metricCode: 'sellingExpensePerShare', timeframe: 'TTM', topic: '每股推銷費用', titleKeywords: '每股推銷費用逐季數據', related: ['operating-expense', 'administrative-expense'] },
  { slug: 'administrative-expense', metricCode: 'administrativeExpensePerShare', timeframe: 'TTM', topic: '每股管理費用', titleKeywords: '每股管理費用逐季數據', related: ['operating-expense', 'selling-expense'] },
  // rd-intensity 是比率、這一支是它的每股金額，所以是不同的 slug 不是同主題的第二頁
  { slug: 'rd-expense', metricCode: 'researchAndDevelopmentExpensePerShare', timeframe: 'TTM', topic: '每股研發費用', titleKeywords: '每股研發費用逐季數據', related: ['rd-intensity', 'operating-expense'] },
  { slug: 'operating-income', metricCode: 'operatingIncomePerShare', timeframe: 'TTM', topic: '每股營業利益', titleKeywords: '每股營業利益逐季數據', related: ['operating-margin', 'gross-profit', 'pretax-income'] },
  { slug: 'non-operating-income', metricCode: 'nonOperatingIncomeExpensesPerShare', compareMetricCode: 'operatingIncomePerShare', timeframe: 'TTM', topic: '每股業外損益', titleKeywords: '每股業外損益的五個組成', related: ['non-operating-income-ratio', 'interest-income', 'finance-cost'] },
  // 業外損益占稅前淨利比（2026-09-30 直接問「沒有呈現業外損益佔稅前淨利比？」）：上一支是金額，這一支才回答「獲利多依賴非本業」。
  // 分母用稅前淨利不用營業利益是量出來的（抽 68 檔單季：業外÷營業利益最大 2787%、業外÷稅前淨利最大 97%，天然有界）。
  // 上游原本只有 Q，之後補 TTM（一次性項目要連續看好幾季，近四季正好平滑）；三段文案上游都齊（analysis-ts 22c20761），不另寫。
  { slug: 'non-operating-income-ratio', metricCode: 'nonOperatingIncomeRatio', timeframe: 'TTM', topic: '業外損益占稅前淨利比', titleKeywords: '業外損益占稅前淨利比與本業依賴', related: ['non-operating-income', 'operating-income', 'pretax-income'] },
  { slug: 'interest-income', metricCode: 'interestRevenuePerShare', timeframe: 'TTM', topic: '每股利息收入', titleKeywords: '每股利息收入逐季數據', related: ['cash-per-share', 'non-operating-income', 'finance-cost'] },
  { slug: 'finance-cost', metricCode: 'financeCostPerShare', timeframe: 'TTM', topic: '每股財務成本', titleKeywords: '每股財務成本與利息負擔', related: ['non-operating-income', 'interest-coverage', 'interest-bearing-debt-to-equity'] },
  { slug: 'other-income', metricCode: 'otherRevenuePerShare', timeframe: 'TTM', topic: '每股其他收入', titleKeywords: '每股其他收入逐季數據', related: ['non-operating-income', 'other-gains-losses'] },
  { slug: 'other-gains-losses', metricCode: 'otherGainsLossesPerShare', timeframe: 'TTM', topic: '每股其他利益及損失', titleKeywords: '每股其他利益及損失逐季數據', related: ['non-operating-income', 'other-income'] },
  { slug: 'equity-method-income', metricCode: 'shareOfProfitLossOfAssociatesPerShare', timeframe: 'TTM', topic: '每股權益法投資損益', titleKeywords: '每股權益法投資損益逐季數據', related: ['non-operating-income', 'roe'] },
  { slug: 'pretax-income', metricCode: 'pretaxIncomePerShare', timeframe: 'TTM', topic: '每股稅前淨利', titleKeywords: '每股稅前淨利逐季數據', related: ['operating-income', 'income-tax-expense', 'eps'] },
  { slug: 'income-tax-expense', metricCode: 'incomeTaxExpensePerShare', timeframe: 'TTM', topic: '每股所得稅費用', titleKeywords: '每股所得稅費用與所得稅利益', related: ['pretax-income', 'eps'] },

  // ── 營運周轉（2026-09-26）── 「庫存應該放在哪裡」引出來的一組：營業成本＝期初存貨＋本期進貨−期末存貨，存貨是損益表第二刀上唯一的
  // 閥門；應收掛第一刀（營收認列了、錢收到沒），應付是反向。六支全是 TTM。深度：2330 24 期回到 2020Q3，其餘典型 19 期、開頭四季
  // insufficient_history——只有第一期是移動平均暖機，另外三期是近四季窗口壓到 2020Q4 全市場缺單季損益表，mops 補完就有值
  //（2026-09-26 更正）。24 < 40 期所以「近 10 年」視窗一律停用。恆等鏈（2330 TTM，閉合到分）：存貨 72.56＋收現 26.49＝營運週期 99.05，
  // −付現 21.03＝現金轉換循環 78.02。文案全來自 GET /metrics（analysis-ts 1b7bcc8e），topic 跟它的 name（DSO→應收帳款收現天數）。
  // 其餘 10 支週轉率沒有 description，沒有文案就不開頁。
  { slug: 'inventory-days', metricCode: 'inventoryDays', timeframe: 'TTM', topic: '存貨週轉天數', titleKeywords: '存貨週轉天數與庫存去化速度', related: ['cash-cycle', 'cost-of-goods-sold', 'inventory-to-revenue', 'operating-cycle'] },
  { slug: 'inventory-to-revenue', metricCode: 'inventoryToRevenueRatio', timeframe: 'TTM', topic: '存貨占營收比', titleKeywords: '存貨占營收比與庫存水位', related: ['inventory-days', 'cost-of-goods-sold'] },
  { slug: 'receivables-days', metricCode: 'receivablesDays', timeframe: 'TTM', topic: '應收帳款收現天數', titleKeywords: '應收帳款收現天數 DSO 與收款速度', related: ['cash-cycle', 'revenue-per-share', 'operating-cycle', 'accruals-ratio'] },
  { slug: 'payables-days', metricCode: 'payablesDays', timeframe: 'TTM', topic: '應付帳款付現天數', titleKeywords: '應付帳款付現天數 DPO 與付款節奏', related: ['cash-cycle', 'cost-of-goods-sold', 'cash-conversion-cycle'] },
  { slug: 'operating-cycle', metricCode: 'operatingCycle', timeframe: 'TTM', topic: '營運週期', titleKeywords: '營運週期從進貨到收款的天數', related: ['cash-cycle', 'inventory-days', 'receivables-days', 'cash-conversion-cycle'] },
  // 每股現金及約當現金（2026-09-30，從「是什麼產生每股利息收入？」來的，analysis-ts 6fba7cc5 補上）。不設成 interest-income 的
  // compareMetricCode：2330 每股現金 120.86 元對利息收入 1.16 元差 100 倍，共用線性軸會貼在零軸上；兩頁互為 related。
  // Q：現金是季末存量，近四季加總沒意義（同 bvps），上游也只給 Q。文案上游三段齊全，不另寫。
  { slug: 'cash-per-share', metricCode: 'cashPerShare', timeframe: 'Q', topic: '每股現金及約當現金', titleKeywords: '每股現金及約當現金逐季變化', related: ['interest-income', 'cash-conversion-cycle', 'ocf-to-net-income'] },
  { slug: 'cash-conversion-cycle', metricCode: 'cashConversionCycle', timeframe: 'TTM', topic: '現金轉換循環', titleKeywords: '現金轉換循環與資金被綁住的天數', related: ['cash-cycle', 'operating-cycle', 'payables-days', 'ocf-to-net-income'] }
]

export function findMetricPage(slug: string): MetricPageDefinition | null {
  return METRIC_PAGES.find(page => page.slug === slug) ?? null
}

// related 的目的地標籤由擁有那一頁的登記表給，呼叫端不寫字——改名不會在別人的頁上留下舊標籤。兩份登記表都查（/eps 是指標頁、
// /roe 是徽章頁，「相關指標」兩種都要能點名）；未知的 slug 直接丟掉不丟錯（這個月撤過兩頁，不能把鄰居一起拖下去）。
// 關係頁（各自有路由檔、沒有登記表）手寫在這裡：它們正因為不是單一指標才最常被當成 related 目的地；五筆，手動同步比檢查便宜。
const RELATIONSHIP_PAGES: Record<string, string> = {
  margins: '財報三率',
  solvency: '安全韌性的組成',
  dupont: '杜邦分析',
  'monthly-revenue': '月營收',
  'dividend-fill': '填權填息',
  'dividend-source': '配息從哪來',
  'cash-cycle': '現金循環的組成',
  'equity-source': '淨值從哪來'
}

export function resolveRelatedPages(slugs: string[] | undefined): { slug: string; topic: string }[] {
  return (slugs ?? [])
    .map(slug => {
      const relationship = RELATIONSHIP_PAGES[slug]
      if (relationship) return { slug, topic: relationship }
      const page = findMetricPage(slug) ?? findBadgePage(slug)
      return page ? { slug, topic: page.topic } : null
    })
    .filter((entry): entry is { slug: string; topic: string } => entry !== null)
}

// 唯一會靜默壞頁而不報錯的不變量：兩份登記表都認領的 slug 會渲染分派器先測到的那個模板，另一頁變成無法到達。開發時由分派器呼叫。
export function assertMetricPagesDisjoint(): void {
  const collision = METRIC_PAGES.find(page => BADGE_PAGES.some(badge => badge.slug === page.slug))
  if (collision) throw new Error(`[metric-pages] slug "${collision.slug}" is in both METRIC_PAGES and BADGE_PAGES`)
}
