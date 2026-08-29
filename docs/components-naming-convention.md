# Components 命名與組織規範

> 適用對象：前端工程師、PR Reviewer
> 適用範圍：`app/components/` 底下所有元件

## 1. 先判斷可重用性，決定放哪個資料夾

- **可重用、不跟特定頁面強耦合** → 放在 domain 共用資料夾（`components/<domain>/`，如 `stock/`、`user/`），檔名維持既有的 `<Domain><Name>.vue` 慣例（例如 `StockCard.vue`）。
- **跟某個頁面高度關聯、不預期被其他頁面重用** → 放在該頁面專屬的資料夾 `components/<page>/`（例如 `components/screener/`）。

判斷標準是「設計上是否通用」，不是「目前有沒有被別的地方用到」——`components/stock/StockPresetFolder.vue` 就是一個例子：它目前只有 screener 頁面在用，但它只吃 `items`/`activeId` 這種泛型 props，完全不知道 `ScreenerTab` 是什麼，設計上就是給未來其他頁面（例如 watchlist）重用的，所以留在共用的 `stock/`，不跟著搬進 `screener/`。

## 2. 頁面專屬資料夾內，檔名依 Atomic Design 分層命名

在 `components/<page>/` 底下，檔名格式是 `<Tier><Name>.vue`：

| 分層 | 判斷依據 |
|---|---|
| `Atom<Name>` | 最小單位，不組合其他自訂元件（通常只包 Element Plus 元件本身） |
| `Molecule<Name>` | 自成一體的小工具，不組合其他自訂元件，但邏輯/排版比 Atom 複雜 |
| `Organism<Name>` | 組合了其他自訂元件（Atom/Molecule），或本身是頁面裡一個複雜/主要的區塊 |

目前專案裡還沒有真正的 `Atom` 元件——這個 codebase 的「原子」層級都是直接用 Element Plus 元件本身，還沒有自製的 atom 級元件，等未來真的需要時再補上這一層即可，不用為了湊層級硬造一個。

## 3. 不要在檔名裡手動加頁面前綴——交給 Nuxt 的資料夾自動命名

`nuxt.config.ts` **不能**覆寫 `components.pathPrefix`。Nuxt 預設行為是：子資料夾名稱會自動變成全域元件名稱的前綴（除非檔名剛好已經用該資料夾名稱開頭，才會被去重，例如 `stock/StockCard.vue` 不會變成 `StockStockCard`）。

也就是說，`components/screener/OrganismFilters.vue` 這個檔案，全域元件名稱會**自動**變成 `ScreenerOrganismFilters`，模板裡直接寫 `<ScreenerOrganismFilters />` 就能用（Nuxt 自動 import，不用手動 import）——不需要、也不應該自己把 `Screener` 手動打進檔名裡。

## 4. 目前的實際案例（screener 頁面）

| 檔案 | 全域元件名稱 | 分層 | 為什麼 |
|---|---|---|---|
| `components/screener/OrganismFilters.vue` | `ScreenerOrganismFilters` | Organism | 組合了 `ScreenerOrganismConditionPill`，是頁面主要區塊之一 |
| `components/screener/OrganismConditionPill.vue` | `ScreenerOrganismConditionPill` | Organism | 組合了 `ScreenerMoleculeRangeEditor`（popover 內容） |
| `components/screener/MoleculeRangeEditor.vue` | `ScreenerMoleculeRangeEditor` | Molecule | 只包 Element Plus 元件（select + number input），沒有組合其他自訂元件 |
| `components/screener/OrganismIndicatorPicker.vue` | `ScreenerOrganismIndicatorPicker` | Organism | 獨立的指標挑選對話框，是頁面主要互動流程之一 |
| `components/screener/OrganismResultBody.vue` | `ScreenerOrganismResultBody` | Organism | 組合了 `ScreenerOrganismResultTable` |
| `components/screener/OrganismResultTable.vue` | `ScreenerOrganismResultTable` | Organism | 複雜的表格（含拖曳排序），獨立運作但邏輯量大 |

`components/stock/StockPresetFolder.vue` 維持共用（見第 1 節），命名照舊用 `Stock<Name>.vue`。

## 5. 與先前「整個 app 一律照 atoms/molecules/organisms 分」的差異

專案早先討論過「把 `components/` 整個改成 `atoms/`、`molecules/`、`organisms/` 三個頂層資料夾」，後來判斷這個做法會讓開發時要跨好幾層資料夾才找得到同一個功能的元件，決定放棄（詳見 git 歷史）。這份規範是修正後的版本：**先照功能/頁面分（找元件時直覺、同一頁的東西都在一起），只有在頁面專屬資料夾內部才用 atomic 分層命名**，兩者互不衝突。
