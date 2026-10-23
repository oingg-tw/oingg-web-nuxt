// 額度用完時，全站同一個說法、同一個去處（2026-10-06「完善付費方案」）。2026-10-24 從右下角一行提示改成彈窗（AppQuotaDialog，
// 使用者：「這個直接改成彈窗，這樣有比較多的篇幅說服用戶買單」），這裡只打開它。detail：換掉標題（整批放不下時不是「已達上限」，
// 是「還能加 N 檔」）
export const useQuotaNotice = () => useState<{ resource: QuotaResource; detail?: string } | null>('quota-notice', () => null)

export function showQuotaReached(resource: QuotaResource, detail?: string) {
  useQuotaNotice().value = { resource, detail }
}

// 已經在彈窗裡的地方（不能再疊一層彈窗）照抄同一句、自己接「看方案」（欄位設定的新增欄位）
export const quotaReachedText = (what: string) => `${what}已達目前方案的上限。可以刪掉不需要的，或之後升級專業版。`
