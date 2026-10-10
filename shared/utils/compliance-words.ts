// The compliance register this site writes in（2.4.3 ／ 刪形容詞測試）: numbers and statistical
// positions only, never an evaluative word about a stock. The scripts under scripts/ scan every
// server-rendered page for these; the page builders in app/utils/stock-*.ts keep their own copy
// constants clean by construction. analysis-ts 的 api-conventions.md 指名這個檔案是禁用詞的唯一來源，
// 上游的使用者可見文字也照這份掃。

export const BANNED_WORDS = ['便宜', '合理', '昂貴', '偏低', '偏高', '穩健', '優於', '勝過', '領先', '贏過', '排名前段', '表現突出', '資料不足', '推薦買進', '目標價']

// 「領先指標」是國家發展委員會景氣指標的正式名稱（領先／同時／落後），不是評價詞，比對時放過（2026-10-11 景氣時鐘頁）。
export const BANNED_WORDS_PATTERN = new RegExp(BANNED_WORDS.map(word => (word === '領先' ? '領先(?!指標)' : word)).join('|'), 'g')

