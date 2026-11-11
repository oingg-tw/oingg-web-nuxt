// SWR 快取最多能舊多久（2026-11-12，使用者選「限制最多能舊多久」）：Nitro 開著 swr 時不管快取多舊都先回舊值、背景再更新，staleMaxAge
// 沒有作用，KV 的鍵也不過期——閒置很久之後第一位訪客會看到好幾天前的值（量到 2330 的河流圖最新一點停在 5 天前）。validate 回 false 的快取
// Nitro 當作沒有：超過 maxAge＋staleMaxAge 就先拿新的再回；上限內照舊先回舊值、背景更新。代價：閒置超過上限後的第一位訪客要等上游，上游
// 掛掉時那一頁讀取失敗，不再拿很舊的值頂著。零 import：scripts/check-swr-cache.mjs 直接載入
export function swrCache(maxAge: number, staleMaxAge: number) {
  return {
    maxAge,
    staleMaxAge,
    swr: true,
    validate: (entry: { value?: unknown, mtime?: number }) => entry.value !== undefined && Date.now() - (entry.mtime ?? 0) <= (maxAge + staleMaxAge) * 1000
  }
}
