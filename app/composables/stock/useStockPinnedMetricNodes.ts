import { METRIC_INDEX_BY_SLUG, type StockNavNode } from '~/utils/stock-page-nav'

// 釘選 slug → 指標目錄裡的那個節點，照使用者釘的順序。
//
// 跟 useStockPinnedMetrics 分開是**刻意的**，不是為了整潔：那一支被 useStockDetailPreferencesSync 用，
// 而那支在 app.vue 的 setup 裡跑。把這個查表放在那裡的話，app.vue 會在最早的初始化路徑上連帶載入
// stock-page-nav 與它 import 的 Element Plus 圖示套件，整個 app 初始化失敗、全站 SSR 只剩空殼（實際
// 發生過，連沒有側邊欄的首頁也一起壞）。只有真的要渲染那些列的元件才該載入這一支。
//
// 存了但已經不存在的 slug 直接忽略而不是渲染成死連結——指標頁會增減，而使用者的設定是舊的，這一層對帳
// 讓下架一個頁面不需要去改每個人存的資料。
export function useStockPinnedMetricNodes() {
  const { pinnedSlugs } = useStockPinnedMetrics()
  return computed<StockNavNode[]>(() =>
    pinnedSlugs.value.map(slug => METRIC_INDEX_BY_SLUG.get(slug)).filter((node): node is StockNavNode => !!node)
  )
}
