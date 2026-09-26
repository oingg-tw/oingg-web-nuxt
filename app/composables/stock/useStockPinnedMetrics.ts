// 使用者釘在個股側邊欄的指標（2026-09-26「指標要可以自選加入到左邊的 sidebar」）。
//
// 側邊欄同一天砍成固定四列，其餘 57 個指標頁搬到 /stock/{code}/metrics 這個目錄頁。釘選就是把目錄頁上
// 的某一項拉回側邊欄——固定四列是骨幹，釘選是各人自己的那幾列。
//
// **陣列順序就是側邊欄的順序**，所以新釘的排在最後而不是排回它在目錄裡的位置：使用者剛按下去，眼睛在
// 按鈕上，最後一列是唯一不用找就看得到的位置。bff-ts 那一欄原樣保留順序、不排序不去重，就是為了這件事。
//
// 持久化在 /users/me/stock-detail-preferences 的 pinnedMetricSlugs（bff-ts 668df6d）。同步寫在
// useStockDetailPreferencesSync.ts，而**那支必須從 app.vue 呼叫**——watcher 註冊在哪個元件就跟著哪個
// 元件卸載，寫在頁面裡的話離開個股頁就被 Vue 停掉，存檔會靜默失效（2026-09-09 真的發生過）。
//
// 未登入也能釘，只是留在記憶體裡、重新整理就沒了。這跟自選股一樣是「沒有後端就沒有持久化」，差別在
// 這一支的後端已經有了，所以登入後是真的存得住。
//
// **這個檔案刻意不 import 任何東西。** 它被 useStockDetailPreferencesSync 用，而那支在 app.vue 的
// setup 裡跑，是整個 app 最早的初始化路徑之一。第一版把 slug → 節點的查表也放在這裡，於是 app.vue 得
// 在那個時間點連帶載入 stock-page-nav（以及它 import 的 Element Plus 圖示套件），整個 app 初始化直接
// 失敗、全站 SSR 只剩空殼——連首頁都是，而首頁根本沒有側邊欄。查表搬到
// useStockPinnedMetricNodes()（同目錄），只有真的要渲染那些列的元件才會載入它。
const STORAGE_KEY = 'stock-pinned-metric-slugs'

// 一次最多釘幾個。bff-ts 那一欄的上限是 50，這裡取更小的值：側邊欄固定四列，再加上 12 列就已經是手機
// <details> 抽屜（60dvh ≈ 10 列）裝不下的長度。上限不是為了省儲存空間，是為了讓側邊欄維持是側邊欄。
export const PINNED_METRIC_LIMIT = 12

export function useStockPinnedMetrics() {
  const pinnedSlugs = useState<string[]>(STORAGE_KEY, () => [])

  const isPinned = (slug: string) => pinnedSlugs.value.includes(slug)
  const isFull = computed(() => pinnedSlugs.value.length >= PINNED_METRIC_LIMIT)

  function toggle(slug: string) {
    if (isPinned(slug)) {
      pinnedSlugs.value = pinnedSlugs.value.filter(existing => existing !== slug)
      return
    }
    if (isFull.value) return
    pinnedSlugs.value = [...pinnedSlugs.value, slug]
  }

  return { pinnedSlugs, isPinned, isFull, toggle }
}
