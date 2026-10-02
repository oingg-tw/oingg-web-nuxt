// Races a promise against a timer so a hung dependency (a stalled Firebase token refresh,
// a request that never settles, etc.) always eventually rejects instead of leaving an
// `await` chain — and anything waiting on it, e.g. a button's loading state reset in a
// `finally` — stuck forever.
// 這兩個是全站的標準逾時值。**2026-10-02 之前 REQUEST_TIMEOUT_MS = 15_000 被宣告了九次**，
// 另外還有七處直接寫 `timeout: 15_000` 的字面值——想調整它要改十六個地方，而其中九個看起來都像
// 權威來源。
//
// 放在這裡而不是 shared/utils：`shared/` 在本專案要顯式 `#shared/...` import，十六個檔案就是
// 十六行新 import，省不到任何東西；`app/utils` 是自動匯入的，而且「逾時的輔助函式」跟「標準逾時
// 值」本來就該放在一起。
//
// 名字帶前綴是刻意的：叫 REQUEST_TIMEOUT_MS 這種通名放進自動匯入的範圍，遲早被某個檔案的同名
// 區域常數靜默遮蔽（那正是這九份能一直並存而沒人發現的原因）。
//
// 刻意**沒有**收進來的三個值，它們不是這兩個的副本：server 的 system-health 用 5 秒（健康檢查要
// 快速失敗）、company-logo 的 manifest 用 10 秒（外部 CDN）、__sitemap__ 的 15000 在 server 端而
// 這個檔案是 app/utils。各自有各自的理由，合併只會讓下一個人以為它們該一起調。
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
