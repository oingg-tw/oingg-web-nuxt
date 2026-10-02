// 「升息一碼（+25 基點）」那一句，總經三頁共用。**2026-10-02 之前是三份一字不差的副本**
// （/macro/policy-rate、/macro/us-policy-rate、/macro/ecb-policy-rate），連上面的註解都只差
// 中英文。
//
// 一碼 = 0.25% = 25bp，是台灣講利率調整的單位，連講聯準會與 ECB 的新聞也用它。所以兩個都給：
// 基點是精確的，碼是讀者在新聞上看到的說法。
//
// 刻意**沒有**一起抽走的：`rateText`（三頁的小數位數不同，台灣的重貼現率真的公布到三位）、
// 以及 `hikes`／`cuts`／`earlierCount`／`eventsDesc` 那幾個單行 computed——ECB 那一頁數的是
// `depositFacilityChangeBp` 而不是 `changeBp`，為了容納它去參數化欄位名，加進來的機械比省掉的
// 三行多。三份單行的重複留著，是因為把它們合一需要一層抽象，而那一層本身比重複貴。
export function rateChangeText(changeBp: number | null): string {
  if (changeBp === null) return '—'
  const sign = changeBp > 0 ? '升息' : '降息'
  const notches = Math.abs(changeBp) / 25
  const notchText = notches === 0.5 ? '半碼' : notches === 1 ? '一碼' : `${notches} 碼`
  return `${sign}${notchText}（${changeBp > 0 ? '+' : '−'}${Math.abs(changeBp)} 基點）`
}
