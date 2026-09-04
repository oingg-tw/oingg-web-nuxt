# Docs 分類索引

`docs/` 底下的研究報告與規範文件已依主題搬進對應子資料夾。搬動時同步更新了 `app/` 下所有以 `docs/<檔名>.md` 相對路徑引用這些文件的元件/composable 註解（例如 `accessibility-guidelines.md` 被十幾個元件引用），確保路徑不會失效。（`oingg-conductor-ts` repo 自己 docs 目錄下的同名文件——`EmergingMarketStockCard.vue`、`PreferredStockCard.vue` 兩處引用的 `oingg-conductor-ts/docs/...`——是另一個 repo 的檔案，不受此次搬動影響，也不歸這份索引管。）

## UI/UX 設計與無障礙 → `ui-ux/`

- [Dark-Mode Homepage Design Guide .md](ui-ux/Dark-Mode%20Homepage%20Design%20Guide%20.md) — 深色模式首頁設計指南（面向退休/資深投資族群）
- [accessibility-guidelines.md](ui-ux/accessibility-guidelines.md) — UI/UX 無障礙設計規範（16px 字級下限等，本專案引用最多的文件）
- [Taiwan Web Accessibility Guidelines.md](ui-ux/Taiwan%20Web%20Accessibility%20Guidelines.md) — 台灣官方網站無障礙規範（NCC/數發部 WCAG 2.1 AA 標章制度、POUR 四大原則、申請流程與常見不合規缺失），與上面 accessibility-guidelines.md（本專案內部設計規範）互補
- [網站無障礙背景色彩架構與視覺感知工程研究報告.md](ui-ux/網站無障礙背景色彩架構與視覺感知工程研究報告.md) — 背景色專論:「適度對比」(Tempered Contrast,避免純黑純白造成眩光)、Material Design 深色模式高度模型(87/60/38% 文字不透明度)、forced-colors(Windows 高對比模式)防禦寫法、APCA 對比演算法比較——跟上面「無障礙網站色彩規範.md」互補(那份講前景/文字對比與色盲調色盤,這份聚焦背景本身的工程策略)
- [無障礙網站色彩規範.md](ui-ux/無障礙網站色彩規範.md) — 色彩對比度公式與門檻（1.4.3/1.4.11/APCA）、色彩不得為唯一資訊管道（1.4.1）+多維度視覺編碼替代方案、色覺障礙類型與禁忌配色組合、Okabe-Ito/IBM 色盲安全調色盤色碼——聚焦色彩系統本身，補足上面兩份文件較少著墨的對比度數學與調色盤工程
- [網格排版美學與實踐.md](ui-ux/網格排版美學與實踐.md) — 網格排版系統美學與 8pt/4pt 間距 token 規範
- [色盲友善股票介面設計.md](ui-ux/色盲友善股票介面設計.md) — 色盲友善的漲跌色彩與多維視覺編碼設計

## SEO 策略 → `seo/`

- [SEO 友善網址設計指南.md](seo/SEO%20友善網址設計指南.md) — URL 架構設計與 SEO 治理
- [存股 SaaS 首頁 SEO 策略.md](seo/存股%20SaaS%20首頁%20SEO%20策略.md) — 存股型 SaaS 首頁的 SEO 架構與主題權威性策略

## 產品功能設計 → `product-design/`

- [oingg.com 台股選股 Preset 設計研究報告.md](product-design/oingg.com%20台股選股%20Preset%20設計研究報告.md) — 選股 Preset 功能設計研究：建議 18–22 個 preset 分類方式、台股籌碼面差異化因子、免費/付費分層與轉化漏斗設計（橫跨產品設計＋付費牆策略，但核心是這個功能本身的規格，故獨立於「商業模式」分類之外）
- [退休導向產品是否應納入券資比融資融券資料研究報告.md](product-design/退休導向產品是否應納入券資比融資融券資料研究報告.md) — go/no-go 功能評估：個股層級券資比/融資融券不建議放進存股核心決策介面（學術實證顯示個股融資餘額對報酬預測力不可靠，且與 Simply Safe Dividends/Morningstar/Seeking Alpha 等收益導向產品的分層做法一致）；大盤層級融資槓桿水位可作為市場脆弱度風險背景參考低調納入——現有 `MarginShortRatioCard` 已經在 day-trading.vue 而非 dashboard.vue，驗證這個結論已經是既有產品方向
- [退休投資儀表板偏好比較.md](product-design/退休投資儀表板偏好比較.md) — 退休族小白 vs 專家投資人的儀表板資訊偏好研究，主張「雙軌自適應架構」而非單一版面：小白偏好確定性現金流月曆、生活開銷覆蓋率、安全跑道年限、功用分艙資產總覽（P0）；專家偏好動態安全提領護欄(SWR)、最大回撤/VaR/CVaR尾部風險、因子暴露矩陣、蒙地卡羅模擬、跨帳戶稅務最佳化（P0）。附完整功能模組優先級矩陣（P0–P3）——dashboard.vue 的「新手/專業模式」殼（2026-09-04）即依此文件方向設計，但矩陣裡多數專業模式核心功能（SWR護欄、蒙地卡羅、VaR/CVaR）目前完全沒有對應資料源/計算引擎，屬於全新重量級開發，非既有資料補前端可比擬

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

## 法規遵循 → `regulatory-compliance/`

- [為 ifa.rocks 與 oingg.com 打造 Bucket 工具與選股平台：方法論與台灣法規遵循研究報告.md](regulatory-compliance/為%20ifa.rocks%20與%20oingg.com%20打造%20Bucket%20工具與選股平台：方法論與台灣法規遵循研究報告.md) — 證券投資顧問法第4條四要件、釋字第634號「一般性證券投資資訊」安全區、投信投顧公會問答集對「程式自動分析個股」的官方見解、監理沙盒對一人公司不可行、Robo-Advisor 作業要點門檻、實際判決案例（未經許可經營投顧罰則）——把個股分類到 bucket 是否構成推介屬法律灰色地帶,是 2026-09-03 conductor 否決「退休三水桶自動歸類標籤」功能背後的研究依據
