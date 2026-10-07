// 把 promise 跟計時器賽跑：卡住的依賴（Firebase token 更新、永不結束的請求）最後一定 reject，`await` 鏈與 finally 裡的 loading
// 狀態不會永遠卡住。
// 這兩個是全站的標準逾時值。2026-10-02 之前 REQUEST_TIMEOUT_MS = 15_000 被宣告了九次、另有七處字面值，九份看起來都像權威來源。
// 名字帶前綴是刻意的：通名放進自動匯入的範圍，遲早被某個檔案的同名區域常數靜默遮蔽（九份能並存沒人發現就是這樣）。
// 刻意沒收進來的三個值不是副本：server 的 system-health 用 5 秒（健康檢查要快速失敗）、company-logo 的 manifest 用 10 秒
// （外部 CDN）、__sitemap__ 的 15000 在 server 端。各有各的理由，合併只會讓人以為它們該一起調。
export const BFF_REQUEST_TIMEOUT_MS = 15_000
export const AUTH_TOKEN_TIMEOUT_MS = 10_000

export function withTimeout<T>(promise: Promise<T>, ms: number, message = '操作逾時'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
