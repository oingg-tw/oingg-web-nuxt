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

// 未登入（以及登入但從沒存過）的預設釘選（2026-09-28「要設計 預設已經選好的幾個指標給 未登入用戶，
// 這樣比較合理 也降低學習成本」）。第一版是空陣列，於是新訪客看到的側邊欄只有固定四列，而釘選這個
// 功能要先讀懂目錄頁才會被發現。
//
// 五支排成一條提問鏈，不是五個獨立的好指標：
//
//   現金殖利率    我能領多少        ← 退休族的入場券
//   盈餘發放率    這樣發得出來嗎
//   每股盈餘      公司到底有沒有賺
//   負債比率      會不會倒
//   本益比        買貴了沒
//
// **挑選的硬條件是資料覆蓋率**，不是「哪五個最重要」——預設釘選的指標如果常態缺值，那就是新訪客的
// 第一印象。2026-09-28 均勻抽 124 檔、實得 92 檔量到：
//
//   負債比率 100%／本益比 97.8%／每股盈餘 97.8%／盈餘發放率 75.0%
//
// 盈餘發放率那 25% 缺的是虧損公司（nullReason: zero_or_negative_denominator），不是資料缺口，
// 而且那一頁會照實說「盈餘發放率為 無法計算」——實測 1101 台泥，五個問句 h2 與表格都在。相對地
// ROIC 有 41% 是 null 且 nullReason 自相矛盾，所以不論它多有名都不會進這個清單。
//
// 只佔 12 個上限裡的 5 個：預設是起點不是成品，要留位置給使用者自己加。
//
// 改這裡要同時確認 slug 真的存在——不存在的 slug 會被 useStockPinnedMetricNodes 靜靜濾掉（那是刻意
// 的，讓下架一個頁面不需要去改每個人存的資料），所以打錯字的症狀是「那一列就是不出現」，不會報錯。
// 那一支有一個 dev-only 的檢查會叫出來。
export const DEFAULT_PINNED_METRIC_SLUGS = [
  'dividend',
  'dividend-payout-ratio',
  'eps',
  'debt-ratio',
  'pe-ratio'
] as const

export function useStockPinnedMetrics() {
  // 展開成新陣列：useState 的初始值會被 toggle 直接 mutate，共用同一個參考會把常數本身改掉。
  const pinnedSlugs = useState<string[]>(STORAGE_KEY, () => [...DEFAULT_PINNED_METRIC_SLUGS])

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
