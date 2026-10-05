import { groupThousands } from '~/utils/stock-answers'

// 持股頁的金額寫法，兩頁共用（持股總覽、績效）。名字帶 holdings 前綴：app/utils 的 export 會自動匯入到
// 整個 app，通名（money、signedMoney）遲早被某個檔案的同名區域函式靜默遮蔽。

export function holdingsMoney(value: number): string {
  return groupThousands(Math.round(value))
}

// 損益同時用正負號與 ▲／▼ 表示，不只靠顏色；0 不加箭頭（平盤不是漲也不是跌）。
export function holdingsSignedMoney(value: number | null): string {
  if (value === null) return '－'
  const rounded = Math.round(value)
  if (rounded === 0) return '0 元'
  return `${rounded > 0 ? '▲ +' : '▼ '}${groupThousands(rounded)} 元`
}
