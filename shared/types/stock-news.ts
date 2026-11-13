// 個股近期新聞（GET /stocks/{symbol}/news）：playwright 抓的新聞，數據中台用公司簡稱比對標題挑出這一檔的，業務中台原樣轉。合約（數據中台
// 8f4bd1a、111ee35）：近 30 天、最多 30 則、新到舊，沒有就是空陣列；欄位都必有；link 只有 http(s)；publishedAt 是詞彙表的「發布時間」（UTC、帶毫秒）
export interface StockNewsArticle {
  title: string
  source: string
  link: string
  publishedAt: string
}

export interface StockNewsResponse {
  symbol: string
  // 簡稱可比對（數據中台 111ee35）：false＝簡稱不拿來比對標題（常用詞或地名、跟別家同名、沒有簡稱），articles 一律空的，不代表最近沒有新聞
  isNameSearchable: boolean
  articles: StockNewsArticle[]
}
