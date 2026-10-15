// 「上次用的那一組」（2026-10-15 三組篩選：我的篩選、顯示欄位各記一份）。個人便利，存在這台瀏覽器的 localStorage；
// 無痕、封鎖網站資料時讀寫會丟例外或拿到空的，當成沒記就好，畫面照樣能用。
export function rememberedChoice(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function rememberChoice(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 不記也能用
  }
}
