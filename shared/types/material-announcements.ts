// 個股重大訊息（2026-11-21，數據中台 GET /stocks/{symbol}/material-announcements，業務中台照轉）：2026-11-24 起改讀公開資訊觀測站
//（2016 起，上市、上櫃、興櫃都有），公開資訊觀測站還沒收進來的最近幾天接兩所。新到舊（發言日期，同一天再依發言時刻，時刻缺的排在那一天最後）
export interface MaterialAnnouncement {
  market: 'sii' | 'otc' | 'rotc'
  // 發言日期與時刻（台灣時間）；2026-11-03 證交所改格式以前的列可能沒有時刻
  announcementDate: string
  announcementTime: string | null
  announcedAt: string | null
  factDate: string | null
  generatedDate: string | null
  subject: string
  clauseNo: number | null
  // 公告全文，原樣保留換行（\r\n）
  description: string
  // 負面事件的類別（2026-11-24，公開觀測站分類；中文在 NEGATIVE_EVENT_LABELS）。不是負面事件、或晚於 classifiedThroughDate 還沒分類是 null
  negativeEvent?: string | null
}

export interface MaterialAnnouncementsResponse {
  symbol: string
  market: 'sii' | 'otc' | 'rotc'
  // 這個市場從哪一天開始有資料；null 是沒有來源（2026-11-24 起興櫃也有，三個市場都是 2016 年起）
  dataSince: string | null
  // 負面事件分類到哪一天；比它新的公告還沒分類
  classifiedThroughDate?: string | null
  count: number
  limit: number
  offset: number
  entries: MaterialAnnouncement[]
}
