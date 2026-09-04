---
aliases:
  - 前端工程師總導覽手冊
  - 前端作業須知
  - Frontend Master Guide
tags:
  - audience-frontend
  - engineering-standards
  - guidelines
  - moc
---

# 前端工程師全域作業須知與開發導覽 (Frontend Master Guide)

> 本指南是 `oingg-web-nuxt` 前端開發團隊的最高工程準則與各頁面作業手冊。所有前端工程師在進行頁面開發、元件重構、樣式調校與串接 API 時，均需以此規範為依據，嚴格落實無障礙工程（Accessibility）、資訊架構降噪（Noise Elimination）與法規合規安全港（Regulatory Safe Harbors）。

---

## 🛠️ 全域通用作業須知 (Global Engineering Principles)

在開發任何具體頁面之前，前端工程師必須內化以下五大剛性規範：

### 1. 「絕不用假數據填版面」原則 (No Synthetic Data)
- **真實在線原則**：任何尚無真實後端端點（bff-ts / API）支撐的圖表、卡片或數據欄位，**一律使用專屬的骨架殼元件（如 `StockChartShell.vue`、`StockProfileCardShell.vue`）**，並明確標記「資料尚未提供」或「功能開發中」。
- **嚴禁自造假資料**：禁止使用 Mock 假數字、隨機亂數或種子資料營造「看起來像真的」假象，避免誤導長線退休投資人做出錯誤決策。

### 2. 高齡人因工程與無障礙剛性底線 (Senior Accessibility Constraints)
- **字級下限 16px**：全站正文、表格與數據標籤嚴格遵守 **$\ge 16\text{px}$**，全面覆寫 Element Plus 預設的 14px，關鍵數據建議 18px–20px。詳見 [[高齡友善排版與觸控熱區規範]]。
- **觸控熱區 48x48px**：按鈕與點擊目標物理尺寸不得小於 **48x48px**，相鄰按鈕必須具備至少 **8px** 防誤觸間距。
- **360px 視窗零破版**：實體手機寬度 360px 視窗下必須完全零破版、零元素溢出。
- **適度對比抗眩光**：遵守 [[適度對比與光暈防護 (Tempered Contrast)]]，對比度收斂於 **7:1 至 12:1**，嚴禁使用 `#000000` 純黑底配 `#FFFFFF` 純白字。
- **Material 深色受光量模型**：遵守 [[Material 深色高度受光與文字透明度模型]]，基底表面採 `#121212`，卡片表面採 `#1E1E1E`（5% 白疊加），文字遵守 87%（高強調）、60%（次要）、38%（停用）透明度法則。
- **Windows 高對比防禦**：遵守 [[Windows 強制色彩模式防禦技術]]，互動元件預埋 `border: 1px solid transparent`。

### 3. 元件組織與 Atomic Design 混合分層 (Components Architecture)
- 遵循 [[Atomic Design 與 Nuxt 元件命名規範]]：
  - 通用泛型元件 $\to$ `components/shared/`（如 `PresetFolder.vue`，自動註冊為 `SharedPresetFolder`）。
  - 跨頁共用領域元件 $\to$ `components/<domain>/`（如 `components/stock/StockCard.vue`）。
  - 單一頁面專屬元件 $\to$ `components/<page>/`，內部採 `<Tier><Name>.vue` 命名（`MoleculeRangeEditor.vue`、`OrganismFilters.vue`）。
  - **嚴禁在檔名手動加入頁面前綴**，讓 Nuxt 自動處理路徑前綴映射。
  - 間距嚴格遵從 [[8pt 軟網格與 4pt 垂直基線系統]]。

### 4. 法律安全港與嚴禁個股推介 (Regulatory Safe Harbors)
- 遵循 [[投顧法第 4 條安全港與釋字 634 號邊界]] 及 [[Robo-Advisor 自動化投顧法規紅線]]：
  - **絕對禁止在任何畫面標註「推薦買進」、「目標價」、「買賣進出點」、「支撐壓力點」或「停損停利價」**。
  - 所有篩選與分類結果標題一律定性為「**符合客觀條件之標的清單**」。
  - 退休試算與水桶工具僅能呈現大類資產配比，所有試算參數外顯，由使用者自主滑動調整，絕不自動派發個人化個股配置。

### 5. 多維視覺冗餘編碼 (Visual Redundancy)
- 遵循 [[多維視覺冗餘編碼 (Visual Redundancy)]]：
  - 股價與報酬率**強制並列正負符號（`+` / `-`）與幾何方向圖標（▲ / ▼ / ─）**。
  - 圖表與走勢線採用實線、虛線、點狀線分流，並提供末端直接標註（Direct Labeling）。
  - 徹底杜絕將「色彩」作為傳達金融資訊的唯一管道。

---

## 🧭 八大功能頁面作業須知導覽清單

點擊以下連結，查閱各專屬頁面的詳細作業須知、設計規範與功能邏輯：

1. **[[3 audiences/前端工程師/總覽/README|01. 總覽 (Dashboard)]]** — 路由 `/dashboard`，卡片式首頁、雙軌自適應模式切換、金融數據降噪。
2. **[[3 audiences/前端工程師/持股管理/README|02. 持股管理 (Holdings)]]** — 路由 `/holdings`，實際持有資產、三水桶動態分艙、股利現金流試算與二代健保扣除。
3. **[[3 audiences/前端工程師/觀察清單/README|03. 觀察清單 (Watchlist)]]** — 路由 `/watchlist`，追蹤股票池、自訂欄位切換、除權息日曆提醒、本地 state 與持久化。
4. **[[3 audiences/前端工程師/大師指標/README|04. 大師指標 (Guru Indicators)]]** — 路由 `/guru-indicators`，自訂策略組合六角雷達圖、指標組合評分而非個股評分（法規合規防火牆）。
5. **[[3 audiences/前端工程師/上市櫃篩選/README|05. 上市櫃篩選 (Screener)]]** — 路由 `/screener`，Preset 分頁管理、多維面向導覽治理、條件彈窗流程、前幾名可見付費牆。
6. **[[3 audiences/前端工程師/個股瀏覽/README|06. 個股瀏覽 (Stock Detail)]]** — 路由 `/stock/[code]`，決策優先序三區塊（估值河流圖 $\to$ 財務數據 $\to$ 公司資訊）、股本變化階梯圖、真實端點與結構殼。
7. **[[3 audiences/前端工程師/ETF 專區/README|07. ETF 專區 (ETF Zone)]]** — 路由 `/etf-zone`，風險檢核清單（TER 30 年複利侵蝕、資產規模防清算、槓桿反向波動損耗）、真實排行表。
8. **[[3 audiences/前端工程師/特別股專區/README|08. 特別股專區 (Preferred Stocks)]]** — 路由 `/preferred-stocks`，特別股條款卡片（股息累積/參與權、贖回權）、負凸性警示、固定收益與最差殖利率（YTW）。
