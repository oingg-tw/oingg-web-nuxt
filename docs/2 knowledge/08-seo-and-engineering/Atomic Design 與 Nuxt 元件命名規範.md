---
aliases:
  - Atomic Design 與 Nuxt 元件命名規範
  - 前端元件架構
  - Nuxt 元件命名
  - Atomic Design 分層
  - components-naming
tags:
  - frontend-engineering
  - vue
  - nuxt
  - architecture-standards
---

# Atomic Design 與 Nuxt 元件命名規範

> 在 Nuxt 4 + Vue 3 的大型前端專案中，若全盤套用傳統 Atomic Design（在頂層直接劃分 `atoms/`、`molecules/`、`organisms/`），會導致工程師在開發特定功能時必須跨越數層深層目錄尋找檔案，造成嚴重的「跨層維護地獄」。本專案確立了優化的混合式架構：**頂層先依「可重用性與資料領域/頁面」劃分，僅在頁面專屬資料夾內部才套用 Atomic 分層命名**；同時深度善用 Nuxt 的「子目錄自動前綴註冊」機制，實現零手動 import、零路徑冗餘的簡潔開發體驗。

---

## 1. 頂層資料夾目錄的三級劃分邏輯

在建立新元件時，首先依據「設計上的通用性」決定落腳目錄：

```
app/components/
├── shared/               (第 1 類：完全不綁定任何業務 Domain 的泛型通用元件)
├── <domain>/             (第 2 類：可跨頁重用、但邏輯上綁定特定資料領域的元件)
│   ├── stock/            (如吃 Stock / ScreenerTab 型別的股票專屬元件)
│   └── user/             (如使用者資訊、權限選單)
└── <page>/               (第 3 類：跟特定頁面高度關聯、不預期被其他頁面重用的專屬元件)
    └── screener/         (僅在選股頁面使用的複雜區塊，內部套用 Atomic 命名)
```

| 資料夾目錄劃分 | 放置判斷標準 | 檔名命名規範 | Nuxt 全域自動註冊名稱範例 |
| :--- | :--- | :--- | :--- |
| **`components/shared/`** | **泛型純粹元件**。<br>不 import 任何業務 Domain 型別（完全不知道什麼是 `Stock` 或 `ScreenerTab`），僅接受泛型 props（如 `items`、`activeId`）。 | 檔名不加 domain 前綴：<br>`PresetFolder.vue` | 自動加上 `Shared` 前綴：<br>`<SharedPresetFolder />` |
| **`components/<domain>/`**<br>(如 `components/stock/`) | **跨頁共用業務元件**。<br>多個頁面皆會調用，但內部綁定特定業務型別（如顯示股票卡片、籌碼標籤）。 | 採 `<Domain><Name>.vue` 格式：<br>`StockCard.vue` | Nuxt 自動去重前綴：<br>`<StockCard />` (而非 `StockStockCard`) |
| **`components/<page>/`**<br>(如 `components/screener/`) | **單一頁面專屬元件**。<br>邏輯與特定路由強耦合，不預期被其他頁面調用。 | 內部套用 Atomic 分層：<br>`<Tier><Name>.vue` | 自動加上頁面前綴：<br>`<ScreenerOrganismFilters />` |

---

## 2. 頁面專屬資料夾內的 Atomic 分層規範

在 `components/<page>/` 內部，檔名強制採用 `<Tier><Name>.vue` 格式：

| Atomic 分層 | 職責與組合規則 | 現狀專案判定標準 | 實際檔案範例 |
| :--- | :--- | :--- | :--- |
| **`Atom<Name>`** | **最小原子單元**。<br>不組合其他自訂元件，僅對原生 HTML 或 Element Plus 進行極簡樣式封裝。 | 目前專案原子層直接調用 Element Plus 原生組件，**無須為了湊齊層級硬造自製 Atom**，待有全域封裝需求再擴充。 | - |
| **`Molecule<Name>`** | **分子小工具**。<br>自成一體的小型控制項，不組合其他自訂組件，但邏輯與排版比 Atom 複雜。 | 通常只封裝 Element Plus 組件（如 Select + Number Input 組合）。 | `components/screener/MoleculeRangeEditor.vue`<br>(註冊為 `<ScreenerMoleculeRangeEditor />`) |
| **`Organism<Name>`** | **有機體大區塊**。<br>組合了其他自訂組件（Molecule 或其他 Organism），或本身即為頁面的主要獨立互動區塊。 | 頁面主要結構模組、複雜資料表、指標挑選彈窗。 | `components/screener/OrganismFilters.vue`<br>`components/screener/OrganismResultTable.vue` |

---

## 3. Nuxt 子資料夾自動前綴機制 (避免手動重複命名)

在專案配置中，`nuxt.config.ts` **嚴禁覆寫 `components.pathPrefix`**：
- **自動前綴規則**：Nuxt 預設會自動將「子資料夾名稱」轉化為組件名稱的前綴。
  - 檔案路徑：`components/screener/OrganismFilters.vue`
  - 全域註冊名稱：**`ScreenerOrganismFilters`**
- ❌ **嚴禁在檔名中手動重複輸入資料夾名稱**：
  - 錯誤命名：`components/screener/ScreenerOrganismFilters.vue`
  - 此舉會導致 Nuxt 自動生成荒謬的 `<ScreenerScreenerOrganismFilters />`。

---

## 4. 關聯網絡與實踐

- **研究源頭**：[[components-naming-convention]]、[[accessibility-guidelines]]
- **樣式排版標準**：[[8pt 軟網格與 4pt 垂直基線系統]]（組件內部嚴格落實標準 spacing 類別）
- **無障礙工程配合**：[[Windows 強制色彩模式防禦技術]]（在組件邊界預留透明邊框）
- **產品架構映射**：[[雙軌自適應儀表板架構 (Adaptive Dual-Track)]]、[[選股 Preset 分類矩陣與付費分層]]
