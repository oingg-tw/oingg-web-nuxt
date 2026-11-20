// 個股重大訊息（2026-11-21，數據中台 GET /stocks/{symbol}/material-announcements，業務中台照轉）：上市讀證交所、上櫃讀櫃買，
// 新到舊（發言日期，同一天再依發言時刻，時刻缺的排在那一天最後）
export interface MaterialAnnouncement {
  market: 'sii' | 'otc'
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
}

export interface MaterialAnnouncementsResponse {
  symbol: string
  market: 'sii' | 'otc' | 'rotc'
  // 這個市場從哪一天開始有資料；null 是沒有來源（興櫃）
  dataSince: string | null
  count: number
  limit: number
  offset: number
  entries: MaterialAnnouncement[]
}
