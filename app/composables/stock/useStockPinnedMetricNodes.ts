import { METRIC_INDEX_BY_SLUG, type StockNavNode } from '~/utils/stock-page-nav'
import { DEFAULT_PINNED_METRIC_SLUGS } from '~/composables/stock/useStockPinnedMetrics'

// 釘選 slug → 指標目錄裡的那個節點，照使用者釘的順序。
//
// 跟 useStockPinnedMetrics 分開是**刻意的**，不是為了整潔：那一支被 useStockPinnedMetricsSync 用，而那支在 app.vue 的 setup 裡跑。
// 把這個查表放在那裡的話，app.vue 會在最早的初始化路徑上連帶載入 stock-page-nav 與它 import 的 Element Plus 圖示套件，整個 app
// 初始化失敗、全站 SSR 只剩空殼（實際發生過，連沒有側邊欄的首頁也一起壞）。只有真的要渲染那些列的元件才該載入這一支。
//
// 存了但已經不存在的 slug 直接忽略而不是渲染成死連結——指標頁會增減，而使用者的設定是舊的，這一層對帳
// 讓下架一個頁面不需要去改每個人存的資料。
// 那層對帳有一個副作用：**預設清單裡打錯的 slug 也會被靜靜濾掉**，症狀只是「那一列就是不出現」。
// 使用者存的舊 slug 該安靜，我們自己寫死的預設值不該——這裡在 dev 把它叫出來。
//
// 這是這個檔案能做這件事的唯一原因：查表在這裡，而預設清單在 useStockPinnedMetrics（那一支刻意不
// import 任何東西，所以驗不了自己）。放在模組頂層而不是 composable 裡，一個 process 只跑一次。
if (import.meta.dev) {
  const dead = DEFAULT_PINNED_METRIC_SLUGS.filter(slug => !METRIC_INDEX_BY_SLUG.has(slug))
  if (dead.length) {
    console.warn(
      `[pinned-metrics] DEFAULT_PINNED_METRIC_SLUGS 有 ${dead.length} 個 slug 不在指標目錄裡：${dead.join('、')}。`
      + '它們會被靜靜濾掉，新訪客的側邊欄會少那幾列。檢查 useStockPinnedMetrics.ts 的拼字，或那一頁是不是下架了。'
    )
  }
}

export function useStockPinnedMetricNodes() {
  const { pinnedSlugs } = useStockPinnedMetrics()
  return computed<StockNavNode[]>(() =>
    pinnedSlugs.value.map(slug => METRIC_INDEX_BY_SLUG.get(slug)).filter((node): node is StockNavNode => !!node)
  )
}
