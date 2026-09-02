# Docs 分類索引

`docs/` 底下的研究報告與規範文件已依主題搬進對應子資料夾。搬動時同步更新了 `app/` 下所有以 `docs/<檔名>.md` 相對路徑引用這些文件的元件/composable 註解（例如 `accessibility-guidelines.md` 被十幾個元件引用），確保路徑不會失效。（`oingg-conductor-ts` repo 自己 docs 目錄下的同名文件——`EmergingMarketStockCard.vue`、`PreferredStockCard.vue` 兩處引用的 `oingg-conductor-ts/docs/...`——是另一個 repo 的檔案，不受此次搬動影響，也不歸這份索引管。）

## UI/UX 設計與無障礙 → `ui-ux/`

- [Dark-Mode Homepage Design Guide .md](ui-ux/Dark-Mode%20Homepage%20Design%20Guide%20.md) — 深色模式首頁設計指南（面向退休/資深投資族群）
- [accessibility-guidelines.md](ui-ux/accessibility-guidelines.md) — UI/UX 無障礙設計規範（16px 字級下限等，本專案引用最多的文件）
- [Taiwan Web Accessibility Guidelines.md](ui-ux/Taiwan%20Web%20Accessibility%20Guidelines.md) — 台灣官方網站無障礙規範（NCC/數發部 WCAG 2.1 AA 標章制度、POUR 四大原則、申請流程與常見不合規缺失），與上面 accessibility-guidelines.md（本專案內部設計規範）互補
- [無障礙網站色彩規範.md](ui-ux/無障礙網站色彩規範.md) — 色彩對比度公式與門檻（1.4.3/1.4.11/APCA）、色彩不得為唯一資訊管道（1.4.1）+多維度視覺編碼替代方案、色覺障礙類型與禁忌配色組合、Okabe-Ito/IBM 色盲安全調色盤色碼——聚焦色彩系統本身，補足上面兩份文件較少著墨的對比度數學與調色盤工程
- [網格排版美學與實踐.md](ui-ux/網格排版美學與實踐.md) — 網格排版系統美學與 8pt/4pt 間距 token 規範
- [色盲友善股票介面設計.md](ui-ux/色盲友善股票介面設計.md) — 色盲友善的漲跌色彩與多維視覺編碼設計

## SEO 策略 → `seo/`

- [SEO 友善網址設計指南.md](seo/SEO%20友善網址設計指南.md) — URL 架構設計與 SEO 治理
- [存股 SaaS 首頁 SEO 策略.md](seo/存股%20SaaS%20首頁%20SEO%20策略.md) — 存股型 SaaS 首頁的 SEO 架構與主題權威性策略

## 產品功能設計 → `product-design/`

- [oingg.com 台股選股 Preset 設計研究報告.md](product-design/oingg.com%20台股選股%20Preset%20設計研究報告.md) — 選股 Preset 功能設計研究：建議 18–22 個 preset 分類方式、台股籌碼面差異化因子、免費/付費分層與轉化漏斗設計（橫跨產品設計＋付費牆策略，但核心是這個功能本身的規格，故獨立於「商業模式」分類之外）

## 工程規範 → `engineering/`

- [components-naming-convention.md](engineering/components-naming-convention.md) — Components 命名與組織規範

## 投資與財務知識庫 → `investment-knowledge/`

產品內容/決策邏輯的研究素材，多數對應到個股頁、專區頁（KY股、興櫃、特別股、ETF）的資訊架構與文案依據。

- [ETF Selection Guidelines.md](investment-knowledge/ETF%20Selection%20Guidelines.md) — ETF 篩選與配置評估
- [KY Stock Fundamental Analysis.md](investment-knowledge/KY%20Stock%20Fundamental%20Analysis.md) — KY 股財報基本面檢驗架構
- [Retiree Securities Investment Guide.md](investment-knowledge/Retiree%20Securities%20Investment%20Guide.md) — 台灣退休世代證券投資策略（三水桶策略、稅制/二代健保）
- [退休投資總經指南.md](investment-knowledge/退休投資總經指南.md) — 退休投資人總體經濟分析框架（通膨/CPI-E、利率週期、序列報酬風險、景氣循環資產輪動、全天候配置、跨國匯率風險）——聚焦總體經濟變數而非個股/商品選擇，與上一份互補
- [總經與個股基本面分析.md](investment-knowledge/總經與個股基本面分析.md) — 總經指標到個股財報的微觀傳導機制（利率/PPI-CPI剪刀差/匯率如何具體影響損益表與資產負債表）、美林投資時鐘產業輪動、戴維斯雙擊/雙殺效應——把上面的總經框架和基本面回溯分析（下方）串起來的傳導層
- [基本面財報觀察年限分析.md](investment-knowledge/基本面財報觀察年限分析.md) — 財務數據回溯年限與動態評估架構
- [特別股評價注意事項.md](investment-knowledge/特別股評價注意事項.md) — 特別股價值評估實務與注意事項
- [興櫃股票投資注意事項.md](investment-knowledge/興櫃股票投資注意事項.md) — 興櫃股票市場投資機制與風險
- [財務諸表の主要投資指標ガイド.md](investment-knowledge/財務諸表の主要投資指標ガイド.md) — ROIC/WACC、Piotroski F-Score、Altman Z-Score 等進階投資指標

## 商業模式與營收策略 → `monetization/`

- [ToC SaaS 單次付費研究.md](monetization/ToC%20SaaS%20單次付費研究.md) — 點數制/單次解鎖/買斷制等付費模式比較、MoR 金流平台選型（Stripe/Paddle/Lemon Squeezy）、ASC 606 遞延收入會計處理
- [高付費價值網站功能研究.md](monetization/高付費價值網站功能研究.md) — B2B/Prosumer 高付費意願功能盤點（SSO/合規、進階分析、API）、Good-Better-Best 分層框架、Kano 模型、Van Westendorp 價格敏感度測試

## 競品研究 → `competitive-research/`

- [財報狗與 CMoney 產業專區比較.md](competitive-research/財報狗與%20CMoney%20產業專區比較.md) — 財報狗與 CMoney 產業專區架構比較、各自的分析盲點（歷史數據滯後、次產業分類粗糙、法人預估線性外推偏誤）與複合式研究流程建議
