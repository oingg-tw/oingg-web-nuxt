// 產業特區的側邊欄（2026-10-01「industries 這頁要有 sidebar，把產業索引頁與殖利率分析圖分開兩頁」）。
//
// **只有這一區自己的頁面，不列 34 個類股**。做過一版把類股掛在軌道下半部，使用者的判斷是
// 「這麼個塞法 UIUX 很難用」——34 個名稱在軌道裡是一條要捲的長清單，而它跟頁面本身的表格是同一
// 份東西。類股入口留在頁面裡：/industries 的表格每一列都連到該類股，那裡還帶著家數與兩個中位數，
// 比側邊欄的純名稱清單能判斷的多。
import type { StockNavNode } from '~/utils/stock-page-nav'

// 型別直接借個股導覽的 StockNavNode，因為畫它的是同一個元件（StockPageNavList）。`to` 是
// `(code) => string`，產業這一區沒有代號，所以忽略參數回傳固定路徑。
export const INDUSTRY_ZONE_ITEMS: StockNavNode[] = [
  // 2026-11-09 先隱藏（使用者：「產業索引隱藏。把產業殖利率當作產業索引預設畫面，URL不變化」）：/industries 畫殖利率分析，恢復時打開這一行，
  // 見 pages/industries/overview.vue
  // { label: '產業索引', to: () => '/industries' },
  { label: '殖利率分析', to: () => '/industries/dividend' },
  { label: '成長分析', to: () => '/industries/growth' },
  // 營收版 2026-10-24 從「景氣敏感度」改名：詞彙表的景氣敏感度是股價對同時指標的斜率（/industries/sensitivity），兩頁同名會分不出來
  { label: '營收與景氣', to: () => '/industries/cycle' }
  // 2026-11-04 先隱藏（使用者：「那 景氣敏感度 先幫我註解掉」），恢復時打開這一行，見 pages/industries/sensitivity.vue
  // { label: '景氣敏感度', to: () => '/industries/sensitivity' }
]

