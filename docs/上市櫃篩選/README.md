---
aliases:
  - 上市櫃篩選頁面作業須知
  - Screener Page Spec
tags:
  - audience-frontend
  - page-spec
  - screener
  - atomic-design
  - seo
---

# 上市櫃篩選頁面作業須知與功能設計規範 (Screener)

- **路由端點**：`/screener`
- **頁面檔案**：`app/pages/screener.vue`
- **核心 Composable**：`app/composables/screener/useScreenerTabs.ts`（本專案最大、業務邏輯最密集之核心狀態管理器）
- **篩選欄位唯一真理來源**：`app/composables/screener/useFilterSchema.ts`（對齊後端 `/filters` 端點，**嚴禁自行發明欄位 key**）

---

## 1. 頁面定位與商業化分層架構 (Freemium Gating)

上市櫃篩選器是平台最強大的量化選股發動機，亦是 SaaS 商業化變現的關鍵樞紐。依據 [[選股 Preset 分類矩陣與付費分層]] 與 [[反向試用模式 (Reverse Trial)]]，實施「前幾名可見」之價值可見轉化漏斗：

```
[使用者套用篩選條件] (例如：ROE > 15% 且連配 10 年)
              │
              ▼
[結果表格頂部宣告：符合篩選條件標的共 42 檔]
              │
      ┌───────┴───────┐
      ▼               ▼
【免費層 (Free Tier)】   【專業付費層 (Pro Tier)】
  - 揭露符合結果前 3~5 名   - 解鎖完整 42 檔標的名單
  - 基礎財務指標呈現        - 解鎖進階法人籌碼、近 5 年回測勝率、最大回撤
  - 僅能瀏覽，無法儲存 Preset - 支援無限儲存自訂 Preset 分頁
  - 限制 CSV 匯出功能       - 支援一鍵匯出完整 CSV / Excel 數據
```

---

## 2. 核心子系統架構與互動流程 (Interaction Workflows)

### 一、新增條件兩段式流程 (Add Condition Flow)
為避免建立無意義的空條件，2026-09-04 重構確立了兩段式確定流程：
1. **觸發選擇器**：點擊「新增篩選條件」按鈕 $\to$ 開啟欄位選擇彈窗（`OrganismIndicatorPicker.vue`，桌機為錨定浮層、手機為全螢幕 Dialog）。
2. **數值編輯器**：使用者選定欄位（如 `pe_ratio`）後，自動銜接開啟數值範圍編輯彈窗（`OrganismRangeEditorPopover.vue`）。
3. **實體提交**：**僅當使用者實際設定了有效門檻（如 $\le 15$）並點擊確認後**，該條件藥丸（`OrganismConditionPill.vue`）才會正式新增至當前 Tab 狀態中。

### 二、Preset 分頁管理系統 (`SharedPresetFolder.vue`)
- 元件路徑：`components/shared/PresetFolder.vue`（Nuxt 全域註冊為 `<SharedPresetFolder />`）。
- **雙重職責**：同一組件同時負責「**篩選條件 Preset 分頁**（如：巴菲特策略、高息存股）」與「**結果表格顯示欄位分頁**（如：財務比率、籌碼動向）」，以統一的 UI 隱喻降低使用者認知學習曲線。

### 三、結果表格與多維編碼 (`OrganismResultTable.vue`)
- 支援後端分頁與伺服器端排序（傳遞 `sortField` 與 `sortOrder: 'asc' | 'desc'`）。
- 依據 [[多維視覺冗餘編碼 (Visual Redundancy)]]，所有數值欄位強制標註正負號與幾何圖示。
- 依據 [[投顧法第 4 條安全港與釋字 634 號邊界]]，表格標題一律宣告為「**符合條件之客觀標的清單**」，嚴禁出現「推薦買進」或「目標價」字樣。

---

## 3. SEO 多面向導覽 (Faceted Navigation) 治理規範

當篩選器開放使用者自由疊加數十種參數時，會引發毀滅性的索引膨脹（Index Bloat）。前端工程必須遵循 [[SEO 友善 URL 拓撲與多面向導覽治理]]：
- **自訂細碎篩選（帶動態 Query）**：
  - URL 如 `/screener?pe_lt=15&yield_gt=5&sort=desc`。
  - HTML `<head>` 中**強制部署 Canonical 標籤指向母頁面**：
    `<link rel="canonical" href="https://oingg.com/screener" />`
  - 告知搜尋引擎忽略暫態排序參數，避免稀釋抓取預算。
- **高流量官方 Preset（主題靜態落地頁）**：
  - 針對 18–22 組官方經典預設（如「巴菲特護城河選股」、「高殖利率存股」），建立專屬語意路由（如 `/screener/buffett-moat`），部署自引用 Canonical，全力爭取長尾關鍵字排名。

---

## 4. UI/UX 與前端無障礙工程約束

- **元件命名規範**：嚴格遵守 [[Atomic Design 與 Nuxt 元件命名規範]]，禁止在檔名手動添加 `Screener` 前綴（Nuxt 自動由目錄映射為 `ScreenerOrganismFilters`）。
- **鍵盤無障礙與拖曳替代方案**：
  - 表格欄位拖曳重排（Sortable.js）必須在無障礙樹中提供「純鍵盤上下移動」或「下拉選單調整順序」的等效替代機制，禁止僅能透過滑鼠拖曳。
- **手機端 360px 零破版保證**：
  - 在 360px 視窗下，結果表格鎖定左側「股票代號與名稱」固定列，右側數值區域開啟平滑橫向滾動，並配置陰影指示器暗示有更多資料。
  - 欄位選擇彈窗自動轉為全螢幕 Bottom Sheet，點擊目標一律維持 $\ge 48\text{x}48\text{px}$。詳見 [[高齡友善排版與觸控熱區規範]]。

---

## 5. 關聯知識點星軌
- [[選股 Preset 分類矩陣與付費分層]]
- [[反向試用模式 (Reverse Trial)]]
- [[SEO 友善 URL 拓撲與多面向導覽治理]]
- [[投顧法第 4 條安全港與釋字 634 號邊界]]
- [[多維視覺冗餘編碼 (Visual Redundancy)]]
- [[Atomic Design 與 Nuxt 元件命名規範]]
- [[高齡友善排版與觸控熱區規範]]
