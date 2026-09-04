---
aliases:
  - 核心知識庫總導覽
  - 2 knowledge MOC
  - 知識星系地圖
tags:
  - moc
  - knowledge-base
  - map-of-content
---

# 核心知識庫導覽地圖 (Knowledge MOC)

本目錄 `2 knowledge/` 為自 `1 researches/` 原創研究報告中淬煉出的**原子化常青知識庫（Evergreen Notes / Concept Notes）**。遵循卡片盒筆記法（Zettelkasten）與概念導向原則，每篇筆記專注於單一核心概念、具備完備的數理模型與工程依據，並透過 Obsidian 雙向連結（`[[wikilink]]`）交織為無縫貫通的知識星系網絡。

在 Obsidian 中按下 `Ctrl + G` 開啟關聯圖譜，即可觀察到八大核心主題星團及其跨領域星軌。

---

## 🌌 八大核心主題星系

```
                                  【2 knowledge 全局知識拓撲】
                                                │
         ┌───────────────────────────────┬──────┴───────────────────────────────┐
         ▼                               ▼                                      ▼
【01 總體經濟與定價】            【02 基本面與量化指標】                 【03 退休規劃與配置】
- 序列報酬風險 (SORR)            - ROIC-WACC 價值創造                   - 三水桶資產配置策略
- 高齡者物價指數 (CPI-E)         - PBR 1倍破淨機制                      - 債券帳篷 (Bond Tent)
- 實質利率與折現機制             - Piotroski F-Score                    - Guyton-Klinger 護欄
- 殖利率曲線與景氣循環           - Altman Z-Score                       - 台灣三層年金與 SWR
- PPI-CPI 剪刀差                 - Beneish M-Score                      - 台灣證券稅制與健保
- 營運槓桿與產能利用率           - DuPont 杜邦分析                      - 總報酬提領 vs 高股息
- 美林投資時鐘輪動               - 常態化獲利與回溯年限
- 戴維斯雙擊與雙殺               - 預期投資學 (Reverse DCF)
- 跨國匯率風險與 CIP             - KY 股法證會計檢驗
                                 - 特別股評價模型
                                 - 興櫃市場交易機制
         │                               │                                      │
         └───────────────────────────────┼──────────────────────────────────────┘
                                         ▼
         ┌───────────────────────────────┴──────────────────────────────────────┐
         ▼                               ▼                                      ▼
【04 產品設計與資訊架構】        【05 UI/UX 無障礙與設計系統】          【06 SaaS 商業化與營收】
- 雙軌自適應儀表板               - 適度對比 (Tempered Contrast)         - 反向試用 (Reverse Trial)
- 選股 Preset 分類矩陣           - Material 深色高度受光                - 價值指標與混合計費
- 金融數據降噪哲學               - WCAG vs APCA 對比演算法              - MoR 跨境金流選型
- 多維視覺冗餘編碼               - 高齡友善排版與觸控熱區               - ASC 606 遞延收入會計
                                 - 8pt 軟網格與 4pt 基線
                                 - Windows 強制色彩防禦
                                         │
         ┌───────────────────────────────┴──────────────────────────────────────┐
         ▼                                                                      ▼
【07 法規遵循與合規安全港】                                             【08 SEO 與前端工程規範】
- 投顧法第 4 條與釋字 634 號                                           - SEO 友善 URL 拓撲治理
- Robo-Advisor 自動化投顧紅線                                          - 金融 YMYL 與 E-E-A-T 架構
- 台灣無障礙標章雙軌檢驗                                               - Atomic Design 與 Nuxt 命名
```

---

## 📚 知識點索引清單

### 01. 總體經濟與資產定價 (`01-macro-economics/`)
- [[序列報酬風險 (Sequence of Returns Risk)]] — 提領期數理差分方程式、歷史世代壓力測試與防禦
- [[高齡者物價指數 (CPI-E) 與實質購買力]] — 醫療與居住必需品缺乏彈性、30年複利購買力缺口
- [[實質利率與資產定價折現機制]] — 費雪方程式、DCF 股權資本成本、遠期成長股久期殺戮
- [[殖利率曲線型態與景氣週期解讀]] — 倒掛到解倒掛、牛市陡峭降息危機、熊市陡峭通膨震盪
- [[PPI-CPI 剪刀差與毛利率敏感度]] — 價格傳導擴張與收窄、中下游企業利潤貧血與修復
- [[營運槓桿與產能利用率效應]] — DOL 數理模型、跨越損益兩平點之非線性爆發與收縮
- [[美林投資時鐘資產輪動模型]] — 復甦/過熱/滯脹/衰退四象限、股債商品現金輪動
- [[戴維斯雙擊與雙殺效應]] — $P = \text{EPS} \times \text{PE}$ 非線性乘數共振、景氣轉折點超額獲利與腰斬
- [[跨國匯率風險與拋補利率平價 (CIP)]] — 拋補利率平價、海外美台利差避險成本、危機美元微笑緩衝

### 02. 基本面分析與量化指標 (`02-fundamental-analysis/`)
- [[ROIC-WACC 價值創造模型]] — 投下資本利益率、資本成本、EVA 四輪驅動與價值創造邊界
- [[PBR 1倍破淨機制與資本收益性]] — $\text{PBR} = (\text{ROE}-g)/(r_e-g)$ 第一原理、折價成因與資本配置修復
- [[Piotroski F-Score 評分模型]] — 9 分制獲利/安全/效率二元檢驗、低 PBR 價值陷阱排除
- [[Altman Z-Score 破產預警模型]] — 製造業 5 因子多變量判別、2.99 安全線與 1.81 破產懸崖
- [[Beneish M-Score 盈餘操縱檢測]] — 8 因子 Probit 會計舞弊模型、$-1.78$ 臨界值預警
- [[DuPont 杜邦分析三因子拆解]] — 淨利率 $\times$ 資產週轉率 $\times$ 權益乘數、辨別高槓桿虛胖 ROE
- [[常態化獲利與財報回溯年限]] — 3/5/10年尺度、葛拉漢平滑本益比、巴菲特5年保留盈餘檢驗
- [[預期投資學與逆向折現 (Reverse DCF)]] — 當前股價逆推市場隱含預期 (PIE)、捕捉預期差超額報酬
- [[KY 股法證會計檢驗架構]] — 存貸雙高、DSO 陡增、現金流淨利脫節、海外控股審計盲區
- [[特別股契約與評價模型]] — 清算優先、股息累積與參與權、OPM/PWERM/TF 晶格、負凸性與 DLOM
- [[興櫃股票市場微觀交易機制與風險]] — 造市商雙向議價、30% 申報管制、50% 熔斷、彈性面額還原

### 03. 退休規劃與資產配置 (`03-retirement-planning/`)
- [[三水桶資產配置策略 (Three-Bucket Strategy)]] — 短期流動/中期現金流/長期抗通膨成長、補桶與再平衡機制
- [[債券帳篷與上升型股票滑動路徑 (Bond Tent)]] — 退休前後 5 年脆弱之窗防護、退休中後期再風險化 (Re-risking)
- [[Guyton-Klinger 動態提領護欄模型]] — 資本保全規則、繁榮規則、通膨跳過規則、SWR 提升至 5.2%–5.6%
- [[台灣三層年金與在地化安全提領率]] — 勞保/勞退公職保底扣減、台股高波動集中下 3.0%–3.5% SWR 調校
- [[台灣證券稅制與所得分離最佳化]] — 股利二擇一報稅 (8.5% 抵減退稅)、二代健保 2 萬元門檻優化、債券免證交稅
- [[總報酬提領 vs 高股息現金流]] — 資本利得停徵免稅壓倒性優勢、股息謬誤與心理帳戶水桶封裝

### 04. 產品設計與資訊架構 (`04-product-design/`)
- [[雙軌自適應儀表板架構 (Adaptive Dual-Track)]] — 小白防禦模式 (確定現金流) vs 專家精算控制台 (穿透式因子)
- [[選股 Preset 分類矩陣與付費分層]] — 18–22 組策略 (大師/因子/籌碼/存股)、前幾名可見轉化漏斗
- [[金融數據降噪哲學 (Noise Elimination)]] — 排除個股券資比、隱藏秒級跳動、防範散戶主動交易 3.8% 虧損
- [[多維視覺冗餘編碼 (Visual Redundancy)]] — 空心陽線/實心陰線、顯式符號 (+/-)、幾何箭頭 (▲/▼)、線條樣式分流

### 05. UI/UX 無障礙與設計系統 (`05-ui-ux-design/`)
- [[適度對比與光暈防護 (Tempered Contrast)]] — 捨棄純黑純白 21:1、對比度收斂於 7:1–12:1 防範視網膜光暈
- [[Material 深色高度受光與文字透明度模型]] — #121212 基底、5%–16% 白色疊加階梯、87%/60%/38% 文字透明度法則
- [[無障礙色彩空間與對比度演算法 (WCAG vs APCA)]] — 相對明度公式、剛性 4.5:1/3:1 門檻、F24 錯誤、APCA 感知演進
- [[高齡友善排版與觸控熱區規範]] — 16/18px 字級下限、1.5x 行高、48x48px 觸控熱區、360px 視窗零破版
- [[8pt 軟網格與 4pt 垂直基線系統]] — 防半像素模糊、4pt 行高基線垂直韻律、標準 Spacing Tokens
- [[Windows 強制色彩模式防禦技術]] — `@media (forced-colors: active)`、1px 透明邊框預埋、系統色彩關鍵字

### 06. SaaS 商業化與營收策略 (`06-saas-monetization/`)
- [[反向試用模式 (Reverse Trial)]] — 免綁卡 14 天 Pro 全開、無痛降級免費、稟賦效應驅動 7%–15% 轉化率
- [[SaaS 價值指標與混合計費架構]] — 席位 + 計量混合計費、Kano 模型、PSM 價格敏感度測試、RICE-M 矩陣
- [[Merchant of Record (MoR) 跨境金流選型]] — Stripe PSP vs Paddle / Lemon Squeezy MoR、全球 200+ 稅區合規
- [[ASC 606 遞延收入與點數沉澱會計]] — 預售點數合約負債、依履約進度認列營收、Breakage 攤銷與無人認領財產法

### 07. 法規遵循與合規安全港 (`07-regulatory-compliance/`)
- [[投顧法第 4 條安全港與釋字 634 號邊界]] — 投顧四要件、第 107 條刑事責任、釋字 634 號客觀資訊安全港、司法判決紅線
- [[Robo-Advisor 自動化投顧法規紅線]] — 機器人理財作業要點門檻、演算法專責委員會、再平衡 30 檔/60% 限制
- [[台灣無障礙標章與雙軌檢驗機制]] — 數發部 110.07 版、POUR 四原則、FreeGo 機器測 (0錯誤) + 人工專家雙軌實測

### 08. SEO 策略與前端工程規範 (`08-seo-and-engineering/`)
- [[SEO 友善 URL 拓撲與多面向導覽治理]] — RFC 3986、連字號小寫、<= 3 Slugs、Canonical 指向防禦 Index Bloat、IndexNow
- [[金融 YMYL 內容與 E-E-A-T 信任架構]] — SSR/SSG 渲染、CWV 指標 (LCP/INP/CLS)、JSON-LD FinanceApplication、證照背書
- [[Atomic Design 與 Nuxt 元件命名規範]] — 先按 domain/page 分層、內部採 Atom/Molecule/Organism 混合命名、Nuxt 自動前綴

---

## 🔗 來源研究文庫索引 (`1 researches/`)

所有上述原子知識筆記均源自 `1 researches/` 中的原創深度研究文庫：
- [[1 researches/Retiree Securities Investment Guide|Retiree Securities Investment Guide]]
- [[1 researches/退休投資總經指南|退休投資總經指南]]
- [[1 researches/總經與個股基本面分析|總經與個股基本面分析]]
- [[1 researches/基本面財報觀察年限分析|基本面財報觀察年限分析]]
- [[1 researches/財務諸表の主要投資指標ガイド|財務諸表の主要投資指標ガイド]]
- [[1 researches/ETF Selection Guidelines|ETF Selection Guidelines]]
- [[1 researches/KY Stock Fundamental Analysis|KY Stock Fundamental Analysis]]
- [[1 researches/特別股評價注意事項|特別股評價注意事項]]
- [[1 researches/興櫃股票投資注意事項|興櫃股票投資注意事項]]
- [[1 researches/為 ifa.rocks 與 oingg.com 打造 Bucket 工具與選股平台：方法論與台灣法規遵循研究報告|為 ifa.rocks 與 oingg.com 打造 Bucket 工具與選股平台：方法論與台灣法規遵循研究報告]]
- [[1 researches/退休投資儀表板偏好比較|退休投資儀表板偏好比較]]
- [[1 researches/退休導向產品是否應納入券資比融資融券資料研究報告|退休導向產品是否應納入券資比融資融券資料研究報告]]
- [[1 researches/oingg.com 台股選股 Preset 設計研究報告|oingg.com 台股選股 Preset 設計研究報告]]
- [[1 researches/Retirement Investment Monetization Features|Retirement Investment Monetization Features]]
- [[1 researches/ToC SaaS 單次付費研究|ToC SaaS 單次付費研究]]
- [[1 researches/高付費價值網站功能研究|高付費價值網站功能研究]]
- [[1 researches/財報狗與 CMoney 產業專區比較|財報狗與 CMoney 產業專區比較]]
- [[1 researches/Dark-Mode Homepage Design Guide |Dark-Mode Homepage Design Guide ]]
- [[1 researches/accessibility-guidelines|accessibility-guidelines]]
- [[1 researches/Taiwan Web Accessibility Guidelines|Taiwan Web Accessibility Guidelines]]
- [[1 researches/網站無障礙背景色彩架構與視覺感知工程研究報告|網站無障礙背景色彩架構與視覺感知工程研究報告]]
- [[1 researches/無障礙網站色彩規範|無障礙網站色彩規範]]
- [[1 researches/色盲友善股票介面設計|色盲友善股票介面設計]]
- [[1 researches/網格排版美學與實踐|網格排版美學與實踐]]
- [[1 researches/SEO 友善網址設計指南|SEO 友善網址設計指南]]
- [[1 researches/存股 SaaS 首頁 SEO 策略|存股 SaaS 首頁 SEO 策略]]
- [[1 researches/components-naming-convention|components-naming-convention]]
