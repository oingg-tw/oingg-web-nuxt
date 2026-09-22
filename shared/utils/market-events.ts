// 大事件年表 — the event list behind /macro/market-events（2026-09-22,「總經特區再加上一個頁面，把
// 台股與世界的大事件與台股指數比較。比如covid19。」）.
//
// THE INCLUSION RULE, and why this file needs one at all.
//
// Every other page in 總經特區 reads an external series whole: gov-ts publishes every CBC rate
// decision, the NDC publishes every monthly signal, and this app decides nothing about which rows
// appear. This page is the first where WE choose what goes on the chart, and choosing is where the
// compliance risk lives — pick the events that happen to sit above big drops and the page
// manufactures a causal impression without ever writing a causal sentence.
//
// So the rule is external and stated on the page itself:
//
//   收錄條件：事件必須有官方或國際機構正式宣告、且可公開查證的日期。
//   不以指數跌幅大小決定收錄與否。
//
// Every row below carries the body that made the declaration and the date it carries. A reader can
// check any of them. What is deliberately NOT here: 「黑天鵝」, 「股災」, anything named after a
// market move rather than after a declaration, and any event whose date we would have to pick
// ourselves from a range.
//
// WHAT THIS PAGE MUST NEVER DO, restated here because the file is where the temptation lives:
// compute event-relative statistics（跌幅、幾個月回到原點、事件後報酬）. Those encode the causal
// assumption in their construction — a「事件後 12 個月最低點」column asserts the event caused the
// low without a single word of prose doing so. The page puts dated facts and a price line on one
// time axis and stops there, the same line /macro/policy-rate already holds.
//
// Coverage starts 1999 because that is where the index series does（/market/taiex-daily-price at
// monthly interval: 333 rows, 1999-01 → today）. Earlier declarations — the 1997 Asian financial
// crisis, the 1996 Taiwan Strait crisis — are left out rather than drawn as markers floating above
// no line.
export interface MarketEvent {
  // ISO date of the DECLARATION, not of any market move.
  date: string
  label: string
  // Who declared it, and what the declaration was. This is the citation; keep it specific enough
  // that a reader can search it and land on the primary source.
  source: string
}

// WHAT THE RULE THREW OUT, kept as evidence that it is doing work rather than decorating the page.
// Wikipedia's own 股災 list was read through for candidates（2026-09-22,「可以從wikipedia找找資料」）
// and most of its entries do not qualify, because they are named after a MARKET MOVE rather than
// after a declaration: 2000 網路泡沫（no single date）, 2015 中國股災, 2024-08-05 日本股災,
// 2025-04-07 台股單日最大跌點. Admitting those would be exactly the circularity this page avoids —
// marking the chart at the places the chart already dips.
//
// 2025-04-07 is the sharpest case. Taiwan fell 2,065 points（−9.7%）that day, the largest single-day
// point and percentage fall in its history, and it is NOT an entry here. What IS an entry is the US
// tariff announcement of 2025-04-02 that preceded it, because that has a declaration and a date.
// Taiwan's market was shut 4/3–4/6 for 兒童節與清明節 and reopened into the fall on 4/7 — a detail
// that makes the temptation clearer: the「obvious」marker is the crash, and the rule takes the
// announcement instead and says nothing about the link between them.
export const MARKET_EVENTS: MarketEvent[] = [
  // The source here is deliberately the TRADING SUSPENSION rather than the earthquake itself: a
  // 地震報告 is a declaration about the ground, while 財政部's announcement is a declaration about
  // this very market, which is as close to the subject as a citation on this page can get.
  { date: '1999-09-21', label: '921 集集大地震', source: '財政部宣布股市停止交易，9/27 恢復交易（證交所史上第三次非正常停盤）' },
  { date: '2001-09-11', label: '美國 911 事件', source: '美國政府當日宣告；紐約證交所停市至 9/17' },
  { date: '2003-03-12', label: 'SARS 全球警訊', source: '世界衛生組織（WHO）發布全球警訊' },
  { date: '2008-09-15', label: '雷曼兄弟聲請破產', source: '美國紐約南區破產法院第 11 章聲請文件' },
  { date: '2009-04-25', label: 'H1N1 列為國際關注公共衛生緊急事件', source: 'WHO 宣告 PHEIC' },
  { date: '2011-03-11', label: '日本東北大地震', source: '日本氣象廳地震報告' },
  { date: '2016-06-23', label: '英國脫歐公投', source: '英國選舉委員會公告結果' },
  { date: '2018-03-22', label: '美國對中國啟動 301 條款關稅', source: '美國總統備忘錄（Section 301）' },
  { date: '2020-01-30', label: 'COVID-19 列為國際關注公共衛生緊急事件', source: 'WHO 宣告 PHEIC' },
  { date: '2020-03-11', label: 'WHO 宣布 COVID-19 為全球大流行', source: 'WHO 總幹事聲明' },
  { date: '2022-02-24', label: '俄羅斯入侵烏克蘭', source: '聯合國安理會緊急會議紀錄；各國政府同日聲明' },
  { date: '2022-03-16', label: '美國聯準會啟動本輪升息循環', source: 'FOMC 會後聲明（2022 年 3 月 16 日）' },
  { date: '2023-05-05', label: 'WHO 解除 COVID-19 國際關注公共衛生緊急事件', source: 'WHO 總幹事聲明' },
  { date: '2025-04-02', label: '美國宣布「解放日」對等關稅', source: '美國總統 2025 年 4 月 2 日發布之行政命令' }
]

// Oldest first — the chart's own x-axis direction, and the order a timeline reads in.
export const MARKET_EVENTS_SORTED: MarketEvent[] = [...MARKET_EVENTS].sort((a, b) => a.date.localeCompare(b.date))
