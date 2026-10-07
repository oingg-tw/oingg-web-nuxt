// 「大的財報數字撐爆小 chip／儲存格」的共用格式化（2026-09-11 抽出，徽章 chip 與篩選器市值欄共用），遞迴的 億／兆 縮寫。
// app/utils 自動匯入，呼叫端不用 import。

// 只對整數部分加千分位、小數位不動（同 stock-answers.ts 的 addThousandSeparators：走 Number.toLocaleString 會悄悄砍掉有意義的尾零）；
// 用在每次 億／兆 除完之後的最後那個數字還 ≥1,000 時（"4,695億" 不是 "4695億"）。
// 2026-09-10（「淨流動資產價值 數字要format不讓他跑版」）：走 formatRawValue 的徽章以前把 API 的原始浮點數原樣插進去
// （64.19384729103647），撐爆 chip。改成 3 位有效數字（toPrecision 不是 toFixed——葛拉漢數 693.89 → "694"，不是再多兩位小數）。
// 驗證時又抓到第二個：NCAV 是資產負債表總額不是每股（大型股 1660000000000），toPrecision(3) 之後 Number().toString() 仍是 13 位
// 字串。超過門檻就用台灣財報真的在用的 億／兆 縮寫，遞迴對縮小後的數（1.66）再做同樣的有效位數四捨五入。
export function formatSignificantDigits(value: number, digits: number): string {
  const rounded = Number(value.toPrecision(digits))
  const magnitude = Math.abs(rounded)
  if (magnitude >= 1e12) return `${formatSignificantDigits(rounded / 1e12, digits)}兆`
  if (magnitude >= 1e8) return `${formatSignificantDigits(rounded / 1e8, digits)}億`
  return groupThousands(rounded.toString())
}
