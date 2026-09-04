# Docs 知識庫導覽與星系架構 (MOC)

本文件為 `docs/` 知識庫的核心總索引與地圖（Map of Content）。整座知識庫環繞著 **oingg.com / ifa.rocks** 退休投資 SaaS 平台展開，涵蓋「投資與財務分析」、「產品與儀表板架構」、「UI/UX 無障礙與視覺工程」、「商業模式與法規合規」四大知識星系。

在 Obsidian 中按 `Ctrl + G` 開啟關聯圖譜，即可看見各研究報告透過雙向連結交織而成的知識網絡。

---

## 📂 知識庫雙層結構 (Two-Tier Structure)

整座知識庫採用現代個人知識管理（PKM / Zettelkasten）的雙層拓撲結構：

1. **`1 researches/`（原創研究文庫）**：
   收錄 27 篇深入探討各項專案課題的原創長篇研究報告、法規論證與競品分析。
2. **`2 knowledge/`（常青原子知識庫）**：
   自研究文庫中提煉出 **46 篇原子化知識點（Evergreen Notes）**，分為 8 大核心領域，每篇筆記專注於單一核心概念與數理模型，具備高度密集的雙向互聯性。詳細導覽請參閱：[[2 knowledge/README|核心知識庫導覽地圖 (Knowledge MOC)]]。

---

## 🌌 四大知識星系與跨領域關聯網絡

- **群集一：投資哲學與資產防衛 (Investment & Wealth Preservation)**
  - 核心知識點：[[序列報酬風險 (Sequence of Returns Risk)]]、[[三水桶資產配置策略 (Three-Bucket Strategy)]]、[[債券帳篷與上升型股票滑動路徑 (Bond Tent)]]、[[Guyton-Klinger 動態提領護欄模型]]、[[台灣三層年金與在地化安全提領率]]、[[台灣證券稅制與所得分離最佳化]]、[[總報酬提領 vs 高股息現金流]]
- **群集二：產品策略與儀表板架構 (Product Architecture & Screener Presets)**
  - 核心知識點：[[雙軌自適應儀表板架構 (Adaptive Dual-Track)]]、[[選股 Preset 分類矩陣與付費分層]]、[[金融數據降噪哲學 (Noise Elimination)]]、[[多維視覺冗餘編碼 (Visual Redundancy)]]
- **群集三：UI/UX 無障礙與視覺工程 (Accessibility & Visual Design)**
  - 核心知識點：[[適度對比與光暈防護 (Tempered Contrast)]]、[[Material 深色高度受光與文字透明度模型]]、[[無障礙色彩空間與對比度演算法 (WCAG vs APCA)]]、[[高齡友善排版與觸控熱區規範]]、[[8pt 軟網格與 4pt 垂直基線系統]]、[[Windows 強制色彩模式防禦技術]]
- **群集四：商業化模式與法規安全港 (SaaS Monetization & Compliance)**
  - 核心知識點：[[反向試用模式 (Reverse Trial)]]、[[SaaS 價值指標與混合計費架構]]、[[Merchant of Record (MoR) 跨境金流選型]]、[[ASC 606 遞延收入與點數沉澱會計]]、[[投顧法第 4 條安全港與釋字 634 號邊界]]、[[Robo-Advisor 自動化投顧法規紅線]]、[[台灣無障礙標章與雙軌檢驗機制]]

### 關鍵跨界星軌（Cross-Cluster Bridges）
- **三水桶策略軌道**：[[三水桶資產配置策略 (Three-Bucket Strategy)]] ↔ [[序列報酬風險 (Sequence of Returns Risk)]] ↔ [[雙軌自適應儀表板架構 (Adaptive Dual-Track)]] ↔ [[投顧法第 4 條安全港與釋字 634 號邊界]]
- **選股指標與品質濾網軌道**：[[ROIC-WACC 價值創造模型]] ↔ [[Piotroski F-Score 評分模型]] ↔ [[Altman Z-Score 破產預警模型]] ↔ [[選股 Preset 分類矩陣與付費分層]] ↔ [[金融數據降噪哲學 (Noise Elimination)]]
- **高齡無障礙體驗軌道**：[[適度對比與光暈防護 (Tempered Contrast)]] ↔ [[Material 深色高度受光與文字透明度模型]] ↔ [[多維視覺冗餘編碼 (Visual Redundancy)]] ↔ [[高齡友善排版與觸控熱區規範]] ↔ [[雙軌自適應儀表板架構 (Adaptive Dual-Track)]]
- **SaaS 增長與變現軌道**：[[反向試用模式 (Reverse Trial)]] ↔ [[SaaS 價值指標與混合計費架構]] ↔ [[選股 Preset 分類矩陣與付費分層]] ↔ [[SEO 友善 URL 拓撲與多面向導覽治理]] ↔ [[金融 YMYL 內容與 E-E-A-T 信任架構]]

---

## 📚 原創研究文庫分類索引 (`1 researches/`)

### UI/UX 設計與無障礙
- [[1 researches/Dark-Mode Homepage Design Guide |Dark-Mode Homepage Design Guide ]] — 深色模式首頁設計指南（面向退休/資深投資族群）
- [[1 researches/accessibility-guidelines|accessibility-guidelines]] — UI/UX 無障礙設計規範（16px 字級下限等，本專案引用最多的文件）
- [[1 researches/Taiwan Web Accessibility Guidelines|Taiwan Web Accessibility Guidelines]] — 台灣官方網站無障礙規範（NCC/數發部 WCAG 2.1 AA 標章制度、POUR 四大原則、申請流程與常見不合規缺失）
- [[1 researches/網站無障礙背景色彩架構與視覺感知工程研究報告|網站無障礙背景色彩架構與視覺感知工程研究報告]] — 背景色專論:「適度對比」(Tempered Contrast,避免純黑純白造成眩光)、Material Design 深色模式高度模型(87/60/38% 文字不透明度)、forced-colors 防禦寫法、APCA 對比演算法比較
- [[1 researches/無障礙網站色彩規範|無障礙網站色彩規範]] — 色彩對比度公式與門檻（1.4.3/1.4.11/APCA）、色彩不得為唯一資訊管道（1.4.1）+多維度視覺編碼替代方案、色覺障礙類型與禁忌配色組合、Okabe-Ito/IBM 色盲安全調色盤色碼
- [[1 researches/網格排版美學與實踐|網格排版美學與實踐]] — 網格排版系統美學與 8pt/4pt 間距 token 規範
- [[1 researches/色盲友善股票介面設計|色盲友善股票介面設計]] — 色盲友善的漲跌色彩與多維視覺編碼設計

### SEO 策略
- [[1 researches/SEO 友善網址設計指南|SEO 友善網址設計指南]] — URL 架構設計與 SEO 治理
- [[1 researches/存股 SaaS 首頁 SEO 策略|存股 SaaS 首頁 SEO 策略]] — 存股型 SaaS 首頁的 SEO 架構與主題權威性策略

### 產品功能設計
- [[1 researches/oingg.com 台股選股 Preset 設計研究報告|oingg.com 台股選股 Preset 設計研究報告]] — 選股 Preset 功能設計研究：建議 18–22 個 preset 分類方式、台股籌碼面差異化因子、免費/付費分層與轉化漏斗設計
- [[1 researches/退休導向產品是否應納入券資比融資融券資料研究報告|退休導向產品是否應納入券資比融資融券資料研究報告]] — go/no-go 功能評估：個股層級券資比/融資融券不建議放進存股核心決策介面；大盤層級融資槓桿水位可作為市場脆弱度風險背景參考低調納入
- [[1 researches/退休投資儀表板偏好比較|退休投資儀表板偏好比較]] — 退休族小白 vs 專家投資人的儀表板資訊偏好研究，主張「雙軌自適應架構」而非單一版面

### 工程規範
- [[1 researches/components-naming-convention|components-naming-convention]] — Components 命名與組織規範

### 投資與財務知識庫
- [[1 researches/ETF Selection Guidelines|ETF Selection Guidelines]] — ETF 篩選與配置評估
- [[1 researches/KY Stock Fundamental Analysis|KY Stock Fundamental Analysis]] — KY 股財報基本面檢驗架構
- [[1 researches/Retiree Securities Investment Guide|Retiree Securities Investment Guide]] — 台灣退休世代證券投資策略（三水桶策略、稅制/二代健保、官股金融股、高配息 ETF）
- [[1 researches/退休投資總經指南|退休投資總經指南]] — 退休投資人總體經濟分析框架（通膨/CPI-E、利率週期、序列報酬風險、景氣循環資產輪動、全天候配置、跨國匯率風險）
- [[1 researches/總經與個股基本面分析|總經與個股基本面分析]] — 總經指標到個股財報的微觀傳導機制（利率/PPI-CPI剪刀差/匯率如何具體影響損益表與資產負債表）、美林投資時鐘產業輪動、戴維斯雙擊/雙殺效應
- [[1 researches/基本面財報觀察年限分析|基本面財報觀察年限分析]] — 財務數據回溯年限與動態評估架構
- [[1 researches/特別股評價注意事項|特別股評價注意事項]] — 特別股價值評估實務與注意事項
- [[1 researches/興櫃股票投資注意事項|興櫃股票投資注意事項]] — 興櫃股票市場投資機制與風險
- [[1 researches/財務諸表の主要投資指標ガイド|財務諸表の主要投資指標ガイド]] — ROIC/WACC、Piotroski F-Score、Altman Z-Score 等進階投資指標

### 商業模式與營收策略
- [[1 researches/ToC SaaS 單次付費研究|ToC SaaS 單次付費研究]] — 點數制/單次解鎖/買斷制等付費模式比較、MoR 金流平台選型（Stripe/Paddle/Lemon Squeezy）、ASC 606 遞延收入會計處理
- [[1 researches/高付費價值網站功能研究|高付費價值網站功能研究]] — B2B/Prosumer 高付費意願功能盤點（SSO/合規、進階分析、API）、Good-Better-Best 分層框架、Kano 模型、Van Westendorp 價格敏感度測試
- [[1 researches/Retirement Investment Monetization Features|Retirement Investment Monetization Features]] — 退休投資導向產品的高付費功能特性與定價策略

### 競品研究
- [[1 researches/財報狗與 CMoney 產業專區比較|財報狗與 CMoney 產業專區比較]] — 財報狗與 CMoney 產業專區架構比較、各自的分析盲點與複合式研究流程建議

### 法規遵循
- [[1 researches/為 ifa.rocks 與 oingg.com 打造 Bucket 工具與選股平台：方法論與台灣法規遵循研究報告|為 ifa.rocks 與 oingg.com 打造 Bucket 工具與選股平台：方法論與台灣法規遵循研究報告]] — 證券投資顧問法第4條四要件、釋字第634號「一般性證券投資資訊」安全區、投信投顧公會問答集對「程式自動分析個股」的官方見解、Robo-Advisor 作業要點門檻
