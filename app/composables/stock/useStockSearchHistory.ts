import type { CompanyIndexEntry } from '~/composables/stock/useCompanyIndex'

// 搜尋紀錄（2026-11-20，使用者：「搜尋能否加上歷史搜尋紀錄？手機版就直接呈現，電腦版則是focus後把搜尋歷史作為預測打開」）：頁首、首頁與
// 手機搜尋層選過的股票，新的在前、同一檔只留一次、最多 8 筆。只存在這個瀏覽器（localStorage），不進帳號。存代號就好，名稱與種類每次從
// 全市場索引查：改名的跟著改、下市的自然消失。讀寫都包 try/catch：無痕視窗、封鎖網站資料時就是沒有紀錄，搜尋照常
const KEY = 'oingg:stock-search-history'
const LIMIT = 8

export function useStockSearchHistory() {
  const { data: companies } = useCompanyIndex()
  // 頁首與搜尋層同一份：在一邊選過，另一邊馬上看得到
  const codes = useState<string[]>('stock-search-history', () => [])

  // 伺服器沒有 localStorage：掛上之後才讀，第一次畫面跟伺服器一樣是空的（頁首的下拉與搜尋層本來就只在瀏覽器裡畫）
  onMounted(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      if (Array.isArray(saved)) codes.value = saved.filter((code): code is string => typeof code === 'string').slice(0, LIMIT)
    } catch {
      // 讀不到就是沒有紀錄
    }
  })

  function save(next: string[]) {
    codes.value = next
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // 存不了就只留在這一次瀏覽
    }
  }

  const history = computed<CompanyIndexEntry[]>(() => {
    const byCode = new Map((companies.value ?? []).map(entry => [entry.code, entry]))
    return codes.value.flatMap(code => byCode.get(code) ?? [])
  })

  return {
    history,
    remember: (entry: CompanyIndexEntry) => save([entry.code, ...codes.value.filter(code => code !== entry.code)].slice(0, LIMIT)),
    clear: () => save([])
  }
}
