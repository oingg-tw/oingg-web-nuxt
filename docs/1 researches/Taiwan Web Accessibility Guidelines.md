# **台灣網站無障礙規範之架構演進與技術實踐**

## **規範沿革、法規背景與管轄權責之轉移**

台灣推動數位資訊平權之制度化歷程，緊密呼應國際全球資訊網協會（W3C）「網頁內容無障礙指引」（Web Content Accessibility Guidelines, WCAG）之演進脈絡。早期的推動工作由行政院研究發展考核委員會（研考會）統籌，隨後於行政院組織改造過程中移交國家發展委員會（國發會）接續辦理1。為落實身心障礙者權益保障法第52條之2對於各級政府機關公立學校與公營事業機構之無障礙網站建置要求，並契合聯合國《身心障礙者權利公約》（CRPD）所揭示之近用權精神，國家通訊傳播委員會（NCC）於民國106年（2017年）2月15日參照WCAG 2.0公告實施「網站無障礙規範2.0版」3。  
隨著智慧型行動裝置之普及以及響應式網頁設計（Responsive Web Design, RWD）成為前端架構之主流，舊版規範對於觸控、旋轉及小螢幕適配之約束力已顯不足4。主管機關於民國110年（2021年）7月1日正式實施修正案，全面對齊WCAG 2.1標準，並去除版次後綴，統一定名為「網站無障礙規範」（實務工程界常依施行日期稱為110.07版）7。民國111年（2022年）數位發展部（數發部, MODA）掛牌成立後，正式承接原由國家通訊傳播委員會主管之網站無障礙業務、法規維護及標章認證管理體系10。因此，產官學界常稱之「國發會版」或「網站無障礙規範2.0」，在現行法定與行政架構下，已具體演化為由數位發展部主管、全面對接WCAG 2.1 AA等級之國家技術規範7。在適用主體上，除了法定強制之政府機關、公立學校外，亦逐步擴展至接受公部門獎補助之社福單位、公立醫療院所及提供核心公共服務之網路金融系統（如Web ATM與網路銀行）10。

## **POUR四大原則之核心哲學與體系結構**

現行「網站無障礙規範」繼承WCAG 2.1之核心本體論架構，建立於四大設計原則（POUR）之上，向下開展出13項指引與78項成功準則，以三種檢測等級（A、AA、AAA）作為度量系統無障礙程度之分級基準14。這四大原則並非彼此割裂之檢查清單，而是構成人類透過各類使用者代理（包含輔助科技）與數位資訊進行互動時不可或缺之認知與物理鏈結14。  
可感知原則要求所有傳遞之資訊與介面控制元件，不得僅仰賴單一感官通道呈現14。視覺障礙者無法感知純圖像或純視覺排版，聽覺障礙者無法感知純音訊資訊，因此系統必須具備將視覺轉化為語音或點字、將聲音轉化為同步文字字幕的能力14。可操作原則強調任何介面互動不得假設使用者具備特定運動能力或操作型態，系統必須提供鍵盤、替代開關、語音控制及單點觸控等多元操作模式，並給予充分的操作時間與導覽路徑14。可理解原則關注資訊架構與互動回饋的清晰度，旨在降低使用者的認知負荷，確保介面運作可預測，並在發生輸入錯誤時提供具體且具容錯能力的導引14。穩健性原則則著眼於網頁技術規格與語意結構的完整性，確保網頁內容在現代瀏覽器或未來輔助科技演進過程中，皆能被正確剖析與精準呈現14。

| 原則名稱 | 英文代碼 | 核心設計理念 | 關鍵涵蓋之工程面向 |
| :---- | :---- | :---- | :---- |
| **可感知** (Perceivable) | P | 資訊與介面元件必須以使用者能覺察的方式呈現，不能對所有感官通道均隱形14。 | 非文字內容替代文字、時序多媒體字幕與口述影像、版面流動適配、文字與非文字之色彩對比度14。 |
| **可操作** (Operable) | O | 使用者介面元件及整體導覽機制必須具備完整的物理與邏輯操作可行性14。 | 全鍵盤可操作性、無鍵盤陷阱、足夠閱讀與操作時間、防誘發痙攣之閃爍限制、導覽路徑與指標手勢14。 |
| **可理解** (Understandable) | U | 網頁內容的呈現與互動元件之操作邏輯必須清晰直觀，符合可預測之認知常規14。 | 頁面與局部內容語系標註、焦點變更之可預期性、全站一致性導航機制、表單輸入防錯與錯誤指引10。 |
| **穩健性** (Robust) | R | 內容科技必須具備高度標準化與相容性，以支援主流使用者代理與各式輔助科技14。 | HTML標記語意化、元件名稱（Name）、角色（Role）與數值（Value）之標準暴露、動態狀態訊息即時通報10。 |

## **WCAG 2.1 AA等級核心指引與技術準則深層解析**

在公部門推動與標章認證實務中，檢測等級AA被界定為消除顯著近用障礙的通用標準11。欲達成此等級之要求，開發團隊必須在前端實作中嚴格落實多項具體成功準則。

### **替代文字與多媒體替代內容**

非文字內容（指引1.1）與時序媒體（指引1.2）之替代機制，是視覺與聽覺障礙者跨越感官限制的核心技術14。依據成功準則1.1.1（非文字內容，等級A），所有傳遞訊息的非文字元素均須配置等義替代文字14。實務上，純裝飾性圖案、留白排版圖片必須明確指派空值 alt="" 或透過 aria-hidden="true" 隱藏，避免螢幕閱讀器讀出冗長且無意義之檔案路徑；而具備功能性之控制圖示（如放大鏡圖示按鈕），則必須清楚標明其互動目的而非外觀形狀10。針對影音多媒體，成功準則1.2.2（預錄字幕，等級A）強制要求預錄視訊必須配置同步字幕，字幕內容除口語對白外，亦須涵蓋環境關鍵音效、背景音樂情緒及說話者識別14。進一步在成功準則1.2.5（預錄口述影像，等級AA）之規範下，若視訊畫面包含重要動作、圖表、場景切換或文字看板且未反映於音訊旁白中時，必須額外提供語音口述影像軌道或替代完整文稿，使全盲讀者得以藉由聽覺重構完整影像脈絡14。

### **色彩對比度、非文字對比與重新排版**

指引1.4聚焦於視覺呈現的可辨識性14。在色彩對比層面，成功準則1.4.3（對比度，等級AA）確立了文字與背景之間的相對亮度對比計算基準14。一般內文（小於18pt/24px之常規字體，或小於14pt/18.5px之粗體）之對比值不得低於 ![][image1]；大字體（18pt/24px以上，或14pt/18.5px以上粗體）則不得低於 ![][image2]11。對比值之數學定義為兩相鄰色彩之相對亮度比：  
![][image3]  
式中 ![][image4] 為較淺色彩之相對亮度（介於 ![][image5] 至 ![][image6] 之間），![][image7] 為較深色彩之相對亮度，該數值之理論動態範圍落於 ![][image8] 至 ![][image9] 之間14。文字周圍若帶有描邊或暈輪，該邊框亦納入相對亮度評估範圍14。  
WCAG 2.1 AA相較於前代規範，在此領域進行了關鍵擴展。成功準則1.4.11（非文字對比，等級AA）將對比要求由文字延伸至使用者介面元件與圖像物件16。輸入框邊界、選取框、單選按鈕圖形狀態以及數據圖表中的關鍵線條與圖例，其與周邊相鄰背景之對比度均須達到至少 ![][image2]。此外，成功準則1.4.10（流動排版 Reflow，等級AA）專注於改善低視能者的閱讀體驗17。規範明定網頁內容在垂直滾動排版下，寬度縮減至相當於 320 CSS 像素（即在 1280 像素解析度下放大至 400%）時，內容與功能不得喪失，且除地圖、大型資料表格或特定視訊編輯器等本質需要二維視野之元件外，頁面絕對不得出現水平滾動軸17。搭配成功準則1.4.12（文字間距，等級AA）之實施，系統必須保證使用者透過自訂樣式表擴大行高（1.5倍）、段落距（2倍）、字距（0.12倍）及詞距（0.16倍）時，介面文字不得產生任何重疊、遮蔽或文字框溢出截斷現象。

### **鍵盤操作能力、無焦點陷阱與焦點能見度**

指引2.1與2.4旨在確保網頁在完全抽離滑鼠與觸控板的情境下，仍具備完整的可導覽性與可操作性14。依據成功準則2.1.1（鍵盤，等級A）與2.1.2（無鍵盤陷阱，等級A），網頁中所有交互控制元件（包含超連結、表單控制項、自定義按鈕及多層級下拉選單）必須皆能經由標準鍵盤操作完成呼叫，且焦點移入任何互動元件後，必須能夠藉由標準鍵盤指令（如 Tab 或 Esc）順利移出，嚴禁將鍵盤游標困於彈出視窗、日期選擇器或富文本編輯區塊內部11。  
在導航路徑管理上，成功準則2.4.1（略過區塊，等級A）要求頁面必須配置跳過重複內容區塊之機制（通常表現為在頁面最上方隱藏、獲取焦點時顯示之「跳至主要內容區」快速鍵）10。成功準則2.4.3（焦點順序，等級A）要求鍵盤跳轉邏輯必須嚴格依循內容之視覺結構與邏輯順序，避免因 CSS 絕對定位或混亂之 DOM 排列造成跳轉錯位14。而成功準則2.4.7（焦點可見度，等級AA）則強制要求任何當前獲取焦點之元件，必須具備顯著的視覺外觀提示，前端開發嚴禁使用 outline: none 清除預設焦點外框而未提供等效或更具辨識度之焦點樣式11。

### **行動介面、觸控手勢與輸入模態**

指引1.3與2.5直接針對行動裝置、多點觸控螢幕及替代輸入設備制定了規範性防護14。成功準則1.3.4（螢幕方向，等級AA）禁止系統強制鎖定單一顯示方向（純直向或純橫向），確保固定在輪椅支架或特殊輔具底座上的行動設備能維持正常瀏覽體驗14。成功準則2.5.1（指標手勢，等級A）要求任何利用多點觸控（如雙指捏合縮放）或路徑手勢（如滑動翻頁、拖曳調整）完成之功能，均須提供基於單點點擊（Single-point activation）之替代操作元件（如加減按鈕或點選式分頁控制器）14。  
為防止肢體震顫或協調障礙使用者誤觸介面，成功準則2.5.2（指標取消，等級A）規定單點指標之核心動作觸發必須綁定於放開（Up-event/PointerUp）事件，而非按下（Down-event）事件，並容許使用者在釋放前將指標移出點擊有效範圍以安全中止動作18。成功準則2.5.3（標籤包含名稱，等級A）則針對語音辨識輸入者提供保障，要求介面元件視覺呈現的文字標籤，其字面字詞必須完整包含於該元件之輔助技術可辨識名稱（Accessible Name）之內，避免語音控制軟體下達操作指令時無法精確命中該元件16。

## **規範版本演進：行動裝置支援與響應式網頁技術對比**

相較於舊版以WCAG 2.0為基礎之網站無障礙規範2.0，現行接軌WCAG 2.1 AA之版本，在架構上並非推翻原有原則，而是針對現代前端技術生態（尤其是智慧型手機、平板電腦與多樣化周邊硬體）進行了顯著之功能補強與標準細緻化4。舊版規範成形時，Web生態系仍以桌面顯示器與滑鼠為核心，因而對流動排版、手勢互動及非文字介面對比缺乏具體法規約束，造成大量標榜「符合規範2.0」之網站在行動裝置上出現操作困難6。現行規範之實施，徹底消除了此類技術斷層。

| 規範評估維度 | 舊版規範 2.0 (WCAG 2.0) | 現行規範 (WCAG 2.1 AA對齊版) | 技術架構升級意涵與實務價值 |
| :---- | :---- | :---- | :---- |
| **螢幕方向約束** | 缺乏限制，允許網頁CSS或應用邏輯強制鎖定直向或橫向。 | **成功準則 1.3.4 (AA)**：除必要例外，嚴禁限制單一顯示方向14。 | 徹底保障物理固定於輪椅、床邊支架之行動裝置使用者的平權閱覽權利17。 |
| **響應式縮放排版** | 僅要求文字可放大至200%，允許產生二維水平捲軸。 | **成功準則 1.4.10 (AA)**：320px等效寬度下必須重新流動，禁止水平捲動17。 | 驅使前端工程全面屏棄固定像素容器，全面實作彈性流式格線（Flexbox/Grid）架構。 |
| **介面元件對比** | 規範範疇局限於純文字與文字影像之亮度對比（4.5:1）。 | **成功準則 1.4.11 (AA)**：擴展至輸入框邊線、按鈕邊界與資訊圖表（3:1）。 | 解決低視能者與戶外高反光強光情境下，行動裝置使用者無法辨識控制項邊界之痛點。 |
| **手勢控制容錯** | 僅規範鍵盤操作與常規滑鼠點擊，未約束複雜觸控。 | **成功準則 2.5.1/2.5.2 (A)**：排除強制多點手勢，建立放開觸發與取消機制14。 | 讓手部震顫者、單指操作者或使用頭杖/眼動儀的使用者具備完整操作介面的能力14。 |
| **排版間距調適** | 限制在預設視覺排版，未規範使用者自定義間距覆寫。 | **成功準則 1.4.12 (AA)**：使用者強制擴大行高與字距時，介面不得損壞截斷。 | 排除認知障礙與閱讀障礙者透過自訂樣式調整可讀性時，版面字元交疊遮擋之弊端。 |
| **非同步狀態廣播** | 僅規範焦點轉移，動態插入之狀態常因未獲焦點而遺失。 | **成功準則 4.1.3 (AA)**：新增狀態訊息標準，須藉由ARIA live區域通報。 | 購物車增減、非同步檢核成功等動態狀態毋需強行奪取鍵盤焦點即可由螢幕報讀軟體朗讀。 |

## **無障礙標章申請機制、編碼體系與雙軌檢測作業流程**

台灣網站無障礙認證機制採取標準化之編碼技術體系，並結合「自動化機器檢測」與「專家人工稽核」雙軌並行模式，以落實客觀評估與真實使用體驗之一致性10。

### **檢測碼與稽核評量碼之編碼架構**

規範將所有檢驗項目拆解為嚴密的十碼代碼（3碼文字與7碼數值，例如 XX3141099E 或 HM1110100C），使軟體開發與檢測委員擁有共同的語法參照基準14。該十碼字符由五個層級結構組成14：

* **網頁科技別（前2碼文字）**：標明檢驗項目所屬之標記語言或技術體系，如 HM 代表 HTML、CS 代表 CSS、ME 代表多媒體、GN 代表通用設計指引，XX 則代表與技術無關之廣泛通用規則10。  
* **檢測等級代碼（第3碼數值）**：對應認證標準之分級，1 表示檢測等級A，2 表示檢測等級AA，3 則表示檢測等級AAA14。  
* **成功準則代碼（第4至7碼數值）**：直接對映 W3C WCAG 成功準則編號，例如數值 1410 代表準則 1.4.10（流動排版），數值 2404 代表準則 2.4.4（鏈結目的）10。  
* **檢測項目流水號（第8至9碼數值）**：代表在該項成功準則下具體細分之技術查核子項，編號範圍為 00 至 \`9910。  
* **檢核屬性代碼（第10碼文字）**：代表該項目之檢驗執行機制，C 代表可由演算法全自動判定之「標準檢測碼」（Check），E 則代表必須依賴專業人員進行語意與可用性判定之「稽核評量碼」（Evaluation）10。

### **雙軌檢測作業與標章生命週期程序**

無障礙標章之取得並非單純之行政申報，而是一套嚴謹的工程審查程序10。其生命週期作業流程涵蓋六個關鍵階段：  
首先，在機器自動化檢測階段，申請單位必須運用數位發展部發布之單機版「FreeGo」檢測軟體，針對送審網站全站進行深層爬取與掃描10。FreeGo 主要檢測規範中全數之標準檢測碼（C類代碼）11。受測網站之「Show No」檢測報告必須達成完全零錯誤，系統方會核發一組有效之檢測上傳編號10。  
其次，在自我評量與送件階段，承辦人員必須在取得 FreeGo 上傳編號後的 **7個工作日** 之內，登入「無障礙網路空間服務網」填報申請資料，逾期該筆上傳紀錄將遭系統自動刪除廢止11。公立機關或學校必須嚴格以「我的e政府」公務帳號綁定機關識別碼（OID）認證登入11。申請端需依循各項稽核評量碼（E類代碼），針對網站存在之特殊模組（如輪播看板、資訊圖表、嵌入媒體、行事曆套件、iFrame結構）完成線上自我評量表，並逐項檢附對應之驗證網址10。  
第三，進入實體人工檢測階段，數位發展部委託之專業檢測團隊指派無障礙評審委員進行逐頁實測，審查作業期通常為 **7至14個工作日**10。檢測委員藉由螢幕報讀軟體（如NVDA）、純鍵盤操作模式、對比分析儀及高倍率視窗縮放環境，實地驗證網站之動態交互體驗是否符合稽核評量碼之要求10。  
第四，審查判定與退件補正機制啟動。人工檢測之結果分為核發、限期改善與退件三種路徑。若僅有少數非結構性輕微瑕疵，審核單位將寄發限期改善通知，申請單位必須於 **5至7個工作日** 內修復程式碼並線上回報複查10。然而，若人工檢測判定網站在基礎體驗上存在重大障礙，特別是在 **指引2.1（鍵盤可操作）**、**指引2.4（可導覽）** 及 **指引4.1（相容性）** 當中出現 **兩項（含）以上** 之重大不符情事時，系統將逕予退件結案10。遭遇重大退件之案件，自退回日起算必須歷經 **7日** 之鎖定期，期間不得重新遞件，迫使開發團隊進行實質架構修正10。  
第五，在標章核發與嵌入階段，審查合格之網站將獲准下載對應檢測等級之無障礙標章圖示，並取得動態查驗鏈結14。管理單位須將標章置於網站首頁下方適當處，並於首頁 HTML \<head\> 區塊內嵌指定格式之中繼標籤以供爬蟲驗證10：

HTML  
\<meta name\="Accessible\_website" content\="本網站通過AA檢測等級無障礙網頁檢測"\>

第六，在長期營運與抽查維護階段，無障礙標章之法定有效期限為 **3年**，期滿必須重新執行完整驗測程序11。在3年有效運作期間，主管機關會定期或不定期指派人員進行隨機抽驗；若抽驗發現網站因改版或後台維護不當而偏離合規標準，管理單位若未於規定期限內完成改善，標章資格將遭主管機關依法撤銷並對外公告11。

| 作業階段名稱 | 執行角色與核心工具 | 關鍵時效與核心合規指標 | 成果產出與流轉條件 |
| :---- | :---- | :---- | :---- |
| **1\. 機器自動化檢測** | 開發/管理單位 工具：FreeGo檢測軟體10。 | 標準檢測碼（C類）全數合格。 未通過列表（Show No）必須為 0 錯誤10。 | 系統核發檢測上傳編號10。 |
| **2\. 自我評量與送件** | 申請單位承辦人 平台：無障礙空間服務網10。 | 取得編號後 **7個工作日** 內送件11。 公務單位須強制使用 e政府公務帳號綁定OID11。 | 填妥E類稽核評量碼自評表，進入待指派審查狀態10。 |
| **3\. 專家實體人工檢測** | 數發部委託檢測團隊 工具：NVDA、鍵盤、縮放器10。 | 人工檢測審查期約 **7至14個工作日**10。 全面查核稽核評量碼與動態可用性10。 | 產出人工檢測評估報告書11。 |
| **4\. 補正或退件處理** | 申請單位與技術團隊 | 輕微缺失限期改善：**5至7個工作日** 內修正回覆10。 指引2.1、2.4、4.1有兩項未過即遭退件，並受 **7日** 鎖定10。 | 通過複審或結案退回重新申請10。 |
| **5\. 標章核發與部署** | 申請單位工程團隊 | 首頁張貼認證標章與動態反查連結14。 HTML標頭加入合規之 Accessible\_website meta 標籤10。 | 取得正式認證資格與授權標章14。 |
| **6\. 長期稽核維護** | 主管機關抽查團隊與營運單位 | 標章法定有效期限為 **3年**11。 營運期間接受不定期隨機抽測，未改善者撤銷標章11。 | 效期屆滿重新驗證或維持有效狀態11。 |

## **前端實務開發常見不合規缺失與架構重構策略**

在前端工程開發中，開發團隊常陷入「以自動化檢測取代可及性實踐」的迷思2。由於 FreeGo 等工具僅能辨析 HTML 語法標籤之屬性齊全度（如是否存在 alt 屬性），無法實質理解語意等義性、焦點管理及動態互動流程，導致大量通過機器檢測的網站，在人工審查階段面臨嚴重缺失回報2。以下歸納實務中最常發生的架構缺陷與具體重構策略。  
在導覽路徑與焦點控制領域，最嚴重的缺失在於非語意化元件的濫用與焦點陷阱10。許多前端框架元件以 \<div\> 或 \<span\> 綁定點擊事件製作自定義按鈕，卻未配置 tabindex="0" 與 role="button"，亦未監聽鍵盤 Enter 與空白鍵觸發事件，造成純鍵盤使用者完全無法存取其功能10。同時，在彈出式模態視窗（Modal Dialog）實作中，常缺乏焦點捕捉機制，當視窗開啟時焦點仍滯留於底層背景，或是在關閉後未將焦點歸還給原觸發按鈕，嚴重破壞焦點預測性10。此外，部分設計團隊為維護視覺極簡感，於全域樣式表宣告 \* { outline: none; }，徹底抹除了鍵盤焦點的可見輪廓，直接違反成功準則2.4.711。  
在色彩對比與視覺排版方面，常見設計端為追求當代扁平化風格，採用淺灰文字配白底、或是無背景色僅帶淡灰邊框之幽靈按鈕（Ghost Button），其文字與元件外框對比度常低於 ![][image1] 或 ![][image2] 之法定門檻11。在響應式流動排版（Reflow）領域，開發者若於容器樣式中固定宣告高於 320 像素之絕對寬度（如 width: 960px）或鎖定 overflow-x: hidden，當低視能使用者將瀏覽器縮放至 400% 時，資訊內容即會遭到截斷或引發水平滾動軸，違反成功準則1.4.1017。  
在語意宣告與表單控制面向，普遍存在影像替代文字形式化與表單標籤脫節之弊端10。許多內容管理系統（CMS）自動將上傳之檔案名稱（如 alt="IMG\_20230501.jpg"）直接填入替代文字，或對具備導覽目的之超連結僅標示「按此」、「更多」或「詳細內容」，導致輔助科技使用者完全無法理解其目的與情境脈絡10。而在表單設計上，開發者往往僅仰賴視覺提示將說明文字置於輸入框旁，未以顯式標籤 \<label for="id"\> 進行關聯，或是當表單驗證錯誤時僅以「變更輸入框為紅色邊線」作為唯一提示，未提供具體的錯誤文字敘述與 ARIA 錯誤狀態關聯，使視障者與色盲族群無法察覺錯誤成因10。

| 缺失分類範疇 | 實務常見不合規缺陷現象 | 技術根因剖析 | 推薦工程重構與標準實踐策略 |
| :---- | :---- | :---- | :---- |
| **焦點可操作性** | 彈出視窗開啟後鍵盤焦點留在底層；或自定義按鈕無法由鍵盤 Tab 選取10。 | 使用 div/span 模擬互動按鈕；對話框元件缺乏焦點鎖定（Focus Trap）與還原邏輯。 | 1\. 互動控制項優先採用原生 \<button\> 或 \<a\>10。\<br\>2. 自定義按鈕補齊 tabindex="0"、role="button"及鍵盤事件監聽。\<br\>3. 模態視窗啟用原生\` 或以腳本實作焦點限縮與關閉後焦點返還機制10。 |
| **焦點能見度** | 鍵盤游標遊走於頁面時，視覺上毫無任何高亮外框提示當前位置11。 | CSS全域樣式抹除預設外框（outline: none），且未重定義焦點樣式11。 | 導入 :focus-visible 虛擬類別宣告顯式樣式： :focus-visible { outline: 2px solid \#005A9C; outline-offset: 2px; } 確保焦點框相對於相鄰背景維持至少 ![][image2] 對比度11。 |
| **色彩與文字對比** | 內文灰階過淡；輸入框、切換開關之邊界線條融入背景無法辨識11。 | 設計階段未經亮度比計算，僅憑高階螢幕直覺配色，忽略弱視與強光情境11。 | 1\. 一般文字與背景色彩對比度強制 ![][image10]（大字體 ![][image11]）11。 2\. 表單輸入框邊界、圖示狀態外框強制 ![][image11]（成功準則1.4.11）14。 |
| **響應式流動適配** | 頁面在 320px 等效寬度（400% 縮放）下產生橫向捲軸或文字區塊溢出遮蔽17。 | 容器排版使用絕對寬度宣告（如 px 定死寬度），或使用限制彈性之絕對定位。 | 1\. 版面結構改採彈性流式容器（Flexbox 或 CSS Grid）。 2\. 容器寬度設定 max-width: 100%，字級與間距採用相對單位（rem、em）17。 |
| **替代文字與鏈結** | 螢幕閱讀器讀出流水圖檔名；或重複讀出「更多」、「了解詳情」等無意義連結10。 | 圖片 alt 屬性填入檔案名或留空；錨點文字脫離頁面脈絡時缺乏獨立指示性10。 | 1\. 圖片應提供表述情境與功能的具體文字（裝飾圖則保留 alt=""）10。 2\. 鏈結錨點文字需具備目的獨立性，如將「更多」重構為「查看112年年報完整內容」10。 |
| **表單標籤與錯誤提示** | 輸入欄位無關聯標籤；送出失敗時僅標註紅框，未通報錯誤原因10。 | \<input\> 未配置 \<label for\>；錯誤驗證僅以視覺色彩區隔，未配置文字與ARIA狀態10。 | 1\. 確保每個表單控制項皆有關聯之顯式 \<label\> 元素10。 2\. 錯誤狀態追加錯誤文字，並配置 aria-invalid="true" 及 aria-describedby="err-id"14。\<br\>3. 動態錯誤回饋配置 aria-live="polite"\` 實現非同步語音朗讀廣播14。 |

## **結論：系統化整合與數位平權實踐**

台灣「網站無障礙規範」走過研考會、國發會至國家通訊傳播委員會之制度奠基，並在數位發展部承接後完成對接國際 WCAG 2.1 AA 標準之技術體系整備考驗4。這一歷程確立了無障礙設計不再是邊緣性的修補功能，而是現代全端網頁架構中的核心品質指標11。  
面對高度複雜的前端應用生態與跨載具瀏覽情境，達成檢測等級AA之認證要求，仰賴的是工程思維的根本轉變。開發團隊必須深刻體認，單純依賴 FreeGo 等自動化爬蟲檢測，僅能涵蓋約兩成至三成之語法層次條文，其餘七成以上攸關鍵盤邏輯、認知傳達、行動手勢與動態狀態更新之準則，皆必須透過人工檢驗與語意化重構方能落實2。從專案初期的使用者介面（UI/UX）設計系統建立色彩對比基線，到前端元件庫實作中落實原生 HTML 語意標記與 ARIA 規格，再到標章取得後的三年週期監控與不定期抽檢維護，唯有將 POUR 四大原則融入軟體開發生命週期（SDLC）之各個節點，方能真正消弭數位落差，建構兼具技術穩健度與普惠包容性的數位公共環境11。

#### **Works cited**

> 1. 文章列表 \- 政府網站營運交流平台, [https://www.webguide.nat.gov.tw/article?page=24](https://www.webguide.nat.gov.tw/article?page=24)  
> 2. Freego 檢測相容性| Jedi's BLOG, [https://jedi.org/blog/archives/006437.html](https://jedi.org/blog/archives/006437.html)  
> 3. 106年無障礙通訊傳播近用環境推動報告, [https://api.ncc.gov.tw/chncc/app/data/doc?id=358\&module=commonMessage358\&detailNo=1\&serno=40053\_2647\_news\&type=s\&preview=undefined\&aplistdn=undefined](https://api.ncc.gov.tw/chncc/app/data/doc?id=358&module=commonMessage358&detailNo=1&serno=40053_2647_news&type=s&preview=undefined&aplistdn=undefined)  
> 4. 活動資訊- 課程 \- 無障礙網路空間服務網- 數位發展部, [https://accessibilitydev.moda.gov.tw/Lessons/Detail/81](https://accessibilitydev.moda.gov.tw/Lessons/Detail/81)  
> 5. 無障礙通訊傳播近用環境行動方案, [https://api.ncc.gov.tw/chncc/app/data/doc?id=358\&module=commonMessage358\&detailNo=1\&serno=40052\_2647\_news\&type=s\&preview=undefined\&aplistdn=undefined](https://api.ncc.gov.tw/chncc/app/data/doc?id=358&module=commonMessage358&detailNo=1&serno=40052_2647_news&type=s&preview=undefined&aplistdn=undefined)  
> 6. 行動化應用軟體無障礙檢測指引 \- 數位發展部主管法規共用系統, [https://law.moda.gov.tw/LawContent.aspx?id=FL096186](https://law.moda.gov.tw/LawContent.aspx?id=FL096186)  
> 7. 無障礙網頁 \- 網站設計, [https://design.fanseo.com/html/solution/web\_accessibility.html](https://design.fanseo.com/html/solution/web_accessibility.html)  
> 8. 110 年身心障礙者數位發展現況與需求調查報告中文摘要(一一 年八月), [https://www-api.moda.gov.tw/File/Get/moda/zh-tw/Nni5yo7KNerLXn8](https://www-api.moda.gov.tw/File/Get/moda/zh-tw/Nni5yo7KNerLXn8)  
> 9. 什麼是WCAG？台灣網站無障礙規範入門 \- Accesserty, [https://accesserty.com/glossary/wcag/](https://accesserty.com/glossary/wcag/)  
> 10. WCAG,無障礙,申請 \- MoodleTW, [https://www.moodle.tw/zh-hant/node/54](https://www.moodle.tw/zh-hant/node/54)  
> 11. 無障礙標章申請全攻略：免費檢測× 5 步驟流程× Freego 操作教學, [https://www.jknpo.tw/blog/accessibility-design-guide/](https://www.jknpo.tw/blog/accessibility-design-guide/)  
> 12. 全網站無障礙網頁檢測報告, [https://iic.nutn.edu.tw/a.htm](https://iic.nutn.edu.tw/a.htm)  
> 13. 普及與深化政府網站與行動化應用軟體無障礙設計行動方案(核定本, [https://ws.dgbas.gov.tw/Download.ashx?u=LzAwMS9VcGxvYWQvNDYxL3JlbGZpbGUvMTE0NzMvMjM0MDExL%2BihjOaUv%2BmZouaguOWumuacrC5wZGY%3D\&n=6KGM5pS%2F6Zmi5qC45a6a5pysLnBkZg%3D%3D](https://ws.dgbas.gov.tw/Download.ashx?u=LzAwMS9VcGxvYWQvNDYxL3JlbGZpbGUvMTE0NzMvMjM0MDExL%2BihjOaUv%2BmZouaguOWumuacrC5wZGY%3D&n=6KGM5pS/6Zmi5qC45a6a5pysLnBkZg%3D%3D)  
> 14. 網站無障礙規範, [https://ncclaw.ncc.gov.tw/Download.ashx?pfid=0000288327](https://ncclaw.ncc.gov.tw/Download.ashx?pfid=0000288327)  
> 15. 無障礙網站是什麼？WCAG 2.2、標章申請與中小企業15 項檢查 \- 秒站, [https://site-now.app/accessible-website-guide/](https://site-now.app/accessible-website-guide/)  
> 16. 【 無障礙網頁設計原則】3種等級, [https://accessibility.bestservice.com.tw/news/more-3.shtml](https://accessibility.bestservice.com.tw/news/more-3.shtml)  
> 17. 行政院公報第032卷第097期20260529 教育科技文化篇, [https://gazette.nat.gov.tw/EG\_FileManager/eguploadpub/eg032097/ch05/type2/gov87/num11/Eg.pdf](https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg032097/ch05/type2/gov87/num11/Eg.pdf)  
> 18. 網站無障礙規範：設計準則 \- 奧圖數位互動科技, [https://www.auto-aiot.com/news/posts/web-a11y-2](https://www.auto-aiot.com/news/posts/web-a11y-2)  
> 19. 無障礙標章申請流程說明 \- 資訊處- 聯合大學, [https://ccenter.nuu.edu.tw/p/405-1007-67668,c7113.php](https://ccenter.nuu.edu.tw/p/405-1007-67668,c7113.php)  
> 20. Day 13：\`outline: none\` 我一行都沒寫，焦點還是有兩個地方看不見, [https://ithelp.ithome.com.tw/articles/10405806?sc=rss.qu](https://ithelp.ithome.com.tw/articles/10405806?sc=rss.qu)  
> 21. 03-Freego軟體檢測工具11211 \- Scribd, [https://www.scribd.com/document/727624073/03-Freego%E8%BB%9F%E9%AB%94%E6%AA%A2%E6%B8%AC%E5%B7%A5%E5%85%B7-11211](https://www.scribd.com/document/727624073/03-Freego%E8%BB%9F%E9%AB%94%E6%AA%A2%E6%B8%AC%E5%B7%A5%E5%85%B7-11211)  
> 22. 學校無障礙網頁規範懶人包，從AA 等級到標章申請一次整理, [https://schoolaa.net/2026/04/27/%E5%AD%B8%E6%A0%A1%E7%84%A1%E9%9A%9C%E7%A4%99%E7%B6%B2%E9%A0%81%E8%A6%8F%E7%AF%84%E6%87%B6%E4%BA%BA%E5%8C%85%EF%BC%8C%E5%BE%9E-aa-%E7%AD%89%E7%B4%9A%E5%88%B0%E6%A8%99%E7%AB%A0%E7%94%B3%E8%AB%8B/](https://schoolaa.net/2026/04/27/%E5%AD%B8%E6%A0%A1%E7%84%A1%E9%9A%9C%E7%A4%99%E7%B6%B2%E9%A0%81%E8%A6%8F%E7%AF%84%E6%87%B6%E4%BA%BA%E5%8C%85%EF%BC%8C%E5%BE%9E-aa-%E7%AD%89%E7%B4%9A%E5%88%B0%E6%A8%99%E7%AB%A0%E7%94%B3%E8%AB%8B/)  
> 23. 無障礙標章與WCAG \- MoodleTW, [https://www.moodle.tw/zh-hant/moodle/WCAG](https://www.moodle.tw/zh-hant/moodle/WCAG)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAZCAYAAAB6v90+AAAB4klEQVR4Xu2WzysGQRzGv5IioijFxSopSZFfUW5SDkpJKWclB+JA/A/+AQ5yUO5KcnBRclIclfyIC8UF5SCep9nJvtPs+86wuMynPvXuzOzuPLvfmXdFAoHAf1AFN2Cb2WGBY8ZhLSyCFXAATiYHZUwEJ8zGQnByy/AFdhp9NniDD8Mb2J4clAEtcAYewHe4mdtdmF74KO7BRuBF7DGcg5U5I7KBwUZhP7wVz2AswXW4Jn7BlszGX6QOXotHMJbgAhwTNdG/CFYqak364B2sB67CEvEPxpvsiSrHSzgFi5ODLNTAU/gEO4y+fHgFYwmy/KL42DcYF3R1fNwkag0siqqCNPim9uEDbDX68uEcjDefF7Vla3yCsZyohtfbEhWuMdFug2+VFeKDczCWgS5BjU8wG7wpt/1hsyMDnINNi/rfSfosamL38FDUn6+NZngHd2BZol0HY5lmjXMwG2lvjGuxXr7WDvs5LhlMl6LtfBPzei78KNgKfIXdiTa9i73BvriNE2OIKD4m/M3dkZtRvvVju54LOhjv6/xABkWVn/404qfLkahS5C62C89hgz4BdMETUQ9jFl7BbVGh85F2vTQ4N25InJOeH5fMmbh9036Lcjgk6pMnEo8nGQgEAoHAD/gE9HBs24BcxXoAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAWCAYAAABOm/V6AAABK0lEQVR4Xu2UPS8FQRSGj4hE4itCKzohkSB6uZ1oNBR6BR2i0FIqNEoVEYk/oJfo+AloFDoREo3Ex/NmzgSTu/fG3d1b7ZM82Zkzs5mzZ2bWrKIim37cwCPcwzHs+DOjZKbwEms4iGv4jtvWxkQO8QMXva9EbvAJJ+KksjnAL1z1fh9e4auFKrWFLhzGTu9P4rOFLer1WBZ6R5UrdNt0QM/wAaeTsXrEKur85KYHzy0sfo/z9lOZRmjxT1xPB/Iyjo94aiG5ZnSngSLQ/mpLVObCv7AeOpRbrtqRHQtJnPyKlcYsvrlqR7S4ktA/pBFKfNSfLTOCt3iMAx4bwmsL13TGY1nE27GbxP/NAt7hPq7gBb54vBmbFn7xS+lAK+iE13AZ5yxneSsq8vAN+5outY+zCEkAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAAA9UlEQVR4XmNgGAX0Bo5A/BqI/yPhX0C8G4iFkdSRDeYA8T8g9kCXoAQIAvFpIH4AxNKoUpQBTSB+C8RrgJgFTY4iEM0ACdtydAlKwSQg/g3ENugSlABY+N4FYnE0OYoAofBlA2JWJD43ECcBsQCSGFYAC98idAkgYATiJiDWYYCk6eVAvBmIrwGxJJI6rACUfnGFrwoQzwViTiQxYyC+wEDAYHzpF+T9WQwQHyEDogwGKfrKgBm+IE0gQx8BsSKSOAjgNdgFiJ8xIMqGv0D8BIpBbJg4KEzRIxSvwZSAoWMwBxCXAvF2BkgqAsWLJ4qKUTAKMAAAWDY0W7tgOzgAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAZCAYAAAAv3j5gAAABhUlEQVR4Xu2UPyhFYRTAj1CUSAb5U2IgmxKlZLIYSJiwyqgsSplkMVqUpEwiK70yMBiUyYAyyWKyMaDwO879ru/e977Xyyb3V7/uveeee859953vE8n4S1TjNG7hOnYlbxelFhfEnl3BpuTtH+rwBFexBnvwBif9pABteIVzWIUjeIf9fpJjCS+x3ovN4C02erE0FbiNh9G5Yw1zYl8pRotrk10/CH34jGOpuE8HPoq9qM8EvmCvH+zGJ8lvpEmarG8XYhg/JL/RKH6KfZUYVzDUKB33cQVDjRJxF0wXLKWRFsorKIFGOiW/bbQoBQpKoFGoYCjuU7BgKO4mJ13QNVpOxX0G8V3CjXT6YnSBnuGR2IJz6ES9RUeHLuxmLIuuW/AeN1xCxLzYJOtEJ5jFB2yPrrWQ7hIXYsWVBrEd4BUHiuRV4gHuSXIRf6M3N/EUx8Uevhbbihz6y4/FthfddhzaQOP7YoO1g+fY6uUk0LfrxCkcEmteKuVi/6k+q0e9zsj4L3wBkg5VmIuJstYAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAZCAYAAAAv3j5gAAABQUlEQVR4Xu2UvUvDUBRHr6hQQerg5Acobh2cBEFx7OJQEHEQnEVwEVycnMR/wFFEcBBRnEunTh266uikIHTqpoOIH+f63kuT18Q2kEXMgUOam8v9NZB3RXL+IrO46Rd7UMQ9PMVDnIg+7lDCXazjB15EH//KDN7hNhZwFR9wMdzk0KA1XMZn6T9oCM/w1v52HGMNR0K1CPrKT9J/0By28MCrr+MrLnj1gLRBZfyU7qAKfuGWVw9IG+QGJgX59YC0QToobmDmQfsSPzDzoKSBSfWAtEEr+C7dA12Qfn2x9Aoaw0kcsPdT+IgnrsGyg20x5zMWF3QpnWGOcTEb4A2XbE17jrAp5k8ow3iDVxI9xD/oedCNoOtHX1l9wXuctz2jWBWzXnTtODRA69di1s85NnA61JMZg2K2wIa96n1Ozn/hG2QmRuMzjv3UAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABMklEQVR4XmNgGAX0Bo5A/BqI/yPhX0C8G4iFkdSRDeYA8T8g9kCXoAQIAvFpIH4AxNKoUpQBTSB+C8RrgJgFTY4iEM0ACdtydAlKwSQg/g3ENugSlABY+N4FYnE0OYoAofBlA2JWKFsGiFuBeBoQ2wExI0wRNgAL3yJ0CQaIxiYg1mGAGFoPxJxArArEt4A4CqEUE4DSL67wVQHiuQwQw3yB+BMQ60PlQC7fA8TcUD4KwJd+Qd6fxQDxEQiADLCGioMAKMK3AjEHlI8CjIH4KwNm+EoyQAx9BMSKSOIwIAvEV4DYD13CBYifMSDKhr9A/ASKQWyY+HIGzAgFuXgCEIcyEIg8UgDI0CogdoLyQZGIbjHJAOS6bAZIJIKCSh2IK6HiFAEHBtRgAmGQ60fBKMADAMKPOLgDNpUvAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAZCAYAAABdEVzWAAAA6UlEQVR4XmNgGAWjgP5AAYgj0AVpAAyB2A1dEB1oAnEWEO8D4r9AvBBVmmrAHIjLgPg0EP8H4nJUaUwAclgAEFsB8RMG2jrMF4i9gPgrAxEOgwFJIH7IQDuHwYAxAx0cxgzEgkDMiC6BB9DFYb0MkPRSjC6BB9DFYSAH/QPiDHQJPIAuDgMBDnQBAoBuDiMVjGyHsQKxPJQmFpDtsKUMxGd/WK5sQBPHB2AOq0KXQAcuDJASH1QdgSwB4S9AfAmIdZHUYQMFQPwLiIPRJbAAUM59xoCwA4TfAfFhIBZDUjcKRsEoGAVDHgAAR0s8YAJmlSAAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAZCAYAAAB3oa15AAABj0lEQVR4Xu2VvytGYRTHj1BEGRQpA1IyGYSFMimDxWCWxcw7iJL8A8omq8VgsBjEX2BTykx+ZDEoNvE977nPvc899V7Pue/dPJ/69L7vPc9zzvPc573nEkUiEccA3IXHcB+O5sM5WuEKHFLXqya4zjS8gnNwAl7AH1iDLcmYTrgED+Ez/ISTSaxKzHV4wjlcI9kx0wtvKD+Zxy3CebinYlVirsN/nQf4QXL3HTskp7DpXXNsUUDiCgiq005yXJckm3HwZN4Af2qCEiu6YYe++Adl6tRpg2fwm+QoNdbEY/AN3sNBFSvCWidlhmQidyQ+IY01MS+aF38H+1SsCGudOj3wGp7ALhVzlEnMp8paMNfhu30ED0i6QSPMiUtiquMWv01ZOx2HC+mIDFPiJgiuwy+rGtxIvjvW4bL32xGc2KOf5P1iIagOL3gVfsEn+Oj5DmfTkRmcmMdP6UADXBfi/MMqVkRQHfci456vfYUjyTh+oE9JNuWPeSF5ZorgLnRL0hy4SRTRTJ1IJBKJ/DN+Acm8YwWsx2UAAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEMAAAAWCAYAAACbiSE3AAACRklEQVR4Xu2XTUgVURiG39BSsR8jSATBu5BoERFEBq0qaCHkD2TkqqAg3AUtwiAicKOV4iIRKtAEURcuWrQQAoU2BREuXAUujHRXrYwoot6XM+PMnc69zbnO5A3ngYd775wzM+d8c75vzgUyMjIyypNOej960EI1vUyPeN8raCO9TnNBt/Q4Q1/Tbroz0pYEObpMn0WO26ijb+iviA+Rztis1NCrdJFeo7X5zSWjCTyFmVCcYOymL+gSTADH6Um6I9Tnn6HBa4W8pXfo3vxmZy7SQfoR8YOhfg3Rhq1EuXqWvqIP6IH85ljk6GN6mK4g/WBo9eyHGXsq6AZapvP0EeIPUitMea5zdY5LMGboEEyqrNLniFc8ld5Kx1FaGWlLlCp6F2a5N0fabFygN2GC6RqMOXoJ5lzZR9/TplA/G+30Jx1GSjUmXFhvIF5h1aCf0H3eb5dgaBJ7vE+fE/QrvRc6VohdSCEQmrQm/w5ur1wtz36Y9PBxCYaN43SdvkS8h5EYenvoLaJ9Rwfci9FBmKL7IeQaTC5/9373bPT+kwH6g54LHfODsQCTRqmjp6cCqUJ5Cu5BKEahlaF75GB2mj7qo7wPB8NPkzEUTwHb9Zw5D1Oxj6L4zUpF22kV3knkX9+v/lMIqr9SshdBP33epl9oi3esELbrlQ3K72mY9PC31Z8RpEkb/UZvIZi8atMInaVX6AT9RFu99mLYrvffo4kcol30NDa57F3R06iHye2/qQKZZD0pO47BbJvjqP8ZCkpGxjbhN2fna9WBDzN+AAAAAElFTkSuQmCC>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAWCAYAAACPHL/WAAABuUlEQVR4Xu2WvysGcRzHP0KIUESKUCSLlKRspBgUKaWY+AMMBotsMmAg0SOLidUqpVgMEqXMZEFYMOL97nvfnrvLc7/vGO5Vr576fu567nPf+7zvRFJSUv4rebAHbsAtOA5LLUfESB88hxOw0FYLQgFch0uwHrbCU3gDG03HxUoJnIZXcEbC3c12+AKPYJmxNgm/Re1YonCHuFMXcAGWW8ueaIOP8BpWGWtjohra1QclTT7sh2dwRbIX5pVKye4O52kTfolqzA2eV2xfjAo93CeiLqrOWnaF5w/CV7gq7jOqd/dW1PzFRhFchA+wxVbLxQC8h08wA6ut5V9hE2yGAVJjq0WCOSxmJVhY8PFdhm+imnSDKUkjhRfOBi4lmjjvhp8S453PBVON6cb30oiou+uXDlHxzF8NZ+8OfsAu03ps8A859Bz+XgnWiGZPVETzV8Mm2AzfT3xPOVEr/lPVwjA8FHVHmUphmYfPcMi0NiWqyW1xng+dcgyfZlvtz6iA+/BY1FfHHHyHB0bNCaYcX8g81+3YROFON8FRwwZLNWaYYHxuOUduMqHCzFcidMIdj66J/6+FlBSDH23nSCDe8mfvAAAAAElFTkSuQmCC>