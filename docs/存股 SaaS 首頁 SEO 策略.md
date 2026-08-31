# **存股型 SaaS 首頁搜尋引擎最佳化（SEO）架構與實務策略報告**

在金融科技與訂閱制軟體（SaaS）深度整合的市場環境中，以「存股」、「被動現金流管理」與「股息複利試算」為核心功能的 SaaS 工具面臨高度競爭的自然搜尋環境。存股型 SaaS 首頁不僅是品牌轉化與產品導流的核心樞紐，更是搜尋引擎衡量全站主題權威性（Topical Authority）與架構權重的根本基礎。  
此類平台的首頁 SEO 必須同時克服三大維度的挑戰：首先是現代 JavaScript 前端框架在動態金融數據渲染上引發的檢索與索引延遲；其次是金融投資主題在搜尋引擎演算法中所受到的極高 YMYL（Your Money or Your Life）與 E-E-A-T（經驗、專業、權威、信任）檢驗；最後則是多元功能模組（如除權息日曆、高股息 ETF 篩選器、定期定額計算機）與首頁之間的關鍵字內部競爭。針對上述核心議題，本報告深入分析存股型 SaaS 首頁的技術架構、語意標記、金融信任防線、資訊架構與轉化分流策略。

## **技術架構與現代 JavaScript 渲染機制**

多數金融與存股 SaaS 平台為提供流暢的圖表交互與資產試算體驗，傾向採用 React、Vue 或 Angular 等前端框架構建應用程式1。然而，純客戶端渲染（CSR, Client-Side Rendering）會使原始 HTML 缺乏實質文本內容，搜尋引擎爬蟲必須耗費額外資源進入第二階段的 JavaScript 渲染佇列（Rendering Queue）1。這種機制不僅大幅消耗檢索預算（Crawl Budget），且一旦動態 API 或腳本回應超時，搜尋引擎便可能直接跳過內容索引，對首頁的關鍵字排名造成致命打擊1。

### **伺服器端渲染與靜態生成架構**

為確保搜尋引擎能夠在首次請求時完整獲取頁面內容，存股 SaaS 的行銷首頁必須嚴格採用伺服器端渲染（SSR, Server-Side Rendering）或靜態網站生成（SSG, Static Site Generation）架構1。 透過 SSR 或 SSG 技術，首頁的核心產品價值主張、定價資訊、功能特色與結構化資料會在伺服器端組裝為純靜態 HTML 後輸出至客戶端1。至於高度動態的即時股市行情、盤中走勢或使用者個人化試算組件，則應採用客戶端水合（Client-Side Hydration）或非同步 API 載入，並在靜態 HTML 中保留適當的預設文字與骨架結構，確保爬蟲在不執行複雜腳本的情況下即可完成全頁文意解析1。

### **核心網頁指標（Core Web Vitals）效能最佳化**

金融工具的使用者對載入延遲極為敏感，技術效能的落差會直接轉化為流量流失與跳出率升高，研究顯示每 1 秒的頁面載入延遲可能導致高達 7% 的轉化率損失3。針對 Google 官方核心網頁指標，首頁前端工程應落實嚴格的效能治理3：

| 核心網頁指標（CWV Metric） | 官方合規門檻 | 存股 SaaS 首頁技術成因與工程優化對策 |
| :---- | :---- | :---- |
| **最大內容繪製（LCP, Largest Contentful Paint）** | **![][image1]** | 首頁主視覺（Hero Visual，如存股資產儀表板截圖）應轉為次世代 WebP 或 AVIF 格式並進行代碼預加載（Preload）；同時對非首屏圖片實施延遲載入（Lazy Loading），並對第三方分析與客服腳本設置 async 或 defer 屬性以避免主線程阻塞3。 |
| **下次繪製互動（INP, Interaction to Next Paint）** | **![][image2]** | 存股試算器與動態報酬圖表常占用大量主線程運算；應透過代碼分割（Code Splitting）縮小 JavaScript 封包體積，將重度試算邏輯移交 Web Workers 處理，確保點擊與輸入事件能獲得即時響應3。 |
| **累計版面配置位移（CLS, Cumulative Layout Shift）** | **![][image3]** | 動態股市報價跑馬燈、即時殖利率排行榜卡片或第三方認證徽章在非同步加載時易導致版面劇烈晃動；開發團隊必須在 CSS 中為所有動態元件與圖表容器預先設定明確的寬高比例（Aspect Ratio）3。 |

### **行動優先索引與通訊安全**

隨著多數個人投資者轉向行動裝置進行資產追蹤，搜尋引擎全面採用行動優先索引（Mobile-First Indexing）機制2。首頁的行動版與桌面版必須具備高度一致的文字內容、標題層級（H1–H3）、內部連結與結構化標記，嚴禁在行動裝置上以隱藏關鍵文字的方式精簡版面3。此外，全站必須強制實施端到端 HTTPS 加密傳輸，杜絕任何資源混合內容（Mixed Content）警告，確保用戶財務資料與帳號資訊的傳輸安全4。

## **結構化資料體系與生成式 AI 檢索最佳化（Schema & GEO）**

結構化資料（Structured Data）是建立搜尋引擎語意理解與爭取 SERP 複合式搜尋結果（Rich Snippets）的核心技術3。隨著生成式搜尋引擎（如 Google AI Overviews、Perplexity、ChatGPT）的普及，結構化資料已成為生成式引擎最佳化（GEO, Generative Engine Optimization）的基礎，為大型語言模型提供可直接引用的客觀事實圖譜3。  
在存股 SaaS 首頁中，必須透過 JSON-LD 格式建立多重實體結構（Entity Relationship），將企業品牌、軟體產品本體、定價策略與常見問答無縫串聯3。

| 結構化資料類型（Schema Type） | 必要與建議屬性（Properties） | 存股 SaaS 首頁之具體應用效益 |
| :---- | :---- | :---- |
| **SoftwareApplication / WebApplication** | name, applicationCategory: "FinanceApplication", operatingSystem: "Web", offers, aggregateRating, featureList | 明確將系統歸類為金融應用軟體（FinanceApplication），避免落入通用型工具競爭池；直接在搜尋結果中呈現軟體版本、定價區間與支援平台6。 |
| **AggregateRating** | ratingValue, ratingCount, bestRating, worstRating | 引入第三方客觀評分平台或應用程式商店之真實審查數據，觸發 SERP 星級評價摘要，大幅提升自然搜尋點擊率（CTR）3。 |
| **Organization** | name, url, logo, sameAs (官方社群/專業機構), contactPoint | 確立公司法律實體身分，強化品牌知識圖譜（Knowledge Graph）建構，有助於鎖定品牌搜尋詞的權威展示版位3。 |
| **FAQPage** | mainEntity (包含 Question 與 Answer) | 針對存股族最在意的安全性、數據授權來源、稅費計算模型進行問答標記，爭取搜尋結果折疊式問答版位並提升 AI 摘要引用率2。 |

在推動 GEO 策略時，首頁文案應避免模糊的行銷辭彙，轉而採用具備高事實密度的陳述方式。例如明確敘述「本系統提供台股與美股市場歷史股利自動匯入、除權息日曆提醒、定期定額年化報酬率（IRR）精算與股息再投資計畫（DRIP）複利回測模型」，這類結構精確的事實陳述能被大型語言模型高效率解析，顯著提高品牌在 AI 生成解答中作為權威工具被推薦的機率3。

## **金融領域 YMYL 與 E-E-A-T 權威信任體系**

存股決策直接影響個人財務健全與資產配置，因此存股 SaaS 網站被搜尋引擎嚴格界定為 YMYL 核心類別12。若首頁缺乏充足的專業度（Expertise）、權威度（Authoritativeness）與信任度（Trustworthiness），即使技術指標達標，搜尋引擎亦會壓低其核心商業關鍵字的排名潛力12。

### **專業背景與權威信號背書**

首頁應公開產品背後金融研究團隊或計量分析專家的專業資歷，包含特許金融分析師（CFA）、證券投資分析人員（CSIA）或合格財務規劃師之認證名錄，並透過外部專業機構連結確立實體關聯11。同時，系統應在首頁清晰標註底層數據來源的合法性與權威性，例如載明「股市歷史行情與除權息數據串接自台灣證券交易所（TWSE）、證券櫃檯買賣中心（TPEx）及公開資訊觀測站」，透過數據公信力確立專業根基12。

### **計算模型透明度與金融合規免責**

存股軟體常見的收益試算案例或複利模型，若未載明限制條件，容易被演算法判定為誤導性財務承諾14。首頁的試算展示區必須明確標示計算假設，例如是否扣除二代健保補充保費、股利所得稅級距、證券交易稅與券商手續費折讓等實際成本17。在頁面顯著位置與頁尾，必須配置標準金融法規免責聲明，強調「本軟體之試算數據與歷史回測僅供投資輔助與財務規劃參考，不構成任何有價證券之買賣建議或獲利保證」，藉由合規性降低搜尋引擎對財務風險內容的處罰機率14。  
首頁亦應整合社會認同指標（Social Proof），例如揭露平台管理的追蹤資產規模（Assets Under Tracking）、實際付費用戶評價，以及權威財經媒體的報導紀錄，建立多維度的信任網絡4。

## **資訊架構、內部連結權重分配與關鍵字防蠶食策略**

存股 SaaS 通常包含眾多次級功能專頁，如高股息 ETF 專區、除權息日曆、定期定額試算器、個股殖利率排行與競品比較頁面1。首頁作為全站權重最高的核心節點，必須承擔流量樞紐與權重分流的角色，同時避免與深層功能頁面產生內部關鍵字競爭（Keyword Cannibalization）1。

### **扁平化架構與三跳原則（3-Click Rule）**

首頁必須遵循扁平化資訊架構（Flat Architecture）設計，確保搜尋引擎爬蟲與終端使用者能在距離首頁 3 次點擊以內，觸達全站所有核心功能頁、使用情境頁與定價頁面1。

Level 0: 首頁（品牌詞 / 存股軟體 / 股息管理系統等頂級大詞）  
   │  
   ├── Level 1: 核心解決方案與產品矩陣（3 次點擊內直達）  
   │      ├── /features/dividend-tracker（除權息追蹤系統）  
   │      ├── /features/compound-calculator（定期定額與複利試算工具）  
   │      ├── /features/etf-screener（高股息 ETF 篩選專區）  
   │      └── /pricing（定價方案頁面）  
   │  
   └── Level 2: 長尾衍生主題與比較評案  
          ├── /compare/vs-competitor（競品功能客觀評比）  
          └── /knowledge-base/drip-guide（存股策略與知識庫專題）

透過主導航列（Header Navigation）、首頁核心功能矩陣卡片以及頁尾語意化連結，首頁能將累積的外部連結權重（PageRank）穩定輸送至底層轉換頁面；同時搭配麵包屑導航（BreadcrumbList），協助爬蟲精準識別網站的層級拓撲1。

### **首頁內容模組與意圖導流規劃**

首頁的視覺與文案結構應採取「痛點導向（Problem-First）」的設計思維，開門見山點出投資者在存股管理時的痛點，再引導至相對應的產品方案與轉換管道18：

| 首頁模組區塊 | 標題標籤與文案焦點（Copywriting Focus） | 目標搜尋意圖（Search Intent） | 內部連結與轉換路由（Conversion Routing） |
| :---- | :---- | :---- | :---- |
| **首屏核心區（Hero Section）** | **H1**: 痛點導向核心大詞（如「告別混亂記帳：專為存股族打造的自動化股息追蹤與現金流管理系統」）18 | 存股軟體、存股 App、股息記帳工具、被動收入管理平台（商業調查/類別詞意圖）2 | 部署雙軌轉換機制（PLG 免費試用與產品 Demo 預覽），引導即時產品體驗18。 |
| **核心功能矩陣（Features Grid）** | **H2**: 模組化解決方案（如「即時除權息日曆」、「定期定額複利試算器」、「高股息 ETF 深度評估」）1 | 定期定額試算、除權息日曆查詢、ETF 殖利率比較（工具與功能型意圖）2 | 分流連結至二級功能 Landing Page，錨定文字（Anchor Text）需精確對應功能關鍵字4。 |
| **定價與方案模組（Pricing Snapshot）** | **H2**: 簡明方案對比（最多展示 3 種級距，標註主力方案，降低決策疲勞）18 | 存股軟體費用、存股 SaaS 訂閱方案（高轉換交易型意圖）2 | 連結至完整定價細節頁面（/pricing），提供功能權限展開表18。 |
| **常見問答區塊（FAQ Section）** | **H2 / H3**: 針對資安隱私、證券 API 授權、報價更新頻率之結構化解答3 | 存股試算準確度、券商帳號串接安全嗎（資訊型與疑慮消除意圖）2 | 綁定 FAQPage 結構化資料，內嵌知識庫專題與客戶支援中心連結3。 |

### **關鍵字意圖消歧與防蠶食策略**

在存股領域中，「存股軟體推薦」屬於高維度的軟體類別詞，而「定期定額複利計算機」或「00878 配息試算」則屬於具體工具型搜尋詞1。首頁的 SEO 目標應聚焦於高概括性的品牌詞與類別核心詞，對於特定計算功能與個股/ETF 分析，首頁僅需以摘要卡片形式呈現，並透過精確的錨定文字導流至底層獨立頁面1。同時，首頁必須設置自引用規範標籤（Self-referential Canonical Tag），在面對帶有行銷追蹤參數的 URL 時，一律將權重統一導向首頁標準網址，避免內部多個 URL 版本分散權重1。

## **結論與執行落地指南**

存股型 SaaS 首頁的搜尋引擎最佳化是一項結合前端渲染技術、金融領域專業信任、精準語意標記與科學化分流架構的系統工程4。  
在技術層面上，首頁必須全面落實 SSR 或 SSG 預先渲染架構，徹底解決 JavaScript 框架帶來的爬蟲渲染延遲與檢索預算浪費問題，並藉由靜態資源優化使各項核心網頁指標達到標準（![][image4]、![][image5]、![][image6]）1。在語意層面上，應完整部署 SoftwareApplication（分類設為 FinanceApplication）、AggregateRating、Organization 與 FAQPage 結構化標記，建立清晰的實體網絡，以爭取豐富搜尋結果並提升生成式 AI 搜尋引擎的引用機率3。  
在內容與信任維度上，必須嚴格遵循 YMYL 與 E-E-A-T 規範，透過專家名錄、合法數據來源標註、透明的稅費試算模型與合規免責聲明建立權威防線12。最後，首頁應作為扁平化資訊架構的核心樞紐，在維持 3 次點擊可達原則的前提下，專注承接高意圖的類別詞與品牌詞，將細分工具搜尋詞精準分流至二級頁面，並搭配問題導向的文案與產品驅動（PLG）雙軌轉換設計，實現自然搜尋流量與訂閱營收的同步增長1。

#### **Works cited**

> 1. Technical SEO for SaaS Companies: The Complete 2026 Guide, [https://www.rzlt.io/blog/the-complete-guide-to-technical-seo-for-saas-companies-in-2026](https://www.rzlt.io/blog/the-complete-guide-to-technical-seo-for-saas-companies-in-2026)  
> 2. A Guide to SEO for SaaS in 2025 \- MRS Digital, [https://mrs.digital/blog/guide-to-seo-in-the-world-of-saas/](https://mrs.digital/blog/guide-to-seo-in-the-world-of-saas/)  
> 3. Technical SEO for SaaS: Site Speed, Mobile, Schema, and Ranking, [https://discoveredlabs.com/blog/technical-seo-for-saas-site-speed-mobile-schema-and-ranking-factors-that-matter](https://discoveredlabs.com/blog/technical-seo-for-saas-site-speed-mobile-schema-and-ranking-factors-that-matter)  
> 4. The technical SEO foundations every SaaS website needs to scale, [https://whippetdigital.com/technical-seo-foundations](https://whippetdigital.com/technical-seo-foundations)  
> 5. Enhancing SaaS Product Development with Technical SEO Best, [https://dev.to/nithinsys9786/enhancing-saas-product-development-with-technical-seo-best-practices-1ibd](https://dev.to/nithinsys9786/enhancing-saas-product-development-with-technical-seo-best-practices-1ibd)  
> 6. Software Application Schema Generator \- Content Powered, [https://www.contentpowered.com/tools/software-application-schema-generator/](https://www.contentpowered.com/tools/software-application-schema-generator/)  
> 7. Schema Markup for SaaS: 5 Types That Actually Matter, [https://piperocket.digital/blogs/schema-markup-for-saas/](https://piperocket.digital/blogs/schema-markup-for-saas/)  
> 8. Free Software Application Schema Markup Generator — JSON-LD, [https://www.schemapilot.app/tools/schema-markup-generators/software-application/](https://www.schemapilot.app/tools/schema-markup-generators/software-application/)  
> 9. SoftwareApplication Schema \- JSON-LD Guide & Examples \- Unhead, [https://unhead.unjs.io/docs/schema-org/api/schema/software-app](https://unhead.unjs.io/docs/schema-org/api/schema/software-app)  
> 10. applicationCategory Schema Field: Format and Examples, [https://www.karpi.studio/schema-glossary-terms/application-category](https://www.karpi.studio/schema-glossary-terms/application-category)  
> 11. Schema Markup Implementation Guide \- agentkits-marketing \- GitHub, [https://github.com/aitytech/agentkits-marketing/blob/main/skills/schema-markup/references/schema-implementation-guide.md](https://github.com/aitytech/agentkits-marketing/blob/main/skills/schema-markup/references/schema-implementation-guide.md)  
> 12. E-E-A-T & YMYL SEO: The Complete 2026 Trust & Quality Guide, [https://outpaceseo.com/article/eeat-seo/](https://outpaceseo.com/article/eeat-seo/)  
> 13. Google's E-E-A-T: The Complete Guide \- Impression Digital, [https://www.impressiondigital.com/blog/e-e-a-t/](https://www.impressiondigital.com/blog/e-e-a-t/)  
> 14. Why Google EEAT Guidelines For Financial Services Matter, [https://absolute.digital/insights/why-does-e-e-a-t-matter-in-financial-services/](https://absolute.digital/insights/why-does-e-e-a-t-matter-in-financial-services/)  
> 15. The Ultimate Guide to Building E-E-A-T for Your Website., [https://neuronwriter.com/the-ultimate-guide-to-building-e-e-a-t-for-your-website/](https://neuronwriter.com/the-ultimate-guide-to-building-e-e-a-t-for-your-website/)  
> 16. EEAT SEO Optimization \- Ultimate Guide To Execute For SEO, [https://thatware.co/eeat-seo-ultimate-guide/](https://thatware.co/eeat-seo-ultimate-guide/)  
> 17. E-E-A-T SEO Checklist : How to Succeed in a World Where AI Writes, [https://gvnmarketing.com/seo/eeat-seo-checklist/](https://gvnmarketing.com/seo/eeat-seo-checklist/)  
> 18. SaaS Website Best Practices for 2026: From Static Pages ... \- Spike AI, [https://getspike.ai/blog/saas-website-best-practices/](https://getspike.ai/blog/saas-website-best-practices/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAWCAYAAACffPEKAAAAuklEQVR4Xu2VMQ6BQRBGR0QhEo2EKIVEotLpXUCiUrmCC7iBuIDECRzAX9OoHMYJvMlS7EbxRzkzL3nVV+03O7siQRAEwd90cY83HBeZeXp4wDsusZnHthnhWdLkF9jIY9tM8fJxJo4OrwfVaV8lTV9vgTtW+MK1OJr8L1w/gCXfr/Ah6Ya4LqODO3ziFtt57IsWbiSVoaVoOW7RtdD1qHBSZEFgCN37AQ5r2BejP8YcTzU9SiojCIzxBgSNGXP6pSfuAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAAAWCAYAAAC1zAClAAAAwUlEQVR4Xu3WMQ4BURCH8RFRiEQjIUohkah0eheQqFSu4AJuIC4gcQIHsDWNymGcwH/yKN5Wa+0q1vdLvmq6yeTtmgEA8GfaaqsuapiaIaeO2qmrmqt6PEYeA3W0cKkzVYvHyGOsTq8mxlK/5gv06zxbuFa/WhRkoR5qaVxqKfhw/cD7l+tm4aJZcglaaqPuaq2a8RhFaKiVhSX7sn3pKJg/D/5MJGqUmgGoHH9Xe6qfoa7xB/GRqTpkbG9hyQAq6QlXtBlzkZnRKwAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAWCAYAAAC2ew6NAAAAtElEQVR4XmNgGAWjYBTQHfABcQ0QHwJiZTS5QQGEgbgbiA8DsRMQM6NKDzxQBOK5DJAQNAdiRlTpgQfqQLwairUYBpkDQY4Bhdp2BkgogkJzUAJ/IP4ExEEMgywEsYFBn2nQAawYOsEACelB72BuIM4H4nNAHAfEnKjSgw+wAnEEA8TBIIeDPDCoASgJgJLCDiBWQZMbBUMWgNKhOBBLEoHFGAawJDAA4llE4l4GiINHwZAGAP7/GXOObKYMAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAG4AAAAaCAYAAABW6GksAAAEvklEQVR4Xu2Ye+hlUxTHlzzyNsM03vmZmQjjUV4R9SOJRGJmUhSRxl+EPEOIPyRCioQ8EuIPkueIQSEmr/jHI488/hBFKOTx/cw6y91n33PPOfea34zM/tS37t17n3vW3muvtde+ZoVCoVBYA2wqTUuLpN2kdav2TaQdqs+FVcxh0rfSX4l+k5ZJWyXjmthdek36SXpYOk+6T3pO2kN6WjqiGrux9ID5b8d7/pC+TNrelg6X1qmeWd1sK10u3SFdJS2od49kT2mxNNfcdjbyodLJ6aCZ4k7pT+movKOB9aXLzBf8YmmjevdKo380d0oecXtXfY9K6yXt/MZN5s48LmmfBBbvQOlFc/v6cID5ZsV2bHzSfDOdb90b6SSrb3z0hbRPOmgmmC29KX0mbV/vGgKn3Sb9Lp2Y9QUbmk8c8TnlBPOJEZ05x5r3NT3XB1I0EfuKdL11Z4yATfOYdLoN0jzPviH9LO1btY0Cuz+p9Lp0jrR5bcQMwbn0nQ1HQRNnmS/uJda+E++VLs0bxS3mTj8k7zBPLfx2HztS2Ezs+vfMM8G4i0aK/Nw8ExBtAfaP2mQpOO6ivHF1EAvW9XJy/tfSR9KOWV8OqTfOt4Dcv9x8Z25d71rpqAfN7cAJfSBSiJJ3pDPMi6FJwPE3S8+aOzFgPfqsy7iOY8PvIi2VTjUPnINrI3rSFgUpV5pP5NqsvYktzBckpS2ySbvYQBrOn8shoi6U3jJ3ctf4ScA+7OTMna53DYHjyDDPmG/KT6UzbZB2U3DaDdI15uc/a/K4+fNjEedbUxSkRLRQwOSR1BeKDhy/wrxyCy03f/8Sa55symbS8+bnILbPFBQ3nG/Y17UxcNwL0pbVdzIThRmbKz9OWGM23P5JG87DmWPRFgWwgbnhcQ58I82rjegPkY3jKZ35vRCFQD7BNiYtQvpCtmBz3G/90i+FVFpMMReuPjhv56Qd5kgfSO9Lp5hHHevLhhyLON+aDmAMuFpaaAPHofQcaIICJs/ZEbFNV4RJwb4o+2+1brv6wCLeLt1ow9eccSD1sa5H5x3iGPNoph99bBNcHSgiRp1vhPxd5hOIlNrlOHb/3eaX0ZSI7ElL/TZw4F7mF34WbNd6d2/CaVTMkbKx+8h/RgxDkfGV9ITVHR2OI402wRpMS9dJP5hHYL5mI2m7vzEJ8nt6+ycPt13SWUAit+l+F/e3caqvSSA1sdlwIs7sm4IZx2X73OpzQOWH7QFpdDsbjOGOR/SkjqOPVNl0B2TT41QyUMCln2o9HzuSeGl+vvHjOI3bPwsR7CR9KL0sbZO0A0ZfYcMTB76Tyv5NYTMuzIF38hdWF9h3mvSLeSpn3qHvbZCNyCbvSr9KB1VtOBInTVXfgc8UW02FDXZxxuGsgKOIy34ePEOweHg4ciwlLwYjPkc796q8YJmSXjWf5D3m9xDuQBQK+f+MpAPG8F9m+q6XzA/p/wpxfoeNqdJijCh5ynzzsomD/cwrRS7sZ5tnsIfMnZrDu1g/Mt0j5tmBZ5vOwlUOzpmSjq8037rL+P87VJ+chazHlA1nnYB14g93mGV+rq01a8eE0+tEm9KzpLAGIf1eYPULfJv6/n1WKBQKhUKhUCisBfwN0C0A7jlzgSMAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIIAAAAaCAYAAAB7NoTTAAAFYElEQVR4Xu2Ya8hmUxTHl1CMewghBpGS5BaFGmkiudQohnHJjMsHpQiFMpFcPsgtyiVJkkvJBymjRkO5Jh/cSjLkUoQvfEAu/9+sszz77Gef5zyX933nTftf/97n7L3Pe/Ze67/XWnubVVRUVFRUVFT0Y6X4s/hPwl/FK9NBwuqmPcY8KG6R9O8jfpb0w/uavmXi91kf3/yh+c3/vVfcsRm/0NhSPF18qOE54ratEQ7azhcfEe8WD2l3/wfa6Wcc40v/a1EChz4h/i2ekvWl2F58VfxD/EZc2u7ehBvFO8yNm+Mx8U/xhKz9SHNR8L/5xizgu2eJb4vnZn0lbC0+IN4iHiheJv4mfiTul4zbSVwn3mY+xyPET8QVyRjAM+30M47xvMf7ix67iO+JG8W9210tHCA+aq52dvJV7e5NwKi5o8EO4hviF+IeWR8Ge936hTgKOPQ88QPxanG7dncnThVfs/a6V5mvD+Fu1bTdYG4jbBW4QPzUBuvZV/y8aQ+EbUu2WnQ4ynwXvGCDhZdwmnideJj4i/muS5XOop+1YUeDQ8WfrPyNMFYpWvQBh+N4duGlNnkYxsHh9ABpjogXoo35PZmMAceYp7Uzm2cEgB2xZ4Bo+7S50GeNdvMOFoAxrsk7Mqw137E48hnzHcyOCuDsh5v+HBir6xvHi7/bsLBGgXriZvN3zjaPCNPgaPFD8fKkbS/xq4b8DhHnQogNdHvzfH/znAoB8B41EhE1BcJAdMvNv8EamA/rIboAhHSwed3CmDzlshHYoNeKJ5mLc/fWiDER9UHfbuSD7JoIoQgAISCIcDyCKjkaYKTSN3A8oflHcyP0AcfcY55mTrZhw8wFmCNzfVHcxgYO7xJCtPO3Swildhz+rfkGobB8ytyGN5mPX9O0Y1OKd8ZSpIe9Ecab4nHmdrlI/NqGvzMWIuyVcneKqA8wDMCB7EZSBKkC3GXDjgZRA7DrCZMsDmKg78yFyM7oA2PIwZxGlmR9cwV2JfNhXcc2bWeYO2uUEGKNJYd3CQFEGkprjainsNeJTRsg8kSUAggEe7KZA7da+Tu9mLQ+SEEBhIHW2nj1wTrzSpyFBENY42LaonBcrDAP42nRytr7hMA8iGwlh48SQqQhImYgRIUYEEWAeiYVwhXiX+YFOqLlPeYxVZqctD5IsdQGal5m/fUBR8u5QnpMpFaYizsIjInAyLMp8hTQ1d7l8K52EELAyYEQAkwLzFwIROXnrX0/Q1SeWAiElHHqAyZD/srDN+9zTmYC75srtATUPsvRcBQQBLUCu4faIYw0KRAB+fag5hlBrxJ3Nk+LRIkuIYTACd0lh/MeGya3H5hFCAAf7C9eLK43t3N+GdiLSe8PSmGc+oB82iWmyHcbbfQ3ZgUGOVx8RXzcypddXSBdkRr5G9jNvI5h/uGYl61tA4TN5VoInMhHqE4Fz3jey98NzCIEUnUcXQGR4DkbFmwvxqkPMPAl5lev/M7Be5wcPjY3Xo4QSpch5gNc8RIyV+YdBewpbjC/8qbiDnLTiVHDLkQH2kNgEQ3TI++u4rvmaTRAhCEaUNeUEMVimjZHCYFai5ornpljpALmxKkiFdVIXGherae5hYWvTgeZhxgUH2N4h6vTHBwl02MkoNpFvek3MHb+jc0NjJbOMWXcDwCMTQ203vzYhwgQf24PjsBfitebn/2JuF15O7cvIkJw2Cm1GW1vJW28w7tEhHfMxUj0esn8FDHuXUzFlGDHxeUOlzcl5wIq9+XWvhiaD3CEpkZiHpzW0ujxvwaOIPymx89RXKhUVLHAoIK/0wYXUn1k11ZUVFRUVFRUVFRUVFRMhX8Bk91fgPxUxxAAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAAAaCAYAAABM1ImiAAAEGElEQVR4Xu2YXahOWRjHH/mImHzGaEbOGWryeTOTQTSHpNGkhKJcTI1CUswUMyRO5GpyYYiSz6lJUy5cmJmixkFxQYoyFySHZJqRG+GCfPx/rXeds9919nr3fvc5nZOx//Wrc9ba795rP59rbbNSpUqVeuc0SDSJpWKC6F0ZHyg+rvzdVRou5pt7Xv/K2Ggx2F/wPmqiuCyeit/E9+IXcUZMEn+KeW1XO80Rj8SbBC/EWXNGjgmnHhVXxUqxRVwXzeK8GNF2Zfepl/hC/Cz2i6+tPQjzqkEsDwfzqq/Yas6AP4oB1dM2WzwRDyyeEYfEa/FVOJEiMg7n7jT3bK/x4qE5B2GUzois2idOiyHBXJp43iZzQdBoLoh+FQeteo1pomqsFX+JV+J49XQ+8ZAD4qVYEsx5UTJ+r+DLR1JDxRXRKj6qnkoVEXNTjArGMQYvvzoYr0cY8bC57J1q+R36mfhXzEqMfSLuWXZw4YhFYqa5YC3kiDXmyslmq71obk75SBMLeSxOij7BXCjmue6i+CCYQ3vNGaUesW6MjvG596fV07m0y5zRySQv1sc682Yov+UedTvCl4LbYkwwF4rSE/YHrxXmnPlDOJEiylKLuRReZh1fEIOGpTEmfktNP2euDGW9Q0w+40NH+LWS7WR9lgo7otmcAYmGLLGLidVKmhulLZnWtdRs1Y2dKGaHltcBNFAaKdH6k9XeFOSRN3jMEeF4TIUc4R9Cg41Feh75/nDHOtb8mHAqvSC504I/zK0rSxvNZfK0cKKgvAFDg3eLI/yP/jHXlIoqqz/0s3gmMT7d3M6EzKgnKBqtWFNOEwFEIIUG71ZH5HkIDZ0dQZp8f+DMEQrj7BCTK/9Tesa2T1dpnbn7LAwnMsTa6Q/0CfpFEYfEDB4bj6mQI3xJyXoI9feIGBlOVEQTj/UHNgNEra/9XMN5JU04IHafPGKd9Av6Rr0HMb+TC23hHRHb4YUq5Ai022ofwoguIj12vqh1fqDsUHLIGC92VTT2UDyHw12L5esRtcSJfb24Zu68EiuLoVgbJZZS68XpnvNOcs3cj6xOu29hR3DDW+KC+DCYI4q3ie8snu7s959Zx/7AgnDCfXO1HPmooxY3VMa8KHuso6uaL2L934pTYlgwlyayl8NY8vMEXxT+EzMSYwQvJbQ5MeblHcFGJGazqBrEJfFcHBPfiD3m0nGupd+Qhsquxe92OBPwEsDffvyEtTuIjOGzBhnWau3PInqIui8r1/WkFou7YpW5tf1t7tNF0gYbzG0sklUCe4Tvzve6G2JK4rpM8aAGc8d0GGf11dg8Iip9+eIA1WTu7PC5pad5T4leQ7+Czp5P/vfCkZSBPGDMtKwu1QVaYK4H5WG7dX4DUKpUqVKlSpUqVapH9RaF3N2Qp/XH7QAAAABJRU5ErkJggg==>