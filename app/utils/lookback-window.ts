// Unified 近N年 lookback-window scale for every chart card (近1/3/5/10年 since 2026-11-25; 1/2/3/5/8
// from 2026-09-14 until then). Auto-imported (app/utils convention, same as getChartInk/CHART_TOOLTIP
// etc.), so no explicit import needed at call sites.
export const LOOKBACK_WINDOW_YEARS = {
  近1年: 1,
  近3年: 3,
  近5年: 5,
  近10年: 10
}

export type LookbackWindow = '近1年' | '近3年' | '近5年' | '近10年'

// 全站每張圖同一組（2026-10-15，使用者：「圖表右上年期選項請統一 1 年 2年 3年 5年 8年 自定義」）。2026-11-25 改成 1／3／5／10 年
//（使用者在數據中台那邊定「前端的時間範圍選項全部統一成 1／3／5／10 年，2 年、8 年不要了」，這邊問過「全站都改」）：上游的河流圖、Beta、
// 殖利率歷史也是這四個窗口。近10年要 40 季（上游一次最多給 40 季，剛好）、120 個月（月營收讀 132 個月）；更早的用自訂區間。
export const LOOKBACK_YEARS: readonly number[] = [1, 3, 5, 10]

// Which windows this symbol cannot fill.
//
// **2026-09-30 起這些選項是 disabled 的**（直接指示「資料不足的年份就 disabled 不讓選」）。這推翻了
// 2026-09-25 的相反決定，而那個決定的理由——「灰掉的選項什麼都沒說，讀者分不出是公司太年輕還是我們
// 沒給」，也就是 retiree-01 的「你連年數都不給我看，那我就是在賭，我不賭」——**現在由另一條路回答**：
// 2026-09-24 之後每張圖的角落都印著「本站共 N 季（約 M 年）」，灰掉就不再等於藏資訊。那一行 2026-10-15 依直接指示
// 移除（「指標圖表 右下角共多少季的資訊全面移除」）。
//
// 而且現在讀者根本不會落在填不滿的視窗上：fitLookbackWindow() 會自動往下找得到的最大區間。
// perYear 預設 4（季）。月頻率的頁面傳 12——月營收那一頁的「近5年」是 60 個月不是 20 個月。
export function insufficientLookbackYears(total: number | null, perYear = 4): number[] {
  return total === null ? [] : LOOKBACK_YEARS.filter(years => total < years * perYear)
}

// 把讀者選的區間收斂成這一檔真的填得滿的最大區間（2026-09-30「預設如果不足五年歷史就往下調整，
// 最小到一年」）。回傳 null 代表連一年都沒有——那時呼叫端不要畫圖，直接說未滿一年。
//
// **收斂而不是覆寫讀者的選擇**：選擇留著，只有渲染時取 min(選擇, 這一檔的上限)——切換期別讓可用深度變淺又變深時，讀者原本選的
// 會回來。選擇是每張圖自己的（2026-10-15「唯一要共用的只有選項本身，選出來的值不要共用」），共用的只有 LOOKBACK_YEARS。
export function fitLookbackWindow(chosen: LookbackWindow, total: number | null, perYear = 4): LookbackWindow | null {
  const fits = LOOKBACK_YEARS.filter(years => years <= LOOKBACK_WINDOW_YEARS[chosen] && (total === null || total >= years * perYear))
  const best = fits[fits.length - 1]
  return best === undefined ? null : (`近${best}年` as LookbackWindow)
}

// 把一段由舊到新的資料切成選定的視窗。fittedWindow 是 null（連一年都沒有）時回傳原本那一段——
// 呼叫端已經沒有更短的區間可以退，硬切成空陣列只會讓圖消失而讀者不知道為什麼。
export function sliceToLookbackWindow<T>(ascending: T[], fitted: LookbackWindow | null, perYear = 4): T[] {
  return fitted === null ? ascending : ascending.slice(-LOOKBACK_WINDOW_YEARS[fitted] * perYear)
}

// 近N年照日曆往回算（2026-11-24，使用者：「6498 杜邦分析有年但是淨值組成只有三年?」）：原本照期數切（近5年＝最後 20 期），興櫃時期
// 只申報半年報的年份一年只有兩點，於是近5年畫出六、七年，而且每張圖多出來的年數不一樣。每一期的 key 換成日曆上的序號（季、月、年），
// 跨度（最後一期減第一期）決定哪些近N年填得滿，切的時候留最後一期往回 N 年內的。key 是「2024Q1」「2024 Q1」「2024-01」「2024」；
// 每年期數不是 1、4、12 的圖（週資料、一年配幾次的配息）或有一期讀不出來時回 null，照舊照期數切
export function periodIndex(key: string, perYear: number): number | null {
  const year = /^(\d{4})/.exec(key)?.[1]
  if (!year) return null
  if (perYear === 1) return Number(year)
  if (perYear === 4) {
    const quarter = /Q\s*([1-4])/.exec(key)?.[1]
    return quarter ? Number(year) * 4 + Number(quarter) - 1 : null
  }
  if (perYear === 12) {
    const month = /^\d{4}-(\d{2})/.exec(key)?.[1]
    return month ? Number(year) * 12 + Number(month) - 1 : null
  }
  return null
}

export function calendarIndexes(keys: string[], perYear: number): number[] | null {
  const indexes = keys.map(key => periodIndex(key, perYear))
  return keys.length && indexes.every(index => index !== null) ? (indexes as number[]) : null
}

// 由舊到新的期別序號裡，最後一期往回 N 年內的那幾個的位置（第一個）。fitted 是 null 時從頭
export function calendarWindowStart(indexes: number[], fitted: LookbackWindow | null, perYear: number): number {
  if (fitted === null || !indexes.length) return 0
  const cutoff = indexes.at(-1)! - LOOKBACK_WINDOW_YEARS[fitted] * perYear
  const start = indexes.findIndex(index => index > cutoff)
  return start < 0 ? indexes.length : start
}

// 連一年都沒有時取代圖表的那一句。不寫「資料不足」——那是站上的禁用詞，而且它沒有回答「差多少」。
export function lessThanAYearText(total: number | null): string {
  return total === null || total <= 0 ? '這一檔還沒有可以畫圖的歷史。' : `這一檔目前只有 ${total} 季，未滿一年。`
}
