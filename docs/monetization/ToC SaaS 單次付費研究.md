# **ToC SaaS 單次付費模式研究報告：商業架構、財務模型與產品實踐**

在消費級軟體市場中，純訂閱制（Pure Subscription）曾長期被視為軟體即服務（SaaS）的唯一標準模式。然而，隨著各類串流影音、生產力工具及數位服務滲透日常，消費者端出現了廣泛的「訂閱疲勞」（Subscription Fatigue）現象1。數據顯示，一般消費者每月需管理高達 133 美元的各類訂閱支出，年化負擔超過 1,600 美元2。高達 42% 的消費者感到訂閱負擔過重，近 47% 的使用者曾為了削減開支而主動退訂服務2。在此背景下，大量非高頻、非剛需的消費級軟體面臨獲客轉化率低落的困境，甚至有近 30% 的年訂閱用戶在首月即關閉自動續費，導致消費級 SaaS 的月均流失率常態性徘徊在 2.5% 至 6.8% 的高水位，年化用戶流失規模達到 30% 至 50%2。  
與此同時，生成式人工智慧（GenAI）與運算密集型應用的爆發，徹底打破了傳統軟體「零邊際成本」的定價前提6。由於每一次模型推理與 API 調用均對應著明確的第三方 Token 或雲端 GPU 成本，固定月費的無限量訂閱模式極易引發「重度用戶侵蝕毛利」的財務災難6。因此，將單次付費（One-Time Payment）與混合收費（Hybrid Monetization）重新引入 ToC SaaS 產品架構，已成為軟體企業突破獲客瓶頸、對沖算力成本與擴大潛在市場規模（TAM）的核心策略1。

## **1\. ToC SaaS 單次付費商業模式分類與核心機制**

單次付費並非單一的交易結構，而是涵蓋預付額度、瞬時解鎖、後付計量與永久買斷等不同維度的收費組合9。各模式在價值計量標準、使用者心理門檻及底層技術架構上存在顯著差異。

| 商業模式類型 | 計費單位（Value Metric） | 預付／後付性質 | 營收確認時點 | 適用情境與典型品類 | 使用者心智負擔 |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **點數額度制 (Credits)** | 虛擬貨幣／運算點數 | 預付（Prepaid） | 點數消耗（履約）時確認11 | 生成式 AI、圖像與音訊生成、資料爬取12 | 中等（需換算單次操作點數）14 |
| **單次功能解鎖 (Feature Unlock)** | 單次特定任務／輸出成果 | 預付或即時結算 | 交付檔案或解鎖瞬間 | PDF 格式轉換、履歷高階模板下載、單次修圖1 | 極低（一手交錢一手交貨） |
| **按量計費 (Pay-as-you-go)** | 實際調用量（API 次數、GB、Token） | 通常為後付（Post-paid）或預扣錢包 | 運算完成或週期結算時15 | 開發者工具、雲端儲存、低階運算調用15 | 高（費用上限不可預測）17 |
| **終身買斷制 (Lifetime Deal / LTD)** | 軟體主版本授權或永久帳號 | 一次性高額預付 | 視合約義務逐期攤提或即期認列18 | 獨立工具軟體、原生桌面應用、初期募資驗證18 | 零後續負擔（擁有感最強）1 |

點數額度制在生成式 AI 領域迎來爆發式增長，相關市場採用率正以倍數攀升22。該模式本質上建立了一個抽象代幣層（Abstraction Layer），將後端異質的運算支出（例如不同參數量的大語言模型、輸入與輸出 Token、GPU 渲染時長等）整合轉化為消費者易於理解的內部統一貨幣8。用戶預先購買點數包，並在每次調用產品功能時依據任務複雜度扣減點數24。此機制的優勢在於能隔離底層技術成本波動，同時消除用戶直接面對複雜硬體計費單位的排斥感8。  
單次功能解鎖通常針對明確的單次產出（Artifact-based Value）進行定價，例如去除特定圖片背景、生成單份高階履歷或完成單次格式轉換1。該模式的價值主張直接且封閉，通常嵌入於免費用戶的關鍵行動節點中，以極低金額的微交易（Micro-transactions）促成即時轉化，對偶發性需求用戶的摩擦力最小1。  
按量計費承襲了雲端基礎設施的經典計費邏輯，其核心原則為依據實際資源消耗結算費用1。然而，純後付式的按量計費在 ToC 領域存在天然缺陷，因為消費者對不可預測的月底帳單普遍具備強烈的防衛心理17。因此，現代消費級 SaaS 多採用「預存錢包餘額」（Pre-funded Wallet Balance）機制，要求用戶預先儲值，並在後續使用中即時扣抵，讓用戶在保有彈性的同時能夠精確掌控消費上限16。  
終身買斷制源於傳統套裝軟體的永久授權（Perpetual License），用戶支付一次性較高金額即可享有長期或永久的使用權限1。此模式常被獨立開發者或早期新創團隊用於 Product Hunt 或 AppSumo 等平台進行冷啟動驗證，以換取即時的現金流與種子用戶回饋18。但在具備持續雲端運算與維護成本的 SaaS 模式中，終身制可能演變為沉重的長期負債，需藉由版本號鎖定或功能邊界條款進行嚴格約束18。

## **2\. 單次付費與訂閱制之量化經濟模型與消費者心智比較**

在評估商業模式轉型時，必須深入剖析單次付費與定期訂閱在轉化漏斗、留存表現與生命週期價值上的本質差異。

| 評估維度 | 單次付費模式 (One-Time / Credits) | 純訂閱制模式 (Recurring Subscriptions) | 深度機理與經濟效應 |
| :---- | :---- | :---- | :---- |
| **獲客轉化率 (Conversion Rate)** | 高（通常為純訂閱的 1.5x \- 3x）1 | 低至中等（消費級 App 普遍付費轉化率在 2% 左右）28 | 消除自動續訂扣款焦慮，大幅降低消費者的決策防衛心理1。 |
| **顧客終身價值 (LTV)** | 呈現長尾分布；取決於回購頻次與點數包定價階梯 | 理論上限高，但受高流失率（每月 3% \- 6%）顯著折損1 | 單次購買 LTV 往往受限於單價，但高流失消費級訂閱的實際存續週期常短於預期1。 |
| **現金流穩定度 (Predictability)** | 具波動性與週期性，受行銷驅動與淡旺季影響17 | 極高，具備可預測的月營收（MRR）與年營收（ARR）30 | 單次付費為前置注入營運資本；訂閱制則具備複利積累效應1。 |
| **用戶流失率 (Churn Rate)** | 結構性「零續費流失」（無定期帳單），轉向沉睡分析1 | 明確的月／年解約流失率（年流失率普遍逾 30%）2 | 單次付費並無主動取消動作，但存在「購買後不再使用」的沉默流失風險1。 |
| **獲客成本回收 (CAC Payback)** | 極快（往往在交易發生當下完成即時回收）1 | 取決於訂閱定價與續訂週期，通常需 3 至 9 個月33 | 單次付費能迅速釋放行銷預算，支撐激進的付費獲客管道。 |
| **消費者心理帳戶 (Mental Accounting)** | 視為「專案性支出」或「工具耗材費用」1 | 視為「長期經常性負擔」或「固定租金」1 | 當軟體不具備日常黏著度時，消費者傾向單次結算而非背負租金1。 |

從獲客轉化漏斗來看，消費級訂閱應用從下載到付費的轉化率中位數僅約 2%，即便是採取免費試用（Free Trial）的產品，也有高達 96% 以上的下載用戶不會主動啟動試用29。在強制綁定信用卡的試用機制下，雖然試用轉付費率可達 48.8%，但其進入門檻過高，篩除了海量潛在用戶；免綁卡試用轉付費率則驟降至 18.2%34。單次付費模式徹底移除了「遺忘取消將被強制扣款」的防禦壁壘，使得處於評估階段的用戶能夠以極低的資金承諾完成首次交易，從而顯著提高首購轉化率1。  
在顧客終身價值與流失率的博弈中，訂閱制的優勢建立在高留存假設之上。然而，在當前消費市場中，除少數具備極強工作流嵌入性的產品外，多數非剛需應用的月流失率常態性達到 4% 至 6.8%，使訂閱的累積複利效應大打折扣2。單次付費雖然在單筆訂單的上限較低，但其不存在定期的續費中斷點，用戶在合約意義上的流失率為零1。  
就獲客成本回收（CAC Payback）與營運資本而言，單次付費具備即時現金注入的優勢1。高額買斷或大額點數包能夠在 Day 0 實現獲客成本的全額覆蓋甚至產生即時利潤，這使企業能夠以更健康的資本周轉率重啟付費行銷投放，而無需承受數月至半年的訂閱回本真空期1。  
從心理學視角分析，消費者將軟體支出劃分為不同的「心理帳戶」1。每月定期扣款被歸類為不可避免的生活固定開銷，引發嚴格的預算審查；而單次付費則被視為完成特定專案的必要工具耗材，其支付阻力遠低於持續性合約1。強制推行純訂閱制會將低頻但高意願的長尾用戶推向競品，而導入單次付費則能將這部分消費者剩餘有效變現1。

## **3\. 市場代表性案例分析：定價層級與用戶體驗策略**

市場領先的消費級 SaaS 已逐步脫離單一付費模式，廣泛轉向「以訂閱為主體、單次付費為側翼」的複合收費體系5。

| 案例企業 | 核心定位與場景 | 採納定價層級結構 | 單次付費計量機制 | 核心優勢與市場反饋 |
| :---- | :---- | :---- | :---- | :---- |
| **CleanMyMac** (MacPaw) | 系統清理與安全維護桌面軟體35 | 1\) 年訂閱制：$39.95/年 2\) 終身買斷：$119.95 3\) Setapp 聚合訂閱20 | 永久授權（限制於單一主版本號更新，跨版本升級另購）27 | 買斷定價設定為年訂閱的 3 倍，既滿足防禦訂閱的忠誠用戶，又突顯年訂閱的高性價比20。 |
| **remove.bg** (Kaleido) | AI 圖像自動去背工具13 | 1\) 免費預覽版 2\) 訂閱制（月配額）：如 $9/40 點 3\) 按量購買包：$3/3 點、$2.98/10 點起13 | 1 點 \= 1 張高解析度影像下載；訂閱點數每月過期，單次購買點數永久有效13 | 完美覆蓋電商賣家（高頻訂閱）與普通大眾（臨時偶發單次處理）的不同需求週期13。 |
| **ElevenLabs** | AI 語音合成與聲音複製38 | 1\) 免費層 2\) 多階訂閱：$5 至 $990/月 3\) 點數加購（PAYG Add-on）16 | 點數依文字字元數、模型階層動態扣除；允許隨時以單次付費增補餘額16 | 避免重度用戶因額度用罄而中斷業務，同時透過階梯價差引導升級高階訂閱16。 |
| **Cursor / Lovable** | AI 輔助程式開發與產品生成工具23 | 1\) 基礎席位費（按月） 2\) 內含高速運算配額 3\) 單次儲值運算點數包17 | 針對慢速/高速模型、運算時間（Checkpoint）消耗動態額度8 | 防止高額 GPU 推理成本擊穿訂閱費底線，將邊際成本完全與用戶增量使用掛鉤7。 |

在 CleanMyMac 的實踐中，開發團隊將一次性買斷授權與年度訂閱方案並置於結帳頁面20。這種雙軌定價產生了極佳的價格錨定效應：高於年費三倍的買斷價格，一方面為極度抗拒定期扣款的用戶提供了心理出口，另一方面則反襯出年訂閱方案的超高性價比，有效促成了訂閱轉化20。為了防止買斷機制拖垮長期的研發成本，CleanMyMac 明確規範買斷授權僅限於當前軟體主版本（如 CleanMyMac X）的修復更新，未來的跨代大版本升級需另行付費，從而在合約架構上切斷了服務成本的無限蔓延27。  
remove.bg 則採用了細緻的「點數效期劃分機制」13。訂閱方案所贈送的點數單價極低，但附帶月度失效限制（Use-it-or-lose-it），無法滾動累積，以此保障持續的經常性現金流13。與此相對，按量購買的點數包單價雖然高出數倍，但官方承諾點數永久有效13。這種產品策略精準切中了非專業用戶的痛點：偶發需求者寧可支付較高的單價，也不願承擔點數歸零的心理損失，企業藉此在長尾用戶身上獲取了顯著的定價溢價13。  
在 ElevenLabs 及 Cursor 等現代生成式 AI 工具中，單次付費成為維持用戶工作流不中斷的彈性緩衝層16。這類工具採用混合定價體系，基礎訂閱涵蓋了預期的基礎運算負載，而當創作者遭遇突發性專案需求導致額度告罄時，系統允許以單次加購方式儲值點數或開啟彈性按量計費，避免了用戶因額度耗盡而被迫中斷專案或流失至競爭平台16。

## **4\. 全球金流基礎設施與 Merchant of Record (MoR) 深度評估**

建置 ToC 單次付費功能時，技術架構選型最關鍵的決策在於：究竟應使用傳統的支付服務商（PSP）自建稅務系統，抑或全面託管予記錄商戶（Merchant of Record, MoR）41。MoR 在交易中扮演法定的銷售實體，直接向買方開具發票，並依法承擔全球超過 200 個法區的數位服務稅（Sales Tax / VAT / GST）申報與繳納義務41。

| 金流平台維度 | Stripe (純 PSP 模式) | Paddle (標準 SaaS MoR) | Lemon Squeezy (MoR, Stripe 旗下) | Gumroad (創作者/小品 MoR) |
| :---- | :---- | :---- | :---- | :---- |
| **官方標稱費率** | 2.9% \+ $0.3041 | 5% \+ $0.5041 | 5% \+ $0.5041 | 10% \+ $0.5041 |
| **疊加交易成本** | 跨境卡 \+1.5%、外幣換匯 \+1.0%41 | 已包含跨境費，換匯費 2% \- 3%41 | 跨境卡 \+1.5%、PayPal \+1.5%、訂閱 \+0.5%41 | 需額外扣除信用卡手續費 2.9% \+ $0.3041 |
| **真實綜合費率 (國際交易)** | 約 5.4% 至 5.9%（含 Stripe Tax）41 | 約 7.0% 至 8.0%41 | 約 7.5%41 | 約 12.9% 至 14.9%（市場導流達 30%）41 |
| **跨國稅務合規 (VAT/GST)** | 提供 Stripe Tax 計算（加收 0.5%），需企業自行申報註冊41 | 全自動處理全球 200+ 稅區申報與繳納，承擔審計責任41 | 全自動處理全球稅務合規申報與各國稅局對賬41 | 2025 年起升級為全功能 MoR，託管全球稅務41 |
| **防詐欺與風控** | Stripe Radar（自帶機器學習評分，重度需加收費） | 內建防欺詐引擎與人工交易審核，阻絕高風險詐騙 | 整合 AI 交易評分，有效壓低非授權交易率42 | 內建基礎風控，對惡意退款抗辯支援度較弱 |
| **爭議扣款 (Chargeback)** | 每筆爭議收取 $15（申訴成功返還）41 | 每筆爭議收 $15 至 $20，由平台律師團統一處理41 | 每筆爭議 $15，由 MoR 吸收處理作業41 | 扣回交易全額並轉嫁處理成本，無固定申訴通道41 |
| **提現結算週期** | T+2 滾動撥款，資金流動性最高41 | 月結（次月 15 日打款，門檻 $100）41 | 雙週結算（持留期 13 天，門檻 $50）41 | 週結（最低餘額門檻 $100）41 |

在評估兩者差距時，不可僅看表面標稱費率。Stripe 雖然牌面費率較低，但若加上國際卡處理費、貨幣轉換費以及 Stripe Tax 計算費，實際總交易成本已接近 5.9%41。更關鍵的隱形成本在於稅務申報負擔：當企業在美國多個州跨越經濟聯結（Economic Nexus）門檻，或在歐盟跨越 VAT 門檻時，自建團隊需負擔專用合規軟體（如 TaxJar）及外部會計師事務所的審計申報費用，每年的維護支出動輒數萬美元45。  
因此，對於年營收在 50 萬美元以下、團隊編制精簡且客戶分散全球的 ToC SaaS 而言，選擇 Paddle 或 Lemon Squeezy 這類 MoR 平台在財務上更為合算45。MoR 平台所收取的額外點數費用，本質上是一筆將跨國法規合規完全外包的保險支出45。然而，一旦企業年營收突破百萬美元級別，且用戶集中於少數特定市場時，自建基於 Stripe 的合規與稅務架構則能省下可觀的交易手續費差額45。  
在風險控管維度，單次付費面臨比訂閱制更嚴峻的詐欺挑戰。由於單次購買具備即時交付數位資產的特性，微額點數包常成為網路犯罪集團進行信用卡測卡（Card Testing）與盜刷套現的首要目標。為此，金流架構必須在前置端整合 3D Secure 2.0 動態驗證，並配置針對設備指紋、IP 地理位置偏差及購買頻率異常的即時評分機制，避免因爭議拒付率（Chargeback Rate）超過國際卡組織規定的 1% 紅線而遭到金流通道凍結41。

## **5\. 產品體驗與轉化漏斗設計最佳實踐**

將單次付費功能融入 ToC 產品時，必須精心設計使用者體驗與感知路徑，確保交易流程順暢，同時建立將單次付費用戶漸進式導向週期性訂閱的機制25。

### **額度消耗透明度與預算感知**

虛擬點數系統面臨的最大體驗障礙是「認知抽象」帶來的失控感10。若用戶無法直觀評估點數的購買力，便會產生支付遲疑10。領先的實踐是在軟體頂部全域導航欄（Global Navigation）常駐顯示當前可用餘額，並允許用戶在懸停時檢視近期的動態消耗歷史，使點數的扣減具備可追溯性13。  
在執行具體任務前，產品介面應提供明確的操作成本預告23。例如在按下「生成高解析度模型」按鈕旁，直接標記「本次任務將消耗 10 點（扣除後剩餘 45 點）」，消除用戶對扣費規模的疑慮23。在定價展示頁中，應盡量避免列出抽象的算力參數，而應提供互動式計算器，讓使用者勾選預計的產出數量（如生成圖像數、影片長度），自動推薦匹配的點數包規格，大幅降低心智轉換成本48。

### **低額度閾值通知與無縫內聯結帳**

點數耗盡通常發生在用戶全神貫注於產出流程的「心流」（Flow State）之中7。傳統的阻斷式彈窗往往會激發挫折感，進而導致用戶放棄操作7。優良的產品架構應當在用戶額度降至 20% 與 5% 的關鍵臨界點時，透過介面頂部非阻塞式（Non-blocking）的橫幅或微提示進行預先示警7。  
當額度不足以支撐下一次操作時，介面應當喚起輕量化的內聯結帳模態框（Inline Modal Checkout），直接調用 Apple Pay、Google Pay 或預存的信用卡憑證完成 1-Click 快速扣款42。整個交易過程不應跳轉離開當前工作介面，在支付確認後的數秒內自動接續中斷的運算任務，維護體驗的連續性42。

### **單次付費向訂閱制導流的飛輪機制**

單次付費並非產品變現的終點，而是培育高意願訂閱用戶的最佳前置漏斗1。產品團隊應透過精細化的行為數據監控，捕捉用戶升級訂閱的黃金時刻：

* **沉沒成本折抵機制**：針對在過去 30 天內多次購買單次點數的活躍用戶，系統可在結帳時提供動態補償優惠，允許將近期已支付的單次購買金額按比例折抵首月訂閱費用，消除用戶重複付費的損失厭惡心理1。  
* **經濟差距可視化**：當單次用戶累積購買次數達到閾值時，在加購介面呈現量身打造的支出對比圖表，清晰標明「您過去兩個月已累計購買 $60 點數；若切換為 Pro 訂閱，相同運算量僅需 $38，且享有優先運算排隊權」，以客觀的經濟利益驅動升級1。  
* **自動補足功能作為過渡跳板**：向單次用戶推薦開啟「當額度低於 10 點時自動扣款 $10 補足」的便利功能17。這項功能在心理層面上維持了單次付費的自主感，但在支付行為上實質建立了週期性自動扣款的習慣，是引導用戶最終接納長期訂閱的關鍵橋樑17。

## **6\. 單位經濟效益、財務合規與風險控管**

在營運深度整合第三方運算資源的 ToC SaaS 時，精確的財務建模與會計合規處理至關重要，否則單次付費帶來的營收增長可能直接轉化為經營性虧損與審計合規風險6。

### **邊際成本模型與毛利保護方程式**

在點數制架構下，單個用戶的單位毛利（Unit Gross Margin, ![][image1]）必須具備嚴格的下限保護。若將單點售價記為 ![][image2]，單點消耗對應的雲端硬體與第三方 API 成本記為 ![][image3]，金流通道的手續費率記為 ![][image4]，每筆交易的固定手續費記為 ![][image5]，單次購買點數包的內含點數規模為 ![][image6]。則單點淨毛利率 ![][image1] 可建立數學表達式如下：  
![][image7]  
化簡後可得：  
![][image8]  
為維持軟體事業普遍健康的毛利基準（![][image9]），定價架構必須嚴格落實兩項防護措施：  
首先是設定點數包的最小包裝規格（Minimum Pack Size），徹底消除固定手續費 ![][image5] 的侵蝕效應41。若平台收取每筆 $0.50 美元的固定附加費，而產品允許用戶購買 $1.00 美元的微額點數，則單是固定通道成本便會吃掉 50% 的毛利41。因此，單次購買的最低客單價通常必須設定在 $5.00 美元以上，以確保規模效應稀釋固定手續費佔比41。  
其次是建立動態點數扣除矩陣，使前端售價與底層技術成本實現解耦8。當上游 AI 廠商宣布模型價格變動時，軟體端無須修改前端對外的點數包定價，僅需微調後端特定任務的點數消耗權重（例如將進階演算消耗由 10 點調整為 8 點），即可精準鎖定預期毛利，避免因頻繁調整定價頁面引發市場反彈8。

### **收入認列會計合規：ASC 606 與 Breakage 處理**

在美國 GAAP（ASC 606）及國際 IFRS 15 規範下，預售點數在收取現金當日**絕不能**直接確認為營業收入11。預收款項代表企業對消費者的「履約義務」（Performance Obligation），在會計帳務處理上必須首先作為「合約負債」（Contract Liability）記入資產負債表中的遞延收入（Deferred Revenue）帳戶11。  
當用戶刷卡購買 100 美元的點數包時，會計分錄應借記（Debit）「現金」100 美元，同時貸記（Credit）「合約負債／遞延收入」100 美元，當期的利潤表營收為零19。後續唯有在用戶實際在軟體內執行任務並扣減點數時，企業方能按照已履約的比例，逐步借記「合約負債」，並貸記「營業收入」19。  
對於消費者購買後長期未消耗的點數，在財務上被稱為「未行使權利」或「沉澱額度」（Breakage）50。根據 ASC 606-10-55-48 指引，企業不得將這類資金視為意外之財而在過期時瞬間沖銷為利潤；唯有當企業具備足夠的歷史數據，能合理估計 Breakage 發生的比例時，方可按照全體用戶實際兌換點數的歷史模式（Proportionate to the pattern of rights exercised），將預期的沉澱額度按比例分期確認為收入32。  
此外，跨國法規對長期沉澱資產設有嚴格的「無人認領財產法」（Escheatment Laws）管制51。若發行的點數在法律層面被界定為預付儲值卡，且用戶帳戶處於長期靜止狀態，部分法區（如美國加州或德州）可能要求企業將未兌現的現金餘額解繳地方政府，而非留存為企業收益32。為規避相關金融監管風險，產品的服務條款（Terms of Service）必須明確聲明所購點數為「無任何現金價值、不可轉讓、不可退款且僅能用於兌換特定軟體數位服務之授權使用憑證」11。

### **系統架構安全性與防併發漏洞**

在技術架構層面，單次購買點數系統容易遭遇高併發競態條件（Race Condition）攻擊。若惡意用戶在短時間內並行發起數十個運算密集型請求，分散式資料庫的讀寫延遲可能導致餘額校驗失效，出現「點數被扣成負值」的系統漏洞。為此，後端架構必須引入 Redis 配合分散式鎖或 Lua 腳本實施原子級別的扣款操作（Atomic Deduction），並在微服務網關層強制實施配額預先凍結（Pre-authorization Reservation）機制，確保未授權的高額運算無法穿透至底層算力節點。

## **7\. 結論與落地決策矩陣**

ToC SaaS 軟體在制定商業變現策略時，不應將單次付費與訂閱制視為互斥的對立選項，而應將其整合為覆蓋不同用戶生命週期與需求頻率的複合變現體系1。

| 產品核心屬性 | 推薦計費組合模型 | 基礎設施選型建議 | 首要運營監控指標 |
| :---- | :---- | :---- | :---- |
| **低邊際成本、單一封閉功能** (如 PDF 轉換、修圖套件、系統維護) | **買斷制 (LTD) 或 單次功能解鎖** 搭配高階大版本付費升級1 | Lemon Squeezy / Paddle (MoR)41 | 首次轉化率、版本升級回購率、每筆客單價 (AOV) |
| **中低頻需求、高度依賴使用者靈感** (如簡報設計、影片特效生成) | **混合模式：無效期點數包 \+ 優惠訂閱** 以點數包作為試用緩衝區8 | Paddle 或 Stripe (視規模)41 | 點數包複購率、單次用戶向訂閱的月度遷移率 |
| **高變動邊際成本、運算密集型** (如大型語言模型整合、即時語音生成) | **混合模式：月訂閱基座 \+ 動態點數加購** 嚴格禁止純無限量訂閱8 | Stripe \+ 內建即時計量引擎7 | 實時邊際毛利率 (![][image1])、點數消耗速度 (Burndown Rate) |

推行單次付費機制的終極目標，並非放棄可預測的經常性訂閱收入，而是透過降低初期認知阻力與信任摩擦，最大化開拓潛在用戶底座1。在產品設計中貫穿清晰的點數感知、透明的定價換算以及無縫的升級路徑，同時在後端建構嚴謹的 ASC 606 遞延收入會計架構與毛利防護鎖，方能在消除消費者訂閱疲勞的同時，打造兼具爆發力與抗風險能力的長期商業模式2。

#### **Works cited**

> 1. One-Time vs Subscription Pricing for SaaS \- Dodo Payments, [https://dodopayments.com/blogs/one-time-vs-subscription-saas-pricing](https://dodopayments.com/blogs/one-time-vs-subscription-saas-pricing)  
> 2. The Subscription Trap Is Eating Everything (And We're All Complicit), [https://medium.com/@javierbaal/the-subscription-trap-is-eating-everything-and-were-all-complicit-43129c475072](https://medium.com/@javierbaal/the-subscription-trap-is-eating-everything-and-were-all-complicit-43129c475072)  
> 3. Customer Retention Statistics 2026 | 80+ Facts & Data \- Searchlab, [https://searchlab.nl/en/statistics/customer-retention-statistics-2026](https://searchlab.nl/en/statistics/customer-retention-statistics-2026)  
> 4. Average Churn Rate for Subscription Services | Focus Digital, [https://focus-digital.co/average-churn-rate-subscription-services/](https://focus-digital.co/average-churn-rate-subscription-services/)  
> 5. State of Subscription Apps 2025 \- RevenueCat, [https://www.revenuecat.com/state-of-subscription-apps-2025](https://www.revenuecat.com/state-of-subscription-apps-2025)  
> 6. Credit-Based Pricing for AI: How It Works, Where It Fails, [https://softwarepricing.com/blog/credit-based-pricing-ai/](https://softwarepricing.com/blog/credit-based-pricing-ai/)  
> 7. AI Credits for Startups: How They Work and Best Practices \- Schematic, [https://schematichq.com/blog/ai-credits-for-startups](https://schematichq.com/blog/ai-credits-for-startups)  
> 8. Tokens vs credits vs hybrid: which fits AI products? \- Credyt, [https://credyt.ai/blog/tokens-vs-credits-vs-hybrid-pricing](https://credyt.ai/blog/tokens-vs-credits-vs-hybrid-pricing)  
> 9. Choosing the Right SaaS Pricing Strategy \- NXT1, [https://nxt1.cloud/blog/saas-business/choosing-the-right-saas-pricing-strategy-for-optimal-growth-and-profitability/](https://nxt1.cloud/blog/saas-business/choosing-the-right-saas-pricing-strategy-for-optimal-growth-and-profitability/)  
> 10. The buyer's guide to credit-based AI pricing \- HubSpot Blog, [https://blog.hubspot.com/website/ai-credits-buyers-guide](https://blog.hubspot.com/website/ai-credits-buyers-guide)  
> 11. Startup Revenue Recognition: GAAP Best Practices, Clean ARR, [https://www.equidam.com/startup-revenue-recognition-gaap-arr-best-practices/](https://www.equidam.com/startup-revenue-recognition-gaap-arr-best-practices/)  
> 12. How AI Made Pricing Hard Again \- Every, [https://every.to/p/how-ai-made-pricing-hard-again](https://every.to/p/how-ai-made-pricing-hard-again)  
> 13. What are image credits? – remove.bg, [https://www.remove.bg/help/a/what-are-image-credits](https://www.remove.bg/help/a/what-are-image-credits)  
> 14. Best AI Support Tools for SaaS in 2026 | by Zeyad Genena \- Medium, [https://medium.com/conversational-ai-weekly/best-ai-support-tools-for-saas-in-2026-1f590a3fd83c](https://medium.com/conversational-ai-weekly/best-ai-support-tools-for-saas-in-2026-1f590a3fd83c)  
> 15. Mastering SaaS Subscription Pricing: Strategies to Improve, [https://www.cloudblue.com/blog/saas-subscription-pricing/](https://www.cloudblue.com/blog/saas-subscription-pricing/)  
> 16. Pay As You Go | ElevenLabs Documentation, [https://elevenlabs.io/docs/overview/administration/pay-as-you-go](https://elevenlabs.io/docs/overview/administration/pay-as-you-go)  
> 17. AI's Pricing Journey | OpenMeter by Kong, [https://openmeter.io/blog/ai-pricing-journey](https://openmeter.io/blog/ai-pricing-journey)  
> 18. The Rise of Lifetime Deals: Why More SaaS Startups ... \- VirtusNova, [https://virtusnova.marketing/resources/blog/lifetime-deals-saas-growth-strategy/](https://virtusnova.marketing/resources/blog/lifetime-deals-saas-growth-strategy/)  
> 19. Deferred Revenue Journal Entry: How to Record It (With Examples), [https://www.dualentry.com/blog/deferred-revenue-journal-entry](https://www.dualentry.com/blog/deferred-revenue-journal-entry)  
> 20. Choose the right CleanMyMac subscription plan \- MacPaw, [https://macpaw.com/store/cleanmymac](https://macpaw.com/store/cleanmymac)  
> 21. CleanMyMac X: One-Time Purchase License \- StackSocial, [https://www.stacksocial.com/sales/cleanmymac-x-2-macs?aid=a-d64cwes9](https://www.stacksocial.com/sales/cleanmymac-x-2-macs?aid=a-d64cwes9)  
> 22. What Is a Credit? Understanding AI Usage-Based Pricing \- Tropic, [https://www.tropicapp.io/blog/what-is-a-credit-ai-pricing](https://www.tropicapp.io/blog/what-is-a-credit-ai-pricing)  
> 23. A guide to the design of credit-based pricing for AI agents \- Ibbaka, [https://www.ibbaka.com/ibbaka-market-blog/a-guide-to-the-design-of-credit-based-pricing-for-ai-agents](https://www.ibbaka.com/ibbaka-market-blog/a-guide-to-the-design-of-credit-based-pricing-for-ai-agents)  
> 24. AI monetization strategy: Pricing models for AI systems, [https://dev.to/selectiveduplicate/ai-monetization-strategy-pricing-models-for-ai-systems-2i9i](https://dev.to/selectiveduplicate/ai-monetization-strategy-pricing-models-for-ai-systems-2i9i)  
> 25. Credit-based pricing: The shift to flexible monetization \- Alguna Blog, [https://blog.alguna.com/credit-based-pricing/](https://blog.alguna.com/credit-based-pricing/)  
> 26. What Is a Subscription Business Model? \- Zuora, [https://www.zuora.com/glossary/subscription-business-model/](https://www.zuora.com/glossary/subscription-business-model/)  
> 27. CleanMyMac purchase options \- MacPaw, [https://macpaw.com/support/cleanmymac/knowledgebase/purchase-options](https://macpaw.com/support/cleanmymac/knowledgebase/purchase-options)  
> 28. 6 steps to design a freemium tier that drives upgrades \- RevenueCat, [https://www.revenuecat.com/blog/growth/freemium-tier-design](https://www.revenuecat.com/blog/growth/freemium-tier-design)  
> 29. State of Subscription Apps 2023 \- RevenueCat, [https://www.revenuecat.com/state-of-subscription-apps-2023/](https://www.revenuecat.com/state-of-subscription-apps-2023/)  
> 30. Subscription Business Models: Types, Pricing, And The Shift To Hybrid, [https://www.chargebee.com/blog/subscription-business-models/](https://www.chargebee.com/blog/subscription-business-models/)  
> 31. Subscription Pricing Models: A Comprehensive Guide \- HubiFi, [https://www.hubifi.com/blog/subscription-pricing-models-guide](https://www.hubifi.com/blog/subscription-pricing-models-guide)  
> 32. How do companies account for gift cards? \- Reddit, [https://www.reddit.com/r/Accounting/comments/1g239ti/how\_do\_companies\_account\_for\_gift\_cards/](https://www.reddit.com/r/Accounting/comments/1g239ti/how_do_companies_account_for_gift_cards/)  
> 33. Why are React Native apps making more money? \- RevenueCat, [https://www.revenuecat.com/blog/engineering/why-react-native-apps-make-more-money](https://www.revenuecat.com/blog/engineering/why-react-native-apps-make-more-money)  
> 34. Free Trial Conversion Rate Benchmarks by Model 2026 \- Vmobify, [https://vmobify.com/blog/free-trial-conversion-rate](https://vmobify.com/blog/free-trial-conversion-rate)  
> 35. MacKeeper vs CleanMyMac: which one to choose?, [https://cleanmymac.com/blog/cleanmymac-vs-mackeeper](https://cleanmymac.com/blog/cleanmymac-vs-mackeeper)  
> 36. CleanMyMac pricing increased from 2019 to 2025 almost 100%\!, [https://www.reddit.com/r/MacOS/comments/1ikvi0a/cleanmymac\_pricing\_increased\_from\_2019\_to\_2025/](https://www.reddit.com/r/MacOS/comments/1ikvi0a/cleanmymac_pricing_increased_from_2019_to_2025/)  
> 37. Best remove.bg Alternative 2026 — Pricing, Batch, API Compared, [https://www.simplypng.app/en/alternatives/remove-bg](https://www.simplypng.app/en/alternatives/remove-bg)  
> 38. ElevenLabs Pricing: Plans, Credits & Costs \- AnyGen, [https://www.anygen.io/showcase/elevenlabs-pricing/index.html](https://www.anygen.io/showcase/elevenlabs-pricing/index.html)  
> 39. What are credits? | ElevenLabs Documentation, [https://elevenlabs.io/docs/help-center/account/general/what-are-credits](https://elevenlabs.io/docs/help-center/account/general/what-are-credits)  
> 40. MacCleaner Pro vs CleanMyMac: which one is better?, [https://cleanmymac.com/blog/cleanmymac-vs-maccleaner](https://cleanmymac.com/blog/cleanmymac-vs-maccleaner)  
> 41. Stripe vs Paddle vs Lemon Squeezy vs Gumroad: Fees Compared, [https://www.globalsolo.global/blog/stripe-vs-paddle-vs-lemon-squeezy-2026](https://www.globalsolo.global/blog/stripe-vs-paddle-vs-lemon-squeezy-2026)  
> 42. Gumroad vs Lemon Squeezy: 2026 Fee Showdown | Trophy Jar, [https://www.trophyjar.com/gumroad-vs-lemon-squeezy-comparison/](https://www.trophyjar.com/gumroad-vs-lemon-squeezy-comparison/)  
> 43. Gumroad fee calculator: fees, pricing & take-home (2026), [https://checkoutpage.com/tools/gumroad-fee-calculator](https://checkoutpage.com/tools/gumroad-fee-calculator)  
> 44. Merchant of Record Providers for SaaS: Compared \- ChurnWard, [https://churnward.com/learn/merchant-of-record-providers/](https://churnward.com/learn/merchant-of-record-providers/)  
> 45. Lemon Squeezy Merchant of Record Fees Explained (2026), [https://getstacksmart.com/blog/lemon-squeezy-merchant-of-record-fees-2026](https://getstacksmart.com/blog/lemon-squeezy-merchant-of-record-fees-2026)  
> 46. Lemon Squeezy Review (2026) | Features, Pricing & Alternatives, [https://www.thestartupstarterkit.com/tool/lemonsqueezy](https://www.thestartupstarterkit.com/tool/lemonsqueezy)  
> 47. SaaS Payments Processing Made Simple \- UniBee, [https://unibee.dev/blog/saas-payments-processing/](https://unibee.dev/blog/saas-payments-processing/)  
> 48. 12 Best Checkout Flow Design Examples for B2B SaaS \- Bricx Labs, [https://bricxlabs.com/blogs/best-checkout-flow-design-examples](https://bricxlabs.com/blogs/best-checkout-flow-design-examples)  
> 49. Subscription-Based E-Commerce in a Nutshell \- Luigi's Box, [https://www.luigisbox.com/blog/subscription-based-ecommerce/](https://www.luigisbox.com/blog/subscription-based-ecommerce/)  
> 50. GAAP Accounting for Coupons & Gift Cards: Compliance Guide, [https://www.hubifi.com/blog/gaap-accounting-coupons-giftcards](https://www.hubifi.com/blog/gaap-accounting-coupons-giftcards)  
> 51. 8.8 Customers' Unexercised Rights — Breakage | DART, [https://dart.deloitte.com/USDART/home/codification/revenue/asc606-10/roadmap-revenue-recognition/chapter-8-step-5-determine-when/8-8-customers-unexercised-rights-breakage](https://dart.deloitte.com/USDART/home/codification/revenue/asc606-10/roadmap-revenue-recognition/chapter-8-step-5-determine-when/8-8-customers-unexercised-rights-breakage)  
> 52. Deferred Revenue Journal Entry 101 \- BusinessTech \- HashMicro, [https://www.hashmicro.com/blog/deferred-revenue-journal-entry/](https://www.hashmicro.com/blog/deferred-revenue-journal-entry/)  
> 53. Revenue Recognition ASC 606: Shopify DTC Accounting Guide \- Ottit, [https://www.ottit.com/blog/revenue-recognition-asc-606-for-shopify-dtc-brands/](https://www.ottit.com/blog/revenue-recognition-asc-606-for-shopify-dtc-brands/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAXCAYAAABu8J3cAAACQElEQVR4Xu2VMUiWURSG37DEqKgogkgxIoJqaJCaCiwadAgkhZCoJSKnggiKaBAkojUEIZTKyUJHCaUhcDBCqKXFpiAKipaoBoX0ff9zz//f+/33i5YG6X/hAf3O+b57z7nvuT/Q0BrVZtJJ+shB0hSebyKt4e9/qkNknvwgT8l1Mk5myWHynJyuZpv6YfkrgWnSkmSkGkAtd6kQwwZyJwRukY1pGCfId/IR+Y5oYW38K5kjW9JwVfvJDFkmdwuxyiZGYMHeQsylhVRpWbV7YJ2bIh/I7jRckda5Te7ButGdhmutGiLrCrFYT2Afyuk4uU9ukp+kIw1XpIXPkkfkM9kXB9WqT+Q9aYsDGY2i3h8ubUCLiFy1u8ggrHPvyAuY8atSUC8+iB+WaCusvUWthx2tpksb/U3OR3F1+RrM7OqUOpb4QyP6EvZiWaV/I/eHDHoEZur4CI+Ry+HvK8h0TIaSsb7BqomlKnbAcmK2xUlB7g/Jvyk/SSp2ENZNfTPrD38p53Kdn8b5FWykVcUbcilOCnJ/SOqKxtc9cBG2UWknSvzhgdxGXH58dVUExf7w/ydh3+2EHZFP4lHyC5n7QwnDMI90FWIuLaCj+9P98Yxsj55pur7Ajie+/LL+cLWTRfIW9TemJuQh7OW6KmCF6HrXucf3j45KxZ2Lnnmnyjpb0QHyGta2x7DR08IL5Cq5QU55ctAF1LwjNCknQ+wMrEsqRF6YKOTqd2mMNIf8RKpoL+mB/eJq5nN3RkMN/b9aBU5JeICo8/zLAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAaCAYAAAAaAmTUAAAClklEQVR4Xu2XS+hNURTGP6G838+8ymMgypsUA4ViIBkpA2GgvxggKQyUDL2VQolCSVEeCXlEKCMGRhQGFGFiQArfr3V299zjdP8DF1edr37du/fad++z9l5r7XOlSpUq/Y7mmbfmR46P5l32/bPZb3qlH/wPOm6+mTmF/qkKx66bHgVbS6qnuWdemMEFGw7cMd/N/HpTa2q8+WDOm04FW1/zWOWn1pJaosiPTUWDNdt8NY9M74KtJXVQ5TvPw9807830gq0llXKC3T9tjmacNG/MCTM8DW51pXy5YUaZoTm65MY1WxSds+aLahFBJLRln0ndTMdcu6FSvmwrGv6C2MjbZkDWnmQOq3YF4NQ1My1rtyvy5V+V3WUqr6BJOMeVkZxtqHS/vDTD6k2lGmP2mYtmqRltzpjlZrU5lfUhwnS7uWxWmg5ZP/m3xxwzlxQVFBvzXTWTFeG9RXFRvzYHzAh+3EgTzSdzRe3nx0yFE/3MGsVCm81C88zMMk8UjlH57ipykAfdpbiMmYP+IQqnnyvyhXBbpAj1naqJqFmba5dqrnmlX9/HeMgyEbsPFPmFiOk+ZpxiMSoeScoF212xOecUju1VnFpXc8GsVwgHHiqcHGRGKk4mFQPmumVmZO2miQRk91MIJbHrOLIi10d4MZYX2Lzof6rawxXzhcuZipoqWbE4NE0kIiczMGvjBC+ghAs5hz2Jxe+rvgJNMGMV9xlO8XuqFvmySnE6hNRWs1gR/mwQ915ns05NfPtgQv4GENMsckjxsDhBaBQXYtePKMKMZCcfmIPc2WF2KwoHp7pR4RzjmHdD1l6gOCnWnKI/IHIl/zeAPOFSKxMFpb9qVSyJnMKx9D3Z+aS65sfnx1aqVKlSvX4CiAx1CqrtrIwAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAaCAYAAADhVZELAAADa0lEQVR4Xu2XSYhVRxSGf4c4JRInHHDqqFE0LtRgQFFoxBGNiMkiECEhiroQMS6cMMEggijOiCLiFEKiuBE0TqBiQpS4ESEiunBAdC/iQkHzf5xbvtvXobW1obvf++Gjb1fdW6/q1DmnTkkVVVRRPekjU22+NoNNi6z9Q9Mrey4bDTEXzENz0Cw2B8wp85k5bsY/f7uJ6wOz0jw2y0zbmt0aax6YuyoTT8EgO8wT81WhL6mNOZbBc5PXfPPMLDfNCn157Tcrio1NUQPMPXPD9C70FbVbZZJPVim8ZE2h/WX6WBFqTVocu+fMU5WJB7yJepjb5r7pV+hrjCIfUke9k5JRgOfXiWQ8utjYwDRKcToSAXVWR3NJtRuls9ljuhY7GpgoNLcWG+uiDYqcMrnYkQmX5MeK9UsX87M5auYqEjDvMs6vGcNNy6x/p/lUcaRTFU9U7CxV83bTXaGeigr6ezPDHDIzTXMzyfxphmXvUkT+YPqbLeamIkcy31bZO4PMOsU8J2RttaqvuW7OqzSxJKpaFv6jatYvfIObsshq85/i2yWKRXNPYsInFAl8mvlNUSAy5ueKPMZi0XrFQviN2QqD3TJfmPaKBXEHA8ZfxUfWPJU8g006q7inJTH+EcWpyTir9RY5p8r8Yx6ZfeY7heX/MuNU0yDs/O9mafY/1W0Hxa5fUew0IhwvK3ZnoPlbYQw0XeEBjAU808Yzhv7W7FX8bgrxWaaPwlPGZH0YOhmWtpOKxSOMxGZtVIyHp74qGl4pfqRK4bKAS6abcV4s9qpiEnlhpMOKhSH6mRRGwhinFQtE1ETJqJ8oDMZfxDwwCF6A+JbCEg/Ij1P0jLzXIN69pjByvaubuWiG5tq4PXNFIAwQC2OHCCee8zvPycCNO9VF9OF5hMpUxYLPmJFZP8Yj7DD2lwrvYBz6eY8TkfBkQ/AaqnI8HWP9q9IBwjcjVNq09yoGJ8ew6G8UiXqKwstS0iX0yBGp+t2VvYvIR+SvFGa0/2F+UcQ+O3xHEcaLzCaV8kDKZXMUyZnwJk9giM2KuXDTZxzmudCsVRh+m0rhW29KuSQvJtJJL14F2qkUiryTToYk8kDqT17VWi9PiozNohFzSDd2xmUc/uaFZxbn2aiEYTiOFxQ7ylnkDI7dn1TzaK2ooooavv4H5+mLZ0NTKukAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAaCAYAAADhVZELAAADX0lEQVR4Xu2YWahNURjH/zJklqEQUooyJVNmZSoeSHggiSgkFDK/kLwoc1yh5IEiROYhc8KjMrxIvCglTzyQ+P/69u7su++9lM6p497zr19377XW3nutb33DOleqqKKKKiqdJpiP5leGT+a7+WmemdmmcfpAQ9Jx88OMzbRhiKUK42wwjTJ99V5tzCPz1nTO9XU17+voq9fqaz6bc6ZJrm+4+WZemk65vnqtGYpcsizfYW1T9K3Ltdd7HVDNfNLULFF40PrkvsGotbmvqDZPkuvXCu+oMh3TgQ1JteUTqsxmRdWZkrQVQy31n5T2NJ+szbUPNV8VpboYamduKN5b9qotn6D5CmPtzLX/qwYpyn7ZV7A/nU8wFkbZmGtHbc1Wc97MVIQgIjQ4/V4wC8xoRc4iUd8yH8x+0yMZzxmI91wxCxVhO8RcMtOSMd3NYkXo7TJjknbUz5ww281E08G0MFvMMYV3oklmfHL9Vw0wX1TzfML1WVU3CpOfrPgQxhihmAAhQSnnmUNmpWJxTCz7XoycLfnDzAPTUzF+h+lvlisMe0ZhZJ7hWarfURXCnLBnHhids9Qb08vMMSPNdTPKNDeXVTBynRqnOKXmf+/woVRMjESLcdh1LI8RMFK62PaKhRF6TOC5Ch7HQtIFMO6uYvKIiV5VvHuu2aPwBipdF8XuE74Y61RyjaaqsDEPk3tEG0ZoZXorjHJb8V087anCYEURC5yuqEAYhI/eUWHHCZt7ijyBsVgAC2H3rqmQp7LjEGHzSvFjNK9uipBmEYznuTQ85yX9JOsXigUjvp3Nfdn7rMFKIrwDL8FQaFFyTzsTSUONsGR38B48gZ3GYITACsWCH6t6JSJ0MCZtLAJvwBh4H0bknsMkRmfMxWQ8m8UG4OW8m8WfNLMUIoyLVSzqFLmACRHf71TwmoEKA5ETjig8isTIwvA03JkJDk7GM+kqhdF2K2I+9TISNTlsn+JAyTW/0tMEzRi+v8bsVSTqw4p3IUL/tFmtOIP9NZ8US1Sum6r5rwbaEV7RLNPHDuZ/KpBbyCO1/UsCz0jHZ6+z4lt8k+fT8OAvHko+wfsIRUKuZMJ9cW3KI7vBDrFr5aRVinDC2AcV8yyp+ihKJ5D0iOdyE9Vrk2KOnGMqqqii0uo34Qeixh7PNiYAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAaCAYAAAD1wA/qAAACiklEQVR4Xu2W24tNcRTHv3KJKJdxLTHUPHgxSoqipsjlgVxSIi+mSOLBC1EuTZOUeZF4oIRIuZZcQrxI5IE/YOaVNw8yXjzw/c5a2/mddbaZMxzap/a3Pp291++391m/9Vtr/TZQqlSp4Wgd+VEH/WSxP1NoXSHfyfJgH0l2k49kQRgrnCaTd6SPzAhj0lTykMyKA0VTO/lCbpNRbhtBxvu1FnKBTPD7wmoHrA4OJjal0RnYgiaRrX5daF1CdX2oLk6RPb9mNIGy+tCOqKC/+vU3siSZF6XF6tnC7JJaqlprWh9Kq+ew2sjTdHKLvCWdiX0h2YbGLW4vLKDdcSBPWX0cSmxpfeRJz9wgR2HOZ9Ifq1U3SmPJPbIqDkTJ0cuoPT9Go9Kx8qSa+h/1M5u8IfPjQNRQ50dUKzlHPpGnsC43Brbok+QimehzFYxdsIhuIsfJeTLNx8fB0lAp3YPKc7IrSHdhWfEYgwd1QHn1MZR0KL5GdZTk6CLYny5z23bYnDnkA9kAC5jSRE5rgVt87kbYp5LsOnjXwvyRX4PWh16mDpV+S30mT8iUZF6e1MlewHYzUxtZSp65XU7IJum/tHtysgXW7RTxXrITVpvZjqhxPILtiurjAWyB/0Qq9OuobQQnnCg5GqOq77rTqH2H7Ef8uu76+FPJqbTDSWrTr2C7sg9WBzfJaliqbIY5fcDnnkX1O2aSubCFrHeb0kupupJ0uK1h+l07VMro3OkiK/z+DjlG7qPiuJyS5LQWqt2V/TAsndaQa7AFqzEo1fWFoXOrYdIHYyt5SeZVDw0otuz0Xr+6T6Va0e5Ee/qcOmIc/yspwu/JVViEYm43jdSFlAb7UUdPL1WqyfUTUlZz33o9ZsoAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABHElEQVR4XmNgGAWUAkcgfg3E/6F4BxBzIsnzAfEuJHkQXgfE3EhqUAAjEM8C4l9A/BOILVGlwSAIiNcwoFqEFQgC8UIgzmeA2DyFAWIBMigC4mg0MaxAH4j7gVgSiK8D8RMgVkSSZwHi2VB1BAHIxnQou4EB4rocuCwDgwgDxOUgHxAEfUBsDGXrAPF7ID4BxPxQMRsgngxl4wWw8ALZDgIgLy0H4n9A7AEVA7mapPBCDnCQISDDQIaCYo+s8IIBkPdA3gR514mByPACuQYUFqboEkAQwwCJiGtA3IkmhxWghxcyEGeAJBOQgUSFF8gLoKzBhS4BBQ1A/BaINdHEUYALEH9hQOQ1UBbyRlEBAaBkAsqrBMNrFIyCIQMA260zNBT6yKgAAAAASUVORK5CYII=>

[image7]: <data:image/png;base64,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>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGgAAAAaCAYAAABb9hlrAAAFA0lEQVR4Xu2Ya6hmUxjH/3KJXAeR0BgxcilNbhE1JJFrRjEJIZehKIRETknIF7eQSw5yH80nMUM58oEQvpBIQ02EpIQPFJ6fZz1nr3e9e+/3skfMtP/1r/Putc7aaz2X//OsLfXo0aPH/wWbG3c1blkOFNjWuGn5cBpsY1xqPMu4v6pFtzbukf7u4VhofNt4k/E143GDw/M4yvi83LZT4wDjO8ZfjC8YrzE+ZVxjPND4qvH4+dmO5fL5fyW+ovZIulzV3N+Ns2qf/2/gRPm5DjLuVpBMICPAJsYjjPcZHzSerMEM2Mz4mPH29Hsf41rjSrlDWI938P/rjEvSvInBhm6WG+xG41aDwzrG+LP8JXUZhIFx6A/yaCKV68ABVhv/UHWoUbjQ+KY8MteLPBhuUBUkJX+UqwbOud74lnGRcSfjM8ZHVDkQZ35pPDP9xmH3yJ1ygvEC4xnGO+XBPhV42UNyoy0rxgI4gMxoyo7d5RH5svFreeSU4D3IwB1yQ5w0ONyK7eQB9K78wGGgaUHUr5IbO/io8Su5U3DOIcbvjEf7v/yDveXnIwMBc341njo/Q7o/PQ+gPE+rg7SF5Nwm31gTnpQbuA4c4i55ZLLhfIMBHEKkPWH8Vn7YSUENvNr4sfEiDWf6OMBQBOTOxXOkDEPGmmR4GWwoAwrBGbAVaoKqhIN4dq88AwFrzaqDtCE53xi/MO5ZjJUg6sr6E8AxGB/WZccuxhl5pn1ifENu7GlBBp1j/FDusEnWwmg4AzkKsD/qxsL0OxSjdBDOnTO+b1wgn0cmRuAieQ+neeAydZA2MCM3KEVsFLZXvbRwUCKSqMGBfxrPzcaJKoxIqockjFt/RoGadLpc+pBApHBSsH/Of3b2LBzR5KD8+aHGT41XGp81npaekzWdurZ4GQZtyoxxEPWH9D9Y3kzkUni48ZL0NxFVl2FdgWOQYBy1YzE2CjRAr8sDMIDxccI4DgK8H5lDkQDzcE5IG+ME6S0altZGxCaia8lB1NO1lC3oDvmkhKg/INbEWICNzsgPz5pd6k8donn4QC55dRneBrLnOQ0rSHRnpSOaHFQCWQtp4+xcT+jokFaakTwYGtEUJQBNj66J1puo/8h4cT4pIeoPiCIaNeZ8VV0QkbM+6g8geO6Wv6tL+007/JMGJRk0OaLpeY5S2gic9+Q1C1yhSgZbEQZre1lsqCnq8/oTv1fK110qlzoyBxxm/E3d6g/7fEB+LyIaY+1pEZKbt8kgzlHaJuzRdNcrpQ3QXM2lMYAdcNJIcDgOSw2Kvr4EhkcC2+4/L6qKDsCGvpfLHG1ooEv92c/4UiJfO7o6JsBeuf/ld50AylDKfwR1KYmBXNoC2GFOlYNolK6dHx0B2srP5feK3JgAPecCh1Hroh4jLVd1JwhwMJyed0URkU2Z2AaKK7q9qBzoiGilm+5tFPx1cokK0FAQfEdmzwJkzayG72aoyJwqByFv0TSNhcVyjUR+ZuV6jEMovFcZr9PwB8DzVNUmSOd2bBpDLsgqHEytIeXzuXy3e9y4RZr/X4G9UQ+bHASorWuNl8qLPO008lRmMMbnkstVogRrf2bcV24TVKtuXit44V7yzyh8wWaBSTuiDREoCPLW1mTQkBB0kL/rwFeNstEIYNtT5Jdq2vkV6dlGA6SobPebiAE3qsNvCKCpyD9qtvFWdbi59+jRo0ePHj169OjRDX8DDRAHxhkWTqwAAAAASUVORK5CYII=>