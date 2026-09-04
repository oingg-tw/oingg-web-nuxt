# **全方位指數股票型基金（ETF）篩選與配置評估研究報告**

指數股票型基金（Exchange Traded Fund, ETF）在現代投資組合理論與實務配置中扮演著核心角色。然而，ETF 的產品結構橫跨實物複製、合成複製、衍生品槓桿、固定收益及多資產策略，其底層運作機制涉及總費用率複利侵蝕、二級市場折溢價收斂、稅務與健保補充保費穿透、每日槓桿重置之波動損耗，以及法定清算下市條件等多重變數。挑選 ETF 時，若僅依賴名目殖利率或短期歷史績效，往往會忽視結構性成本與路徑依賴風險。本報告針對 ETF 的定價機制、持有成本、配息治理、衍生品耗損及跨境稅務架構進行全方位的量化評估與策略分析。

## **一、 基金結構與持有成本之量化評估**

評估 ETF 的首要步驟在於檢視其結構健康度與持有期間的摩擦成本，此維度由總費用率、資產規模、次級市場流動性、追蹤誤差及折溢價動態共同構成。

### **1\. 總費用率的複利拖累與淨值侵蝕**

總費用率（Total Expense Ratio, TER）包含經理費、保管費、指數授權費及各項營運雜費，該費用按日自基金資產淨值（NAV）中扣除，直接反映於淨值表現而不體現於投資人對帳單1。長期投資環境下，細微的費用率差距將在複利機制下對最終資產積累產生顯著的負向偏離。  
資產終值模型可表示為：  
![][image1]  
其中 ![][image2] 代表期初投資本金，![][image3] 為標的資產年化報酬率，![][image4] 為基金總費用率，![][image5] 為投資年限。

| 總費用率 (c) | 30 年後資產終值 (V30​) | 累積費用侵蝕總額 | 終值折損比例 |
| :---- | :---- | :---- | :---- |
| **0.15%** | 約 945 萬元 | 基準組（低摩擦） | \- |
| **0.50%** | 約 857 萬元 | 約 88 萬元 | 9.31% |
| **1.00%** | 約 746 萬元 | 約 199 萬元 | 21.06% |
| **1.50%** | 約 661 萬元 | 約 284 萬元 | 30.05% |

在期初投入新台幣 100 萬元、標的年化報酬率 8% 的情境下，若持有 30 年，總費用率 1.50% 的產品相較於 0.15% 的低成本標的，最終資產差距高達 284 萬元，資產價值縮水逾 30%1。對於長期被動配置者而言，台股原型 ETF 的費用率應優先挑選低於 0.30% 至 0.45% 的產品，而跨國型 ETF 則應控制在合理管理成本區間內1。此外，市場常存在以每股名目價格高低判斷便宜與否的迷思，事實上兩檔追蹤相同指數但單位淨值不同的 ETF，其市場曝險完全相同，決定長期績效分歧的核心關鍵仍是總費用率與追蹤精準度1。

### **2\. 資產管理規模、流動性與市場衝擊成本**

基金資產管理規模（Assets Under Management, AUM）與二級市場流動性直接決定了投資組合的存續安全與交易摩擦成本。規模過小的 ETF 存在營運規模不經濟的困境，其固定行政開銷佔淨值比重拉高，進一步拉大追蹤誤差2。在台灣市場，規模超過新台幣 100 億元的 ETF 具備較高的存續穩定性與抗清算防禦力，如大型權值型 ETF 其規模甚至可達數千億元，大幅降低了非系統性營運風險1。  
次級市場的流動性則應透過日均成交量（建議常態日均量達 1,000 張以上）與造市商的委託簿厚度進行評估1。若市場深度不足，買賣價差（Bid-Ask Spread）擴大將使投資人在進出時承擔高昂的隱性流動性折價與市場衝擊成本1。

### **3\. 追蹤誤差之歸因分析**

追蹤誤差（Tracking Error）為基金淨值報酬率與標的指數報酬率之間差異的標準差，衡量基金經理團隊複製指數的精準程度，優質指數化產品的年化追蹤誤差通常維持在 1% 以下1。追蹤誤差的產生來源主要包括：

* 基金因應日常申贖與流動性需求所保留的現金部位產生的現金拖累（Cash Drag）。  
* 成分股除權息後的股利再投入時間差與交易滑價。  
* 指數定期審核與成分股權重調整時所產生的實質換股交易成本。  
* 跨國投資時匯率波動及外匯避險合約的展期利差支出1。

### **4\. 次級市場折溢價之套利與均值回歸機制**

ETF 在交易所掛牌交易，產生「次級市場撮合市價」與「底層資產真實淨值」兩套價格體系3。當市場買盤強烈追捧特定題材時，市價常顯著高於淨值而形成溢價；反之，市場恐慌拋售或流動性萎縮則導致折價3。正常運作下，授權參與者（Authorized Participants, AP）會透過初級市場實物申購或買回進行無風險套利，促使市價向淨值收斂4。然而，當海外市場實施額度管制、標的流動性枯竭或新基金掛牌建倉未完成時，套利機制可能失靈，造成非理性極端溢價2。  
歷史案例顯示，若投資人在極端溢價時追價買入（例如部分海外商品或主題 ETF 曾出現 5.57% 乃至逾 200% 的溢價），一旦套利管道暢通或市場情緒退潮，市價向淨值急速回歸將導致投資人承受巨大的資本虧損2。依台灣主管機關監管標準，ETF 溢價超過 3% 即屬異常警示範圍，發行人需強制揭露風險，投資人交易前必須嚴格檢視即時預估淨值與折溢價幅度2。

## **二、 配息機制拆解、稅負穿透與收益平準金治理**

高股息 ETF 的現金流特徵深受偏好穩定入息的投資人青睞，然而配息本質上為基金淨值的分割返還，並非額外產生的投資收益1。評估現金流型 ETF 時，必須貫徹含息總報酬率思維，並深入解析收益分配來源與稅務穿透架構1。

### **1\. 配息來源結構與課稅屬性**

ETF 收益分配通知書將單次配息依會計科目拆解為不同所得代碼，各項目的租稅負擔與健保補充保費計費規則存在本質差異6。

| 所得代碼 / 收益項目 | 會計性質說明 | 個人綜合所得稅處理 | 二代健保補充保費 (2.11%) |
| :---- | :---- | :---- | :---- |
| **54C 境內股利所得** | 底層成分股發放之現金股利6 | 併入綜合所得（8.5% 抵減稅額或 28% 分開計稅）7 | 單次計費所得達 20,000 元按全額計徵6 |
| **5A 境內利息所得** | 基金存放金融機構之利息6 | 納入利息所得（享有 27 萬元儲蓄投資特別扣除額） | 單次計費所得達 20,000 元按全額計徵6 |
| **76 / 76W 財產交易所得** | 基金買賣成分股實現之資本利得6 | 證券交易所得停徵所得稅（實質免稅）9 | **完全免扣** 6 |
| **收益平準金** | 新申購人投入之可分配收益調整項（本金返還）6 | 非屬課稅所得項目（實質免稅）9 | **完全免扣** 6 |
| **71 境外所得** | 海外標的之股利或債息收益6 | 納入海外所得與個人最低稅負制（免稅額 750 萬元）7 | **完全免扣**（大陸地區來源 G 註記除外）6 |

### **2\. 二代健保補充保費之「按次、按來源」核算機制**

二代健保補充保費費率為 2.11%，扣費門檻為單次給付達新台幣 20,000 元（含）6。制度上採「按來源、按次」分別判斷，月配息產品各月份獨立計算而不進行跨月累加，且同日匯入之不同基金配息亦分別判定，不會因同一證券帳戶而合併計費6。  
計費核心在於補充保費僅鎖定 54C 境內股利與境內利息等法定項目，收益平準金與已實現資本利得一律排除於費基之外6。若投資人單次獲配 30,000 元，其中 54C 股利佔比為 70%（21,000 元），因計費所得達標，需按全額課徵 ![][image6] 元；但若該次配息結構中 54C 僅佔 40%（12,000 元），其餘為資本利得與平準金，則因計費所得未達 20,000 元門檻，補充保費為 0 元6。

### **3\. 金管會收益平準金動用四大治理指引**

為避免投信業者透過資本利得與平準金過度灌水營造不合理的高配息率，金管會推動了嚴格的自律指引5：

* **配息率上限原則**：ETF 實際配息率不得高於追蹤指數之「參考配息率」（即指數含息報酬率減去價格報酬率之實質股利率），杜絕超額宣傳5。  
* **動用觸發門檻**：僅能在「實際配息率低於參考配息率」或「當期因大量淨申購導致流通在外單位數較前期增長達一定比率（如 10% 以上）」時，為防範配息稀釋方得啟用5。  
* **動用比例約束**：收益平準金之動用佔比，不得高於除息前一日帳列收益平準金佔所有可分配收益之整體比率，防止超額提撥本金配發5。  
* **收益分配順序**：配息必須優先發放成分股股利、利息與已實現資本利得，收益平準金列為最終順位，並依配息頻率（季配按季分攤、月配按月分攤）逐期平滑分配，嚴禁集中倒出前期收益營造單次暴利假象5。

## **三、 衍生型與特殊資產類別 ETF 的定價偏離與結構性損耗**

槓桿型、反向型、期貨型與固定收益型 ETF 具有獨特的數學合約架構，若未深入理解其內在機理，盲目長期持有將導致資產遭受嚴重的非線性侵蝕。

### **1\. 槓桿型與反向型 ETF 的每日重置與波動損耗模型**

槓桿與反向 ETF 之核心機制為「每日重新平衡（Daily Rebalancing）」13。其投資目標僅承諾提供標的指數「單日」報酬的指定倍數，而非長期持有期間的累積倍數13。

#### **(1) 震盪市場中的幾何耗損（Beta Slippage）**

每日重置要求經理人運用期貨或交換合約（Swap）在收盤時動態調整部位：指數上漲時被迫追買部位、下跌時被迫減碼部位以維持固定槓桿倍數，此舉在震盪走勢中等同於「追高殺低」15。  
假設標的指數第 1 天下跌 10%，第 2 天上漲 10%：

* 標的指數淨值變化：![][image7]（累積跌幅 1.0%）17。  
* 2 倍槓桿 ETF 淨值變化：![][image8]（累積跌幅 4.0%）17。

標的指數僅回撤 1%，但 2 倍槓桿產品跌幅達 4%，顯著高於線性認知的 2%17。理論上，年化幾何波動耗損可透過以下公式量化：  
![][image9]  
其中 ![][image10] 代表槓桿倍數，![][image11] 為底層標的之年化波動度16。

| 標的年化波動度 (σ) | 2 倍槓桿 ETF (L=2) 年化耗損率 | 3 倍槓桿 ETF (L=3) 年化耗損率 |
| :---- | :---- | :---- |
| **15%** | 2.25% | 6.75% |
| **20%** | 4.00% | 12.00% |
| **30%** | 9.00% | 27.00% |
| **50%** | 25.00% | 75.00% |

當標的指數年化波動度達到 30% 時，2 倍槓桿產品每年將因路徑震盪自發性耗損 9% 的資產淨值，而 3 倍產品年損耗率更高達 27%16。

#### **(2) 回撤修復的不對稱性**

在市場劇烈回檔情境下，槓桿產品的基期壓縮效應極為嚴重。若 2 倍槓桿 ETF 面臨 50% 淨值回撤，其後續需要 100% 的漲幅方能回本，而此時原始指數僅需上漲約 29% 即可收復失土17。因此，槓桿與反向型 ETF 僅適用於短線明確單邊趨勢交易（通常建議持有 1 至 5 個交易日內）或事件型動態避險，嚴禁納入定期定額、長期存股或退休金投資組合16。

### **2\. 債券型 ETF 的存續期間與利率敏感度**

債券型 ETF 的定價核心受無風險利率曲線與信用利差主導。其價格對基準利率變動的敏感度主要由有效存續期間（Effective Duration）決定：  
![][image12]  
其中 ![][image13] 為修正存續期間，![][image14] 為殖利率變動幅度。  
存續期間約 7 年的中天期公債 ETF，利率每下降 1.0%，價格約上漲 7.0%；而存續期間長達 16 至 18 年的長天期美債 ETF，利率變動 1.0% 時價格波動幅度可達 16% 至 18%19。在 2022 年激進升息週期中，長天期公債 ETF 產生近 30% 的歷史性回撤，顯示長天期債券在利率轉折期實質上具備高波動風險性資產的特質，投資人配置時需精準匹配自身的資金存續期與宏觀利率預期19。

### **3\. 商品與期貨型 ETF 的轉倉成本（Roll Yield）**

期貨型 ETF（如原油、黃金、波動率指數 VIX ETF）透過持有近期期貨合約追蹤現貨價格3。當期貨市場呈現正價差（Contango，即遠月份合約價格高於近月份）時，基金在合約到期進行轉倉操作時必須「賣低買高」，產生實質的負轉倉收益（Negative Roll Yield），該機制將導致基金淨值長期隨時間自發性衰減，甚至引發終止清算風險3。

## **四、 跨境架構與主動式產品之制度性分析**

隨著金融監理開放與跨國資產配置普及，主動式選股架構與境外註冊地的租稅協定差異，對投資組合的長期稅後淨回報產生關鍵影響。

### **1\. 主動式 ETF 與被動多資產 ETF 之發展**

主管機關開放主動式 ETF（股票型代號第六碼為 A、債券型代號為 D）與被動多資產 ETF21。主動式 ETF 不追蹤特定指數，由經理團隊依據質化研究或計量模型動態調整持股，旨在追求超越大盤的超額報酬（Alpha）21。其優勢在於每日透明公開完整投資組合，但在制度上投資人需承擔經理人選股失效、風格漂移及較高管理費率的代價2。被動多資產 ETF 則透過固定規則在單一標的內配置股債雙資產，提供自動化資產配置與風險分散功能21。

### **2\. 註冊地稅務穿透架構比較：美股掛牌 ETF 對比愛爾蘭 UCITS ETF**

跨國投資全球股票市場時，非美籍投資人若直接持有美國註冊（US-Domiciled）之 ETF，在股息分派與遺產繼承時將面臨嚴峻的稅務摩擦24。相較之下，愛爾蘭註冊（UCITS）之 ETF 具備高度租稅協定優勢24。

| 評估維度 | 美國註冊 ETF（如 VOO、SPY） | 愛爾蘭註冊 UCITS ETF（如 CSPX、VUAA） |
| :---- | :---- | :---- |
| **美股股息預扣稅率 (WHT)** | **30%**（台灣與美國無租稅協定）6 | **15%**（受惠於愛爾蘭與美國租稅協定）24 |
| **股息處理機制** | 強制發放現金配息，產生再投資摩擦 | 提供累積型（Acc）直接滾入淨值，免除再投資成本 |
| **美國聯邦遺產稅** | 非美籍個人持有逾 6 萬美元即面臨最高 40% 稅率24 | **完全免徵**（法律實體註冊於愛爾蘭）24 |
| **名目總管理費率** | 極低（約 0.03% 至 0.09%）1 | 略高（約 0.07% 至 0.22%） |
| **長期稅後複利效益** | 因 30% 股息稅流失，整體拖累年化報酬約 0.3%–0.5% | 15% 稅率搭配自動複利累積，稅後淨收益顯著領先 |

對於以長期資本增值為目標、不需短期現金流的非美投資人，透過愛爾蘭註冊的累積型 UCITS ETF 配置美股或全球股市，在制度層面具備更高的資產保全與稅後實質增值效益24。

## **五、 清算終止機制、流動性陷阱與二級市場處置策略**

ETF 雖具備一籃子持股的分散效果，但並非永續存續產品。當規模持續萎縮或淨值崩跌觸及法定門檻時，發行人將依法終止信託契約並辦理基金清算3。

### **1\. 法定下市清算門檻**

台灣證券市場對於各類 ETF 訂有以「最近 30 個營業日平均值」為基準的法定下市條件2。

| ETF 產品類型 | 資產規模 (AUM) 下市門檻 | 淨值 (NAV) 累積跌幅下市門檻 |
| :---- | :---- | :---- |
| **股票型 ETF** | 最近 30 個營業日平均規模 ![][image15] 億元新台幣2 | 無強制規範（依各基金公開說明書）27 |
| **債券型 ETF** | 最近 30 個營業日平均規模 ![][image15] 億元新台幣2 | 無強制規範（依各基金公開說明書）27 |
| **期貨 / 商品型 ETF** | 最近 30 個營業日平均規模 ![][image16] 萬元新台幣3 | 最近 30 個營業日平均淨值較發行價跌幅 ![][image17] \[cite: 3, 20, 26\] |

### **2\. 清算程序之資產返還與處置決策**

ETF 終止上市並不等同於企業破產股票歸零，基金清算是將底層現貨與衍生品全數處分變現，扣除清算行政費用後，按投資人持股比例匯還現金淨值3。清算流程通常歷時約 1 至 1.5 個月，自發行人董事會決議與主管機關核准後，證交所將公告最後交易日，其後依序進入終止上市、信託契約終止、基準日結算淨值與清算款匯款發放階段3。  
在公告下市至最後交易日期間，投資人的處置抉擇應取決於次級市場的折價幅度27：

* **市場深度枯竭與嚴重折價時**：若次級市場出現非理性拋售導致市價遠低於淨值，於場內賣出將蒙受重大折價損失，此時「持有至最後交易日後等待清算、按淨值退回資金」在財務上最為有利27。  
* **市價貼近淨值時**：若次級市場買賣價差正常且折溢價微小，鑑於清算期間（約 30 至 45 天）資金將完全凍結、不配發股息且無法參與市場後續行情，投資人應於最後上市日前於二級市場主動賣出，及早轉換至核心替代標的以消除流動性空窗期2。

## **六、 投資決策矩陣與綜合篩選準則**

建立科學化的 ETF 篩選架構，需依序對結構、成本、策略及稅負四個層級進行嚴格把關，以下決策矩陣整合各項篩選標準與潛在風險防禦機制：

| 評估維度 | 核心檢核指標 | 建議量化標準 / 警戒紅線 | 結構性風險與防禦策略 |
| :---- | :---- | :---- | :---- |
| **結構存續度** | 資產管理規模 (AUM) | • 股票型 ![][image18] 億元（高度安全）1 • 股票型 ![][image15] 億、債券型 ![][image15] 億（清算警戒線）2 | 避開受益人數連續下滑且規模逼近清算門檻之冷門主題產品2。 |
|  | 市場流動性與價差 | • 常態日均量 ![][image19] 張1 • 委託簿買賣價差緊貼最低跳動點 | 避免於開盤前 15 分鐘與收盤撮合時段市價大單敲進，防範造市未穩之滑價損失。 |
| **持有與交易成本** | 總費用率 (TER) | • 原型台股 ![][image20]–![][image21] 1 • 全球美股 ![][image20]–![][image22] 1 | 屏除名目股價高低之心理誤區，費用率才是決定 20 年以上資產終值的核心因子1。 |
|  | 二級市場折溢價 | • 常態合理區間：![][image23] • 異常追價警戒：![][image24] \[cite: 2\] | 溢價買入等同墊高持有成本，市價必將向淨值均值回歸，嚴禁於溢價爆發期追買2。 |
| **策略與複製機制** | 追蹤誤差與複製法 | • 年化追蹤誤差 ![][image25] 1 • 優先選取全複製實物持股 | 檢視成分股集中度與選股邏輯，防止單一產業比重過高引發週期性非系統風險。 |
|  | 衍生品槓桿屬性 | • 槓桿/反向型：嚴格限制於 1–5 日短線策略17 • 嚴禁長期存股持有 | 波動耗損隨波動率平方呈非線性放大，震盪市中的路徑依賴將不可逆地吞噬本金16。 |
| **現金流與稅務** | 配息來源與成分 | • 檢視 54C 股利、平準金與資本利得配比6 • 實際配息率 ![][image26] 指數參考配息率5 | 配息不等於獲利，單次 54C 達 2 萬元需計扣 2.11% 補充保費，應以含息總報酬為考量1。 |
|  | 跨境註冊地效益 | • 美國註冊：30% 股息預扣稅、潛在 40% 遺產稅24 • 愛爾蘭 UCITS：15% 股息稅、豁免美國遺產稅24 | 長期非美投資人配置美股與全球資產時，優先評估愛爾蘭累積型 UCITS ETF 以優化稅後淨值24。 |

成熟的 ETF 配置架構應捨棄對「名目高殖利率」與「短線概念題材」的盲目依賴，回歸資產配置的定價本質。透過低費用率、高流動性、緊密追蹤主流指數的原型資產作為核心基底，並精確區隔戰術型衍生商品與戰略型被動投資工具，方能在不同景氣與利率週期中，獲取穩健的市場長期複合報酬1。

#### **Works cited**

> 1. 新手第一檔ETF：該怎麼選, [https://ctyeh.com/finance/13089](https://ctyeh.com/finance/13089)  
> 2. 台灣ETF 清算潮警報：規模跌破1 億元即觸發下市 \- Wistock 投資學堂, [https://blog.wistock.ai/etf-strategies/taiwan-etf-delisting-alert-3-warning-indicators/](https://blog.wistock.ai/etf-strategies/taiwan-etf-delisting-alert-3-warning-indicators/)  
> 3. ETF也會下市！ETF下市清算是什麼？股票型、期貨型 \- 商周財富網, [https://wealth.businessweekly.com.tw/GArticle.aspx?id=ARTL003012694](https://wealth.businessweekly.com.tw/GArticle.aspx?id=ARTL003012694)  
> 4. 花39元買到只值12元的ETF？00887、00940、00403A三個真實案例, [https://stockbuddyletter.com/etf-premium-trap-three-cases/](https://stockbuddyletter.com/etf-premium-trap-three-cases/)  
> 5. 金管會新指引上路！破解「賺息賠差」迷思，10%超高股息ETF是否真, [https://www.sinotrade.com.tw/richclub/hotstock/-68900e0859e2363e11ff312b](https://www.sinotrade.com.tw/richclub/hotstock/-68900e0859e2363e11ff312b)  
> 6. 【2026 最新】ETF 配息達2 萬一定扣二代健保？54C、收益平準金與, [https://www.alphalab.site/etf-dividend-nhi](https://www.alphalab.site/etf-dividend-nhi)  
> 7. ETF配息要繳稅嗎？3分鐘搞懂股利所得稅、二代健保與節稅秘訣, [https://www.anuefund.com/investment-article/8deaf47b1889db6YksO6Sc2XNKvTXHomjlYYBwieajYTCPoQD0](https://www.anuefund.com/investment-article/8deaf47b1889db6YksO6Sc2XNKvTXHomjlYYBwieajYTCPoQD0)  
> 8. 2025年報稅攻略》ETF配息能抵稅？要選擇合併課稅 \- Smart自學網, [https://smart.businessweekly.com.tw/Reading/IndepArticle.aspx?id=6019063](https://smart.businessweekly.com.tw/Reading/IndepArticle.aspx?id=6019063)  
> 9. 0050幾張會被扣二代健保？ETF股利門檻試算2026 \- Ultra Advisor, [https://ultra-advisor.tw/blog/etf-dividend-nhi-supplementary-premium-2026](https://ultra-advisor.tw/blog/etf-dividend-nhi-supplementary-premium-2026)  
> 10. 【2026報稅攻略】ETF配息要課稅嗎？ETF二代健保又要 ... \- 永豐金證券, [https://www.sinotrade.com.tw/richclub/primary/ETF%E9%85%8D%E6%81%AF%E8%A6%81%E8%AA%B2%E7%A8%85%E5%97%8E-ETF%E4%BA%8C%E4%BB%A3%E5%81%A5%E4%BF%9D%E5%8F%88%E8%A6%81%E6%80%8E%E9%BA%BC%E7%AE%97%E5%91%A2-ETF%E9%85%8D%E6%81%AF%E8%AA%B2%E7%A8%85%E6%A8%99%E6%BA%96%E7%AB%9F%E7%84%B6%E8%B7%9F-%E9%80%99%E5%80%8B-%E6%81%AF%E6%81%AF%E7%9B%B8%E9%97%9C--662871d46fdf8b37dc9c432d](https://www.sinotrade.com.tw/richclub/primary/ETF%E9%85%8D%E6%81%AF%E8%A6%81%E8%AA%B2%E7%A8%85%E5%97%8E-ETF%E4%BA%8C%E4%BB%A3%E5%81%A5%E4%BF%9D%E5%8F%88%E8%A6%81%E6%80%8E%E9%BA%BC%E7%AE%97%E5%91%A2-ETF%E9%85%8D%E6%81%AF%E8%AA%B2%E7%A8%85%E6%A8%99%E6%BA%96%E7%AB%9F%E7%84%B6%E8%B7%9F-%E9%80%99%E5%80%8B-%E6%81%AF%E6%81%AF%E7%9B%B8%E9%97%9C--662871d46fdf8b37dc9c432d)  
> 11. ETF平準金發放4原則罩頂 \- 余紀忠文教基金會, [https://www.yucc.org.tw/info/5780](https://www.yucc.org.tw/info/5780)  
> 12. 金管會2025最新高股息ETF配息指引(Official ... \- 綠角財經筆記, [https://greenhornfinancefootnote.blogspot.com/2025/07/2025etfofficial-guidelines-for.html](https://greenhornfinancefootnote.blogspot.com/2025/07/2025etfofficial-guidelines-for.html)  
> 13. 每日重置為何影響槓桿ETF？, [https://readmo.cmoney.tw/article/bc22a5cc-4e64-4d7a-8dae-9e265a882212](https://readmo.cmoney.tw/article/bc22a5cc-4e64-4d7a-8dae-9e265a882212)  
> 14. 每日重置如何影響槓桿ETF風險？ \- 股市爆料同學會, [https://www.cmoney.tw/forum/readmo/2a2ec138-cc65-4efe-90b7-70c5d03833a5](https://www.cmoney.tw/forum/readmo/2a2ec138-cc65-4efe-90b7-70c5d03833a5)  
> 15. 投委會- 每日重新平衡 \- 投資者及理財教育委員會, [https://www.ifec.org.hk/web/tc/investment/investment-products/leveraged-and-inverse-products/know-daily-rebalancing.page](https://www.ifec.org.hk/web/tc/investment/investment-products/leveraged-and-inverse-products/know-daily-rebalancing.page)  
> 16. Poseidon Partner \- 博盾- 善於乘勢，困於震盪：槓桿ETF的悖論, [https://www.poseidon-partner.com/marketviews-tc/shan-yu-cheng-shi-kun-yu-zhen-dang-gang-gan-etfde-bei-lun](https://www.poseidon-partner.com/marketviews-tc/shan-yu-cheng-shi-kun-yu-zhen-dang-gang-gan-etfde-bei-lun)  
> 17. 槓桿型ETF的隱藏成本：別長期持有｜財經知識, [https://ctyeh.com/finance/12820](https://ctyeh.com/finance/12820)  
> 18. 槓桿納斯達克ETF的每日重置機制，為何會造成波動拖累？, [https://readmo.cmoney.tw/article/6662aa42-7bf0-45a1-908b-3dde84f97ce6](https://readmo.cmoney.tw/article/6662aa42-7bf0-45a1-908b-3dde84f97ce6)  
> 19. 降息債券就會漲？漲多少先看「存續期間」：一個公式加一台計算機, [https://buffettonlineschool.com.tw/bond-duration-rate-cuts/](https://buffettonlineschool.com.tw/bond-duration-rate-cuts/)  
> 20. ETF 下市條件？ETF 下市怎麼辦？ \- 理財學伴, [https://moneymate.space/etf-delisting/](https://moneymate.space/etf-delisting/)  
> 21. ２０２５開放式ETF元年來了！一次帶你看懂：何謂主動式ETF, [https://www.cheers.com.tw/article/article.action?id=5104555](https://www.cheers.com.tw/article/article.action?id=5104555)  
> 22. 金管會拍板！主動式ETF 明年上路投資組合全透明 \- 余紀忠文教基金會, [https://www.yucc.org.tw/info/6399](https://www.yucc.org.tw/info/6399)  
> 23. 主動式ETF 有哪些？一文整理2026 年台灣30 檔：台股、海外 \- 經理人, [https://www.managertoday.com.tw/articles/view/72424](https://www.managertoday.com.tw/articles/view/72424)  
> 24. 投資美股要交稅嗎？股息稅、ETF預扣稅與遺產稅全攻略 \- Endowus, [https://endowus.com/zh-hk/insights/taxes-on-us-listed-etfs](https://endowus.com/zh-hk/insights/taxes-on-us-listed-etfs)  
> 25. 註冊愛爾蘭ETF 有什麼特色？和美國ETF差異？投資地區/費用率/投資, [https://rich01.com/euro-etf-vs-american-etf/](https://rich01.com/euro-etf-vs-american-etf/)  
> 26. 00790B將下櫃清算！ETF下市條件有哪些？拿得回錢嗎？-CMoney官方, [https://cmnews.com.tw/article/cmoney-f8c2bec0-f002-11ef-a129-59a179508ce6](https://cmnews.com.tw/article/cmoney-f8c2bec0-f002-11ef-a129-59a179508ce6)  
> 27. 買到的ETF 會下市嗎？清算條件、流程，和你到底拿不拿得回錢, [https://buffettonlineschool.com.tw/etf-delisting/](https://buffettonlineschool.com.tw/etf-delisting/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAxCAYAAABnGvUlAAADlUlEQVR4Xu3dPYhcVRQH8CtGUSJ+RQx+YRQVjIWKAUmwUFCxMGIriliIWlkETMBCUbEQGz86JUgKEVS08AMFixUhgrZi4UcjopWNYGGl5/De07s3M7PL5E2Smf394M++d2aydzcpcjj3zkwpAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKyWeyJfRb7u833kpXXPAABYIqdHTmuLS+aM6vqqyGP99aHIWZHbInf99wwAgCWSjc6LbXEJvR05r78+N3J+ZFvk/b52ceTC/hoAWCE5ncnUsil4oKmN7USu+23pJlLp1sjByD/l2PVPdWdHPmpqOVX7qakBACsm/8M/Ut3nlObd6n5R5l03J0jtFCm3Oy9taoPLIne2xfBX2VzDls/Z3xZPoqtL93c3+KSsxvQQAJjhxshadf9c5KHqflHmXffayIdN7ZnIU01tkM3a5W2xjNuwZcN4S//17jLuWblcuz67tj3ydOScyLORv0v3goNd1XMAgBVzQeTX/jq33G6uHtuMzyK/zMg0x7vu56VrZLJZm9Ug5RQvz3m1xmrYdkZejXwR+TlyIPL4umfM57vIG6XbJv4jcn312Fp1DQBsATmxyeYl5YRraH6ORr6M/FC6BuGbyEX9Y2OYtm5Ow16I7O7vp7kp8maZPlkb1NuutVkNWzZhl/TJn+Xh6j63bmt7Io+WrvnMrcnrSve7tYY/PymtbDDz++W5u7y+v6xvSvNMHgCwxeQB/FfK/28JkU1CTnZym+/HvpYTsUl2lGMbkFnNSK1dNw0N1rRmavBy5IbSneGaZZ6GrbbRhG2QDdakrdd55Ho5qZtmrS0AAKsvG6ddbTG8FXmtLY5o0rp1w5bntFq5DZpvDltPnLJpu7K6r+X25KTJYDZseRZsI5tp2LJRG/Pg/xWRR6r7D0rXGKf8vRf5bwIAnKL+bAu93Hp7sC2OaNK6GzVsd0SebGrXRJ5vaoOcEtbnv56I/Fa6ZjGTnxQwy2Yatr2R29viccqJ3Xulm6ble64NctJ5X3UPAGxx2bBN2wpdlHf6r2NOkT4t3Qsb5rGvrG/4TqacruWZunq6CABsYfkKxd8jh9sHFuz1yL2le1f/sXxcVuMjm3KSmK9GBQBYSTklO7MtLpn8sHcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAE+tfMLF3x1b+5wsAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAaCAYAAAC3g3x9AAABYElEQVR4Xu2UvytGURzGH/lR8rtEJpJFWSQpvCZGBrPdrlA2yWCVwWAgxUDZZDxl9AeYDCaTkcGA53nPve45X/d9vVfK8j71Wb7Pt++99znfc4G6/kK95JZ8BLyR+aCnhZybno3Az9UifOOJNRI1kjOyRZqNl6sJ8kIuSZPxpClySlqtUUnD5Ik40h5b5SHHZNzUq6qfPJBHMmC8FbJNGky9qvRWjjyT0aA+RK5IX1CrScpN+b2SyaSmN9ojS2lTUR3Bn7ROXCqRA8Sn2knWyQ6Zww8xbMIPXCNd8Ls3EviK5QL+xPWQQ7IQ+N+0DD9wF37oamxjllwj2wJ9SaU1K0u3453cw++cXR89wAV1DbwjPWmDVbrcQp9lpUgc4oF5a/YlGWpQ4HlhFx6ooGdImzUSKWOHeKB+LB1pQ1GNkRtkmSnT/cwuLsWgHdQ1nIa/QYNRxy/VDX/3a/qN1fXP+gRxuTvgjfbHFQAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAAlElEQVR4XmNgGAXUBHxA7AnEslA+iPYBYkm4CiDgAeKZQNwIxE+AeBIQTwficiC+BsSKMIUeQJwOxPpA/AmI5wOxIBDvAeK3QKwJU5gJVRQExL+B2AaIGRkgVoMMAbFRAMjKq0Asgi6BDHiB+DAQL2XAYgIyALkD5B6QW/ECZPfhBQ1AfBGIhdHEMQAHAyQ8RwGNAQDoLhQQwKpatAAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAaCAYAAABl03YlAAAAo0lEQVR4XmNgGAXkAnEg9gViOyBmRZNjkADiNUC8HogjgLgOiHcBMT9MgTwQXwHiWQwQ3SCJE0D8Fog1QQpYgHgOED8BYkWIHrBYEhAHADEjSACkEqQDZBVIEisAOfI/EBehSyADTwaIIpBidMAFxMwghiwQ3wbiBGRZIHAC4nVALAwTAJkGcvhqBogPDwBxOxDzwRTAAMjroIAUY4BaMQpIAwAvUBUS5DgSfQAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAaCAYAAABozQZiAAAAvklEQVR4XmNgGLnACYjvAvEjIrELRBsDAyMQTwHilUCsAOWDwBwg/gfEHlA+MxDbA/EDIDaFijGIA/EqIBaDCQCBIBCfZoAolEYS5wHixUAsAxMAOaEQLg0B+kD8CYjXADELkjjI0ElAzAsTCAViNbg0BEQD8X8gLkcTFwbiNAaE17ACkH9/A7ENugQhgMu/RAFjIP7KgOlfogAu/xIEoICYzzAk/AuK43NA/I4B4lcY/gLE1xkgBo6CUUAeAAAc6iv7Yi1TmwAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,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>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA+CAYAAACWTEfwAAAFIklEQVR4Xu3dXaiuYxoH8FvDNBPN0EyDkI9hSslMyZGPcCCaoXBgiiMyTqT23syEyEdOsCX5SiMkJ0MciElJS+QAKQeaEwdIxMSUmELD3P/u97HudXtfn3tZ797796ur93mu51nPu9bRurruj6cUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEq5vsYdNXYZL2zn/jKLn48XAACWwR9rbB2Tc5xW4/ez46dq7N5dWw9bamwak+tg3xqbaxxb4+3hGgDAhktH6c9jsjq1xhdlfiftgBqnj8kf6PMap4zJ6ojSvu/H8Pcad45JAICNliJp7zFZ2tBnCrbRbjVuKfMLue9rrxqv19hvyMeuNa4ek+vk1mJIFABYMr+u8eqYnHmnxsqQS5GWYdEMIV42O98WzqnxtzHZeWNMzBxW49Ehd1WNS4fcKL//FHvMcpfPzi+ZbgIAWAZH1XhzTM5kiDJdtt4JpXXdEilwtpV0tjJ/bJFFBVv8ocaBs+N0/1KsLSok96nxj7L6NyQyDPqr7vzZL+8GAFgC6ZbNK4Z+VlqH7ZAu95PueJEUTBle7TtYU/ymu693eI33Sxv6nPy0tGdNVrrjeVK0PV2+vrOWoc7HZp/xYVldQAEAsLQWFWxZcNB311I8rddk/HS4Phty95S1c8lWuuN5biytWHt8vNDJkOv+3XmGgjMkDACw1BZtY5FirV8FelaNB7vzbenF0hYcTFIcZk5bL/cs0g+Dpls3DY+OUrBN89XSBfy6OXMAAEsjBcxKd55hy09Lm8v1Xmnz23L8Vo2Du/u2lRSLef7/SvuOfOa8Hx6NRQsjTqxx8ZA7tMa1Qy5S2GV+2t01rhmuAQA7oHRz0nHK0OHkmRr/7s63FylwstfZssqCgOPGJADAt3F/aassJ78sbff/RUNyy+zmsnhl5UY7t6xdgAAA8K2NBVtkVWU/mf1PpQ2/9RPo0zFKEXJGjV/McsfX+GuN35XVwmlaXZn7k5tWWo6rNTOR/vnShhL/VdYWXrmW7/omecXUdWNyCWQuXb9QAADgO5lXsGUy+39rHF3aBPhsLvvbGq+U1nlLMfVujQtqPFFagZVi7oXSNoF9uayuxsw2FZnTlfNss5Hn/rPGnrPrk/tKG5rNs4+s8Uh3LZPxz+7OAQB2KosKtmxRkdWX2Xh2kvluKzXuLa2QixRh06rF6TPP+3h2HHnORbPj/Ow8817nlO06srHt2I3r9ZvHivkBAGzn5hVseS/nbaV1u+b9w18pbWizl/NsW3FQ+WrBFp+UNul+0cKALTVeKm0rjHTgTuqu5Xnnd+cAADuVsWCbFh1k1WX8p7uWSfPHlPYS8/4VTAfWuLC0Qi+mgq3fhyzbXWR4NB25eW4oayflZ1g1O/inEHyurP4+AAA7lQ9K66B9VNpeZZlrtrWs7Z6liMorlx4qbef+FHSR+WqvlVbcpVBLPsVdCsAMf94++5lJ7skcOAAA1kGKtsxrG2XhQN8Vyxy2cah0koLtijG5A8nffWVpq2l1AwGA7UoWLWyucVP56s7/O4qskD2vtMUR2b4k3cdxXiAAABsoXcYny2p3Me/39I5PAIAllS7iwzVOGPIAACyJLMJ4YEwCALDxMix6V1nd5Pfk7hoAAEsgG/9u6s7P7I4BANhgWWwwvg7qkDV3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwLr6PxGL9AQJCjdSAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAaCAYAAACHD21cAAAAuUlEQVR4XmNgGHnAEYhfA/F/JPwLiHcDsTCSOpxgDhD/A2IPdAl8QBCITwPxAyCWRpXCDzSB+C0QrwFiFjQ5vCCaAeK3cnQJQmASEP8GYht0CXwA5r+7QCyOJocXEPIfGxCzoguCAMx/RegSQMAIxE1ArIMuAQKg+MPlPxUgngvEnOgS+OIP5LxZDBAXYQBjIP7KgOk/SQaIpkdArIgkzuACxM8YEGnzLxA/gWIQGya+nAF7gI2CkQgA+LEntuOlP9kAAAAASUVORK5CYII=>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAbCAYAAABIpm7EAAAAuUlEQVR4XmNgGAWDFbACsTgQS6JhAWRFIMANxBOA+C8Q/8eC90DVgAE/VOA8ENsCsTwQLwXit0BsyQCxgQemmJEBYvIVIBaDCQKBMRB/AmJPJDEw0GSAmJSDJm4DxL+B2BdNnHQNIIFvQGyKJp7OADEIZCAKAGl4yADxGAxwAvEOIJ4DxCxI4mCgA8Q3oDQIgAKhDIgvMkBCCwOAFGQB8RkgngXEB4B4JhALIanBCjgYIM4C0aNgkAMAUTIgX1iegXkAAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA9CAYAAAAQ2DVeAAAENElEQVR4Xu3dS6iuUxgH8CWXCMe15FInUjollxwDA0woBkwMFGViYGJEUgY6BgaSOkkGklMKZWIklzPZORNFMaDE5BBOHWGC4uSy/r3va6+99sXZzv72/nb796un73uf96tzGT09a61nlQIAAAAAAAAAAAAAAAAAAAAAAAAAAAAA28CNNU7tkwAAzI93a9zeJxtHavw9xtHxc3+NXe2PAACYjTNq3Fvj9xo3d+8mZ9c4VOOiJrdQ46/mGQCAGUlnLcuh6Zq92b2b7KnxY41TmtxHNY41zwAAzEA6aq+M3x8vQ9HWFmWT58vS4uycGj/U2NvkAACYgTfKsCQ62Vfj5bK8aEt37WCNi8c4felrAABmIUVZf9Dg8hq/1rihy6fz9kSXAwBghlKsvdgnR9/X+Ll5zoGDwzUubXIAAMzY1WXYg/bNCvFnGTpqJzW/fbtYBgUAYB0uLIuF5R/j989q3NP+aI5k/Em7VxAAYEfInrrbmud0BF8oQ0dwnmSf4CNlGJniNgkAYO6c2ydGp/WJ/yHLtFd0ubtqPNTlNsr5faK6pE900lXLSdwMHF5rMDEAwKZLoXJnjZNrXFPjwxqXje/SCcvNCidqpVsW0snKPLlZuK7G7vF7OmVPlsV9fqvJjLupSPuqDEVb660ydAqvGp+fK8OMOwCAmes7XyncMsvtpRqflI0pSvqCLcXTgRr3d/mN9F4ZirYUa49171aSgm1aBu0HE6eovbLG3TVuGnO5PeK/ikAAYIeYLnLfiFjNHWW4VP6+snzD/a3dc+QUaoqgFHUrRSsjRrIk2sqflyKuH/p7vM4qw5LqWlJ85daHviBdSYqw/t+9rywdTJy5d9/++7aU35rvAAAz93GNB2u8U+OLsrRzlPyJyGGDp7vc+zW+7HLrcTwF27NlKCpTLO7u3rVWm3OXAi0z7qaDEemutcuknzffAQBm6to+UT1Qhg7YB/2LdUrXKp27qcuVQjAFVPaYTZJ7vQx/j+/G3HRTw6tl6JQ9VePRGq+N+QvK2gXbM2Vp0bmnrF605bTqL2X5jLtEupLTYOLsuft6/J6RJLM6MAEAMJeyZyz3ni40z2eOn5HiLB2tT8fn4+mwbbTcIpFuXE6gHigbs7cPANgBjpTF/WlHx8/9NXa1P9oGVirYIt2vdMoeLsN+sizdRoqnzS7Y0nHMadrra/zUvQMAWFUKl0NlmB02WSjLT2VuZ/01W+eV4STrZsvSbv6vbylOhwIA65C9WRnB0Z62zLiJY80zAABbKGMr2uIs+6pyUfzeJgcAwBZKd+1gGfZ/JfrlQwAAtlgOGUwjMAAAmDM5cHC4DDcJAAAwhzKBP0NoLYMCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAlvoHMzqm3BjHpqMAAAAASUVORK5CYII=>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAaCAYAAAAjZdWPAAACDElEQVR4Xu2WP0gcQRjFn2BEMWKhoKCVRSASEDFqYSwECy2UEFKmCAimsRWxEGystFG0UZsUgoWK4v+Q4pK0aZOU/iFEEDRNFFTUvOe3g+dwsqec7CH74MftzTc7+3bmm28WiBXrcauF7JHLJA7JfnB9SlbIM3dDNmmanJFXXnslWSJ/SYMXi1RF5Bv5QUq9mFRGfpENUuDFItNzckDmSK4Xc/oI66O+WaFOWP5+8ANJkuljUu8HotIYUuezUyH5TI5InReLRE9JArfns1RBtmFVpupmKBqlk8+t5IKsknwvlglphf/AJk+TGKqwfM4h4zDTb7xYJtWBO5gOy+daWI2eJE+8WCaVtumw+lxOvsI2YXHQpvToJQvkLRklm6QZ9mAdRCNJ/VXXtYrqN0Wqg3apiczCDrZhpGn6BWwW/XzWjL6GbT4N6gw46WW/kEFY+rTDjv2Xwf8ZmFGNOUHeXd0FlJA12OrpJXXtxn6PENO6YQfX3xrn5DfZhT38BPa90Qgz4ctVHM2spDKo/noZSTW9D1ZpfgZxJ8WGYLOrX6e00+O+SmV6MWiXnOka2Gr5prWPXB+nrDGt/59IW9Cu/F6GVaEe3ExLtSXwQKa1EQdgp6MM6WHz5F/QLjNb5Dss13UOKN4NK539sD2jXHap0kXWYWNqjIc4C+4lmUxVMjWzMpmH1PFYsWJli/4DO21yitKOtdkAAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAaCAYAAACkVDyJAAABpklEQVR4Xu2UPyiGURTGH6GIQoqERDZKMlmkGEgGJsWmMLAppYjByGphlEVSUjJ9G5mFTJJSFiUMyp/n6X7Xd+/9vEne18JTv/rec27v+Z5zz3mBf/2icsgY6QoTSamZ3JETUhHkYpfcrZBX8kYm/HT8aiK7ZBim6DEp907EKOtuhBSSfRiXek5EjWQbGUc9MC6PSIk9FCifdJA2kuvE9efLgpgnHViE76aYpGBcDjlxK/2JDTJNTsmok+uEGbx2J+apnmwh+74GEe1yHOauq8klWXByS+Sa1DgxT/P4fCJVRMVUVMWt8sgcqYJx/4SMmwKyl0a/syR3SkbtnF6otqZg2uxKhTfhd6CB3JBZeyjUDJkMg45clxokV7adaqFVL3kh3U7sQ7Vkh1SGiUAaJrnUqmhlrDSdj6Tfiam4HMppluTsmVx9wS1MwdBlC7lHpmAduUDE/cnVGcyLvoO+RNal9nAV5j3r5Dx9RteUiIpgipbCDN0A/ImNVa0wy72WftYEH8DvQKzSND6QPpgC+g7rYx+57D+V2rlMDmHWZgoJOfvXH9U7gidhBpbdEeQAAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAWCAYAAADTlvzyAAAAn0lEQVR4XmNgGAWjYDgCbiBmRRekBVAH4tVAvAyIRdHkqAYYgdgciPcD8RQglkWVph5gBmInID4MxN1ALIwqTT0AssgfiE8AcQ0Q86FKUw+AEkEEEJ8D4nwGSMKgKXAE4gdAnAHEnKhStAPIvixjoGFwogNYPJ5moHGCQQfoWUISVZp2AGSxHhBvB+K5QKyIKk1bALKsC4hV0CVGwcgBAOc5EUgX07EAAAAAAElFTkSuQmCC>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAWCAYAAABwvpo0AAAAq0lEQVR4Xu3VIQoCURSF4SdiEMEiBoNBEGxWs25gqkuw2UyuQKvVanEBxgkWQXANLsX/IYL3NqPvnh++Mie9YXiTklJKKfVLHbT8wwhNcMYJfbcVWwMz1DhgaOdya2KBK/bo2bnc8sEr3LBF187lli+1JR5Yp/dFF6o5nlihbac4fX8FmxTo8/d97oF7CnYB+vwvcGDnOOUXMcUFR4zsHKt8+B3GflBKqX/sBWIVEUix9gCtAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAWCAYAAACPHL/WAAAAvklEQVR4Xu2WsQqBURiGP0mSsiiym2VTNmZlNXMBbkBuQDaTu3AFBotBchEuxPN2FudPsVCfvqee6V3+0+l9z28WBEHwghGecYaVQuaWGs7xhgus57FfdEO6qQuusJHHfinjGE+4wWYe+6WEAzziDjt57JcqrvGO3ULmiuexWJrjsdCH6wBXcz7nWjWtm96lqaVxcInKrtKr/ENzfBAxwQP2LK1aEHwZLVjbUo/e2TIH/erj/kO39kd/C8GveQAQgxldyVGOsAAAAABJRU5ErkJggg==>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAWCAYAAAC/kK73AAAAk0lEQVR4Xu2VMQqEMBBFx87eym61sbP1DHsy2V6xEE9gK1hYCOLB/B9t3F7Il3nwIDDNZPKTmDmO4zxBfClHDhf4g8lfLXgiWMIZDjC7lzUo4HjJtRycOqe/wcrOU5Eiha2JboCXtoM7/NxLYcJpN3A1kWkz3z2c7Hxtgm5Y7klkw4wB48BYMB4SfGFtgr+m47yVA6uoES4wh7ERAAAAAElFTkSuQmCC>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAWCAYAAABwvpo0AAAAk0lEQVR4Xu2WMQqDQBREv529lV20sUvrGXIysTekEE9gG7CwEIIHcwZt1iNk5sGDhV/93dn9G2GMMcbkl7LUcIU9LG41GTL4hAucYJWWtWjgfMm1LEwB0/CDbZwpkaSE7xDfCD6OH7jDR1r6b3j6A9xC7PR5/0f4jXM6SDQuOwrZOOPNmDPujL0UL9iF8C/QGKPJAQB2ES676bE8AAAAAElFTkSuQmCC>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEMAAAAWCAYAAACbiSE3AAAAqUlEQVR4Xu3VIQoCURSF4SsyQQSLTDAYBMFmnawbsLoEm83kCrRarRYXYDRYBME1uBT/hwjeuwHDuT98ZU57zLwxy7Isy7J/1EUVH6o1wRkn1GGTqIUGVxww9LNGbcxxwx59P2tUDmGBO7bo+VmjciEu8cTaPpekbDO8sELHT5r9vh0bE/1EYt9742HCl2cs/lYHftasHMoUFxwx8rNu5SB2GMchy7JMrTesTRFIjbruQQAAAABJRU5ErkJggg==>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAAAWCAYAAABQUsXJAAAC/UlEQVR4Xu2WS6hNURjHP6HIO+UVuVceiQEJKcmAYkDyyDNKXUwx8BgpGRBmIgYOEgZIoTzKjQmZUF4pA/IYYYJC4v87317nrL3O3rluysD516999tprrfPfa33ft7ZZU00F9RaDRNf0QSSe9Ukb/7UWiztip7gghuQfV4Xx7WJL3NhTrBJHxT4xLn74BxopzpqvXlAPsVZMzH5jYLjYIFqyPiPEAzEzu18jPohdYowYKuaJ6+Ka+Q5V1U/cELuzxkniiVgSOnRQ3cVx8dL8z4L6i3viZ8J+8zFovvk4XgqNEgdFq1gqVotF5jsyOetT1TZxXwyI2uj8VAyO2n6nZeK7NZpnQa6IR+KFqIjpokvUBw/xOK4nLFphaaMl4YJhjNMx1lTxSSxM2svUYh5yl63YPPPHbamI93gcO3DEPMzQBHHK8i9j48V7azQ/RXwWe5L2IrH1B8Q083k6Y54ce2a+aIj43pz9Jh8rloQLCibLzKftRSI32E7CoMz8OfMYJnTeiEtWT1bE2K3itlhvvoMh/pk7Fy5BC8yTJzXZUfNUl2PmSY/KzFMhlpubBIrDc/PxsUabe+qb3bPaVK8QLuwQ1XAlN2R5Z80TLlQMki+oyDxmOVS4BhEeX8xLYZkwjPEQLoQlVYv7NhrKTJa1xyKZQ7gEFZkvUpj/puiVPAuKw6WbOGP1HCQPqvX0nTWaDJNz2pWJGH6V8M18J9+arxrG9pqX0Lk+rKowf7slFSRTGi6UbMosJbUmHrab1+FQltAccyNcg4jrYZZf6VRFK0/bD8ubD2HDoZbOl4YLYj7mzZlHHMWsWmt2z2Qk1F2rJ+JA8VB8FTOytlSMOy1eW71SoBXm3yPBJNcd4qN5HKciVDiQYpEzfPcE87UXJvEOi1vmRzDGH5t/JgSxGletuEKgTebfIuHoZ9dC2DD/IXFerBMnzc8WikUqVrtiWUwnwvhF8/moSjXxJmPNvyNmZR3+puL5Z1s+RINo4yVzxiLxQuQPO8C3WFNN/Vf6BVXcnrJ+9ezMAAAAAElFTkSuQmCC>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAAAWCAYAAABQUsXJAAADDElEQVR4Xu2WS+hNURTGl1CURyKvSOSRDJCQwsiAREJ5llIoE6GQ0S0MGEjKIxN/SQw8JigMvCZkgIFHJI9EFCMGlPh+d+91zz77Om7pXwbuV7/u3fvse8531lp7r2vWVluuXmKg6JpfSMS13vnkv9ZicVvsFOfF4PLlujC+Q2xJJ3uKleKY2CfGpRdbiLX8ht9uFUPKl+vqIqaLg+KwmG/l6A4XD8TMOF4tPouaGGPhnnPFVXHFQobq6iuuiV1xcpJ4LJb4gj+INefERDFL3BffLUTRhfFt4qYYKfqLUxZetntcM0+8FsPieJTYb2H9UrFKLLKQkclxTV3bxT3RL5lj8RMxKJnLxTXSPMeCQTRavBPPLUQTTREfrIgqwhxmiSbCA2PPGp8nLImwtMGycsEwxlmYaqr4IhZm86kw9VW8sOIleQmi+tNCNNEeKxtDbDhe/LiF35CpdA0ZOCp6xPEEcdLKL2PjxSdrNu/GeHCVKDdKBgPpTbkX5hdYePglazbP+htWZJx989RC0BAZ2Ry/sx87LCsX5CarzOfzreSZpEww5CarzPs80Wez3xJrxUUr6p9SKZWLi+gQpdzk35pfJn5Y2KAYwhgGW5l3sWfw1CeOifYZKzLrJ9sKBtRlZ5kfYWGT16w4RdgL7IncZJX5VKzBuJfLNHE3jtcxUWWyar5K1D+1vcnK53eVyar5VGm5dBOnrdiD7IP6kfXemk26ebpdK7lxSoZSQbMt9AseetaaTbp5Tpzftfq8XDyDHKkN+U14uB9LiLObZsOnC5NDrTCIKI8DVm5KaLcVJwcP5ETjZHMNEI8sdNxcebkg3zsl84hW/MZCN0OYo9vesWAY0RUfim9iRpzDeC3O8XvnrXhlIauITcjc8jhGdOOPVtwrFaVCQ0rlfcHNNwKIiSPiuoUWjHGiQtpdROOyeGZhYyIvLTZ8Tt6xycxLsV6ssfD3Y6OVs4iIdofFms6E8QsW/BKQhrjJWAv/I6hXPy06U2SPYxD4nouyPWSZsUS80F4LGeC/WFtt/Vf6Bfuap18XBpxNAAAAAElFTkSuQmCC>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIEAAAAWCAYAAADnw/+rAAADVUlEQVR4Xu2ZWaiNURTHl1BkyhAJGTIkHsgUeZIhGZIhihKSsZQhUZ6kvJlLxitlLk+GopyiyINSQkqGSB54U0qG/9/a+3777G9/91zKOfde61e/7vn2951zu2etvdde+4oYhmE0F9rCXrBdfCOiE2wdDxrNn/7wLtwJb8Ip5bfrmQQvwI7xDaM6dIab4DG4C/Yuv13IItHgMXCtYE+4DI5y99vAE3CPux4MX8Erou/j7xkJD8J3cLR7zqgynKmP4WrR5XomfAHHhw8lYIAvwZ+Rl2EX9wxLwEs4313zPftFAz8dLofz4F642T1jVBk/Uzkz+drDmculu30wloLvfQLfin7GLCmv6WPgFzgnGDvkxj0j4FmxMlAzBsEPcHs0zpnL4IXBShEHNKav6DLvk4Al4wAc7q6ZZHViZaCmTIU/JJ8EDBqX9qXReEylJGB5uSq6KSQsD0clm/VrxMpAzfHBLkqCeDzmMNwHH4nO+PuSn9Vj4VO4AZ6Dc904n7NuoAnAIKeC3dgkOA13SLYPYGfwWfKbSnYf/Ex2B4SBZwL4hPHdCTuTHm6sIVhWFsP38Du8KFp6UnQQ3fS2ePxhDFuuSrKN80HjUpwKdmOTID7c8XuA81K+0Yzh7/VlgJ3EDdFOYQI87sYaYhq8BoeK/j2r4DM4MXzIwe9lYzzYEmFfzh6/MXJjNuD3u4qDXTReCSbZG9G2kF9+irgMLIEPYVd3vV6ykpGCycXuJf58rjIP4ErJEpM/t8IZ/iEjz2T4TfLB9kng+/sUK0Q3lWuDMZ8ENHXgFJcBwjaz5O6RcaKJUATLxbZ40NFN9OyC5xwnRfcqR0RXSqOAPvC16IldCHftnyRr5QhnXvfgmonDRAmTwJeDkqQ3fGEZ8JyR8ufZbWypv5uHAU0lmIf7BZaJhaKfZf+LqAC/sN2iy6ivw/ySOZvCuj4MfhQN8EA3xvrL7iCcZdysfYULgjEPZ3+d5A+g2D6WJEsCloL/YiPXlGDwr4vusHlkfArek/LdNl/zaPm2ZMnCBOKMvSO6MeNqwtWDSznvhTDAPBXk6WAMZ+tzOEQ0oZhYqeeMfwyXTAbjb5bQfqLn//xfQNGunpu1ooMnJsxs0fp9C65zY4ZhGIZhGMYf8At885Wu+xxtQwAAAABJRU5ErkJggg==>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAWCAYAAABjadrAAAAAmUlEQVR4Xu3WsQrCMBSF4evm3qmburh17TP4ZMVdcRCfoGvBwUEQH8xzaIZGTGfF/4MfCtnCTdIIAAB+3TKFgo26qb2q3taQLFSjruqi1vkypraqT/kbBZ4iT9NDtTFOGT6o1THYqFm+vE/qqVb50n/z9BzUPZiejO+fsxpifN3YmOCpL/LG+Pj4GPk4+VhhYqe64C8aAL7KC+0xES7CwS2FAAAAAElFTkSuQmCC>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAWCAYAAAB64jRmAAAAq0lEQVR4Xu3VIQoCURCH8RHZIIJFDAaDINisZr3AVo+wzWbyBFqtVosHMG6wLAh7Bo/i9xDBmWT0DfPBr/hPj3XfikRRFEX/UR+F/dFLc1xxwchsWdfBEjVOmOg577pY444jhnrOu3S4Eg32GOg579JFskGLrbwvF3et8ESFnp589f00d+Lsr2r7vJcPcXjp2OznY6xnX6XDLnDDGVM9+ysd8ICZHaIoin7tBQo4EUgWoUAUAAAAAElFTkSuQmCC>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAWCAYAAADwza0nAAAApElEQVR4XmNgGAVUAXxAXAPEh4BYGU0OKxAG4m4gPgzETkDMjCqNCRSBeC4DxAZzIGZElcYE6kC8Goq1GAhoAEmCTN3OALEFZBtRwB+IPwFxEAMBG7ABkgMBHcCC/QQDxCUkG8ANxPlAfA6I44CYE1WaMGAF4ggGiAEgg0AGkgRATgY5fQcQq6DJ0RGA/CEOxJJEYDEGpJA2AOJZROJeBogBdAYAfeYZc3ktYNEAAAAASUVORK5CYII=>