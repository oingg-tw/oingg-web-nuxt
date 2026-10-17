import type { PreferredStockEntry } from '#shared/types/screener-detail'

// 特別股專區（/preferred）的清單：28 檔，伺服器端讀（GET /api/preferred，一小時快取），SSR 就有表格。依代號排序。
// 讀不到交給全站的讀取失敗彈窗，畫面不說「沒有資料」（讀不到不說沒有）
export async function usePreferredZoneList() {
  const { data, error, refresh } = await useFetch<{ entries: PreferredStockEntry[] }>('/api/preferred', { key: 'preferred-zone-list' })
  watchLoadFailure('preferred-zone-list', () => error.value, () => refresh())
  const entries = computed(() => [...(data.value?.entries ?? [])].sort((a, b) => a.symbol.localeCompare(b.symbol)))
  // 「今天」用台北日期（判斷最早可收回日過了沒）
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
  return { entries, error, today }
}
