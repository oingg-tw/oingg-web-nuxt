// 券商「成交明細」CSV → 正規化的交易列。只在瀏覽器裡跑：原始檔案不上傳，送給 bff-ts 的只有解析後的列。
//
// 零 import，讓 scripts/check-broker-trade-csv.mjs 能直接 import（同 holdings-summary.ts 的理由）。
//
// 支援的格式只有一種：**元大證券**的成交明細匯出檔（2026-10-05 使用者提供；Big5、27 欄、每日一列
// 「小計」、最後一列「[TWD台幣]總計」）。實測那一份 120 筆成交：價金＝股數×成交價、應收付＝±(價金∓費稅) 全部
// 對得上，所以下面把這兩條當成「格式沒變」的檢查——對不上就整份拒絕，不猜。
//
// 三件從那份檔案量出來、會影響下游的事：
//   1. **委託書號單獨不唯一**（120 筆裡 6 個重複，跨日重用），日期＋委託書號才唯一 → externalRef。
//   2. **券商成本 0 ＝ 券商不知道成本**，不是成本 0：配股、增資、匯出期間以前買的股票，賣出時損益
//      等於應收付全額。所以 brokerCost 在那種情況是 null，不是 0。
//   3. 同一天內的列序**不是**成交順序（同日先賣後買的部位，檔案裡排成先買後賣）。誰先誰後交給 bff-ts
//      的重算規則決定，這裡照檔案順序送。

// 匯入要分券商（使用者 2026-10-05）：`source` 是 bff-ts 去重的命名空間，兩家券商的「日期＋委託書號」
// 可能相同，共用一個 source 會把另一家的交易當成重複而略過。bff-ts 的 source 有白名單，加一家要先跟
// 對方說。加第二家時，在這裡加一列，並為它寫自己的解析函式。
export const BROKER_FORMATS = [
  { id: 'yuanta', label: '元大證券', source: 'yuanta-csv' }
] as const

export type BrokerFormat = (typeof BROKER_FORMATS)[number]

export interface ImportedTrade {
  // 日期＋委託書號；bff-ts 用它去重，同一份檔案重匯不會重複記
  externalRef: string
  tradeDate: string // YYYY-MM-DD
  symbol: string
  action: 'BUY' | 'SELL'
  quantity: number
  price: number
  fee: number
  tax: number
  // 只有賣出有：券商自己記的這批股票成本（應收付 − 損益）。null ＝ 券商沒有成本資料。
  // 用途只有一個：bff-ts 回報「賣超」時，預填期初部位的成本建議。
  brokerCost: number | null
  // CSV 的第幾行（1 起算），給預覽與錯誤訊息指出是哪一列
  line: number
}

export interface SkippedRow {
  line: number
  reason: string
}

export type BrokerCsvResult =
  | { ok: true; trades: ImportedTrade[]; skipped: SkippedRow[] }
  | { ok: false; error: string }

const REQUIRED_COLUMNS = ['成交日期', '股票代號', '買賣別', '交易類別', '成交數量', '成交價', '價金', '手續費', '交易稅', '應收付帳款', '損益', '幣別'] as const

// BOM → UTF-8；否則先嚴格試 UTF-8（有人用 Excel 另存過），失敗才當 Big5（券商原檔）。
export function decodeBrokerCsv(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (view[0] === 0xEF && view[1] === 0xBB && view[2] === 0xBF) return new TextDecoder('utf-8').decode(view.subarray(3))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(view)
  } catch {
    return new TextDecoder('big5').decode(view)
  }
}

// RFC 4180 的最小子集：雙引號包欄位、"" 跳脫。這個格式沒有欄位內換行，所以逐行切。
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { cells.push(cell); cell = '' }
    else cell += ch
  }
  cells.push(cell)
  return cells
}

function toNumber(raw: string | undefined): number {
  const text = (raw ?? '').replace(/,/g, '').trim()
  return text === '' ? Number.NaN : Number(text)
}

export function parseBrokerTradeCsv(text: string): BrokerCsvResult {
  const lines = text.split(/\r?\n/)
  const headerIndex = lines.findIndex(line => line.includes('成交日期') && line.includes('股票代號'))
  if (headerIndex === -1) return { ok: false, error: '看不出這是哪一種成交明細：找不到「成交日期」「股票代號」欄位' }

  const header = splitCsvLine(lines[headerIndex]!).map(cell => cell.trim())
  const col = Object.fromEntries(REQUIRED_COLUMNS.map(name => [name, header.indexOf(name)])) as Record<(typeof REQUIRED_COLUMNS)[number], number>
  const missing = REQUIRED_COLUMNS.filter(name => col[name] === -1)
  if (missing.length) return { ok: false, error: `成交明細缺少欄位：${missing.join('、')}` }
  // 委託書號那一欄**沒有標題**，固定是最後一欄。ponytail: 位置推定；券商改版加欄就會錯，
  // 所以下面「沒有委託書號」會整份拒絕，而不是默默用別的欄位。
  const refColumn = header.length - 1

  const trades: ImportedTrade[] = []
  const skipped: SkippedRow[] = []

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = i + 1
    if (!lines[i]!.trim()) continue
    const cells = splitCsvLine(lines[i]!)
    const symbol = (cells[col.股票代號] ?? '').trim()
    // 「小計」「總計」列沒有股票代號
    if (!symbol) continue

    if (cells[col.交易類別]?.trim() !== '現股') {
      skipped.push({ line, reason: `${cells[col.交易類別]?.trim() || '未標示'}交易暫不支援，只匯入現股` })
      continue
    }
    if (cells[col.幣別]?.trim() !== '台幣') {
      skipped.push({ line, reason: `${cells[col.幣別]?.trim() || '未標示'}計價的交易暫不支援` })
      continue
    }

    const date = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec((cells[col.成交日期] ?? '').trim())
    const side = cells[col.買賣別]?.trim()
    const quantity = toNumber(cells[col.成交數量])
    const price = toNumber(cells[col.成交價])
    const amount = toNumber(cells[col.價金])
    const fee = toNumber(cells[col.手續費])
    const tax = toNumber(cells[col.交易稅])
    const net = toNumber(cells[col.應收付帳款])
    const pnl = toNumber(cells[col.損益])
    const ref = (cells[refColumn] ?? '').trim()

    const where = `第 ${line} 行（${symbol}）`
    if (!date) return { ok: false, error: `${where}的成交日期看不懂` }
    if (side !== '買' && side !== '賣') return { ok: false, error: `${where}的買賣別不是「買」或「賣」` }
    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: `${where}的成交數量不是正整數` }
    if (![price, amount, fee, tax, net].every(Number.isFinite) || price < 0) return { ok: false, error: `${where}有欄位不是數字` }
    if (!ref) return { ok: false, error: `${where}沒有委託書號，無法避免重複匯入` }
    // 兩條算術檢查＝「欄位沒有錯位」的證據。容許 1 元：價金是券商四捨五入過的整數。
    if (Math.abs(quantity * price - amount) > 1) return { ok: false, error: `${where}的價金不等於股數×成交價，檔案格式可能改了` }
    const expectedNet = side === '買' ? -(amount + fee) : amount - fee - tax
    if (Math.abs(expectedNet - net) > 1) return { ok: false, error: `${where}的應收付金額對不上手續費與交易稅，檔案格式可能改了` }

    const tradeDate = `${date[1]}-${date[2]}-${date[3]}`
    const cost = side === '賣' && Number.isFinite(pnl) ? net - pnl : null
    trades.push({
      externalRef: `${tradeDate}|${ref}`,
      tradeDate,
      symbol,
      action: side === '買' ? 'BUY' : 'SELL',
      quantity,
      price,
      fee,
      tax,
      brokerCost: cost !== null && cost > 0 ? cost : null,
      line
    })
  }

  if (!trades.length && !skipped.length) return { ok: false, error: '檔案裡沒有任何成交紀錄' }
  return { ok: true, trades, skipped }
}

// ---- bff-ts 回報賣超之後：期初部位的列 ----

export interface OpeningRow {
  symbol: string
  quantity: number
  // 券商記錄的成本（每股）；undefined ＝ 券商沒有成本資料
  averageCost: number | undefined
  // 成本是否由券商的「應收付 − 損益」推算；false ＝ 券商沒有成本資料，使用者要自己填
  fromBroker: boolean
  // 第一次賣超的那筆賣出：提示要指名是哪一批股票（2026-10-05 使用者看到同一檔較早的買進價 81.5、
  // 以為券商有成本——那批早已賣掉，缺成本的是後來另一批）
  shortfallDate: string
  // 這一檔有幾筆賣出是賣超的
  shortfallCount: number
  // 那幾筆賣超的加權平均成交價。券商沒有成本時拿它當期初成本（期初部位不問使用者，理由見
  // HoldingsImportDialog.vue）——比填 0 中性：已實現損益約等於 0（只差費稅），而不是把整筆賣出金額灌成獲利。
  soldPrice: number
}

interface Shortfall { symbol: string; tradeDate: string; externalRef: string; shortBy: number }

// 同一檔有多筆賣超時把 shortBy **相加**。bff-ts（holdingProjection.ts）在每一筆賣超之後把持股夾成 0，
// 下一筆的 shortBy 從 0 起算，所以每一筆都是「額外」缺的股數，加總正好是最少要補的期初股數。
// 2026-10-05 起初照 bff-ts 註解寫的「取最大值、不要相加」實作，使用者的真實檔案馬上露餡：5314 在
// 同一天賣 12,000 股與零股 628 股，兩筆都賣超，取最大值只補 12,000、少了 628。
//
// 已經有列的代號（再試算仍不夠）把新缺口加到已填的股數上，保留使用者填的成本。
// 預填成本＝這幾筆賣超的券商成本合計 ÷ 股數合計，四捨五入到分；**只要有一筆券商沒有成本資料就留空**，
// 絕不填 0（0 在 bff-ts 是「真的零成本」，會把已實現損益灌水）。
export function mergeOpeningShortfalls(existing: OpeningRow[], shortfalls: Shortfall[], trades: ImportedTrade[]): OpeningRow[] {
  const bySymbol = new Map<string, Shortfall[]>()
  for (const item of shortfalls) bySymbol.set(item.symbol, [...(bySymbol.get(item.symbol) ?? []), item])
  const next = existing.map(row => ({ ...row }))
  for (const [symbol, items] of bySymbol) {
    const missing = items.reduce((sum, item) => sum + item.shortBy, 0)
    const row = next.find(candidate => candidate.symbol === symbol)
    if (row) {
      row.quantity = (row.quantity ?? 0) + missing
      continue
    }
    const sells = items.map(item => trades.find(trade => trade.externalRef === item.externalRef))
    const known = sells.every(sell => sell && sell.brokerCost !== null)
    const cost = known ? sells.reduce((sum, sell) => sum + sell!.brokerCost!, 0) : 0
    const shares = known ? sells.reduce((sum, sell) => sum + sell!.quantity, 0) : 0
    const perShare = known && shares > 0 ? Math.round((cost / shares) * 100) / 100 : undefined
    const dates = items.map(item => item.tradeDate).sort()
    const priced = sells.filter((sell): sell is ImportedTrade => sell !== undefined)
    const pricedShares = priced.reduce((sum, sell) => sum + sell.quantity, 0)
    const soldPrice = pricedShares > 0 ? Math.round((priced.reduce((sum, sell) => sum + sell.price * sell.quantity, 0) / pricedShares) * 100) / 100 : 0
    next.push({ symbol, quantity: missing, averageCost: perShare, fromBroker: perShare !== undefined, shortfallDate: dates[0]!, shortfallCount: items.length, soldPrice })
  }
  return next
}

// ---- 取得成本不明的股票（使用者 2026-10-05：「不知道成本的股票讓用戶選擇要不要填入取得成本，不填入就
// 不計入交易，不要因為這個阻擋用戶直接匯入」） ----
//
// 「不明」以券商自己的配對為準：一筆賣出的損益等於整筆應收付（brokerCost null），代表券商把**整筆**
// 賣出配到它不知道成本的股票上（配股、增資認購、轉入、或匯出期間以前的部位）。所以沒填成本時，把那
// 幾筆賣出整筆拿掉，等於那批股票的進出一起不算：庫存不變，其他交易不受影響。填了成本，就用那幾筆
// 賣出的股數合計當期初股數。

export interface UnknownCostLot {
  symbol: string
  // 這一檔「券商不知道成本」的賣出股數合計＝填了成本時的期初股數
  quantity: number
  firstDate: string
  count: number
}

export function unknownCostLots(trades: ImportedTrade[]): UnknownCostLot[] {
  const lots = new Map<string, UnknownCostLot>()
  for (const trade of trades) {
    if (trade.action !== 'SELL' || trade.brokerCost !== null) continue
    const lot = lots.get(trade.symbol)
    if (lot) {
      lot.quantity += trade.quantity
      lot.count += 1
      if (trade.tradeDate < lot.firstDate) lot.firstDate = trade.tradeDate
    } else lots.set(trade.symbol, { symbol: trade.symbol, quantity: trade.quantity, firstDate: trade.tradeDate, count: 1 })
  }
  return [...lots.values()].sort((a, b) => a.symbol.localeCompare(b.symbol))
}

// 要送出的交易：沒填成本的那幾檔，拿掉它們「券商不知道成本」的賣出。
export function tradesToImport(trades: ImportedTrade[], costs: Record<string, number | null | undefined>): ImportedTrade[] {
  return trades.filter(trade => !(trade.action === 'SELL' && trade.brokerCost === null && costs[trade.symbol] == null))
}

// 送給 bff-ts 的期初部位：使用者填了成本的不明批次，加上 bff-ts 回報賣超後自動補的（成本來自券商）。
// 同一檔兩種都有時合併成一列，成本按股數加權。
export function openingPositions(lots: UnknownCostLot[], costs: Record<string, number | null | undefined>, auto: OpeningRow[]): { symbol: string; quantity: number; averageCost: number }[] {
  const merged = new Map<string, { quantity: number; total: number }>()
  const add = (symbol: string, quantity: number, cost: number) => {
    const row = merged.get(symbol) ?? { quantity: 0, total: 0 }
    row.quantity += quantity
    row.total += quantity * cost
    merged.set(symbol, row)
  }
  for (const lot of lots) {
    const cost = costs[lot.symbol]
    if (cost != null) add(lot.symbol, lot.quantity, cost)
  }
  for (const row of auto) add(row.symbol, row.quantity, row.averageCost ?? row.soldPrice)
  return [...merged].map(([symbol, row]) => ({ symbol, quantity: row.quantity, averageCost: Math.round((row.total / row.quantity) * 1e4) / 1e4 }))
}
