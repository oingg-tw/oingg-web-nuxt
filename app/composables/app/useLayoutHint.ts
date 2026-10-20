// 骨架要畫幾列（2026-10-20，使用者：「載入之前，可以讓用戶看的出來畫面結構」「然後不要閃動」）：表格的列數要資料到了才知道，骨架猜錯
// 列數，表格下面的東西就在資料到的那一刻移動。資料到了記下列數（cookie，伺服器讀得到，第一個畫面就畫對），下次重新整理骨架就畫一樣多列；
// 第一次來用 fallback。一個名字一個 cookie，兩頁同時寫不會互相蓋掉。只是給畫面的提示：只有一個數字、不帶身分，猜錯也只是動一下
export function useLayoutHint(name: string, fallback: number) {
  const hint = useCookie<number | null>(`layout-hint-${name}`, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  return computed({
    get: () => hint.value ?? fallback,
    set: (value: number) => {
      if (hint.value !== value) hint.value = value
    }
  })
}
