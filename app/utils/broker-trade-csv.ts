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
// brokerCode 對到 GET /brokers 的證券商代號（analysis-ts 52fea794，證交所總公司名單；元大是 9800）。
export const BROKER_FORMATS = [
  { id: 'yuanta', brokerCode: '9800', label: '元大證券', source: 'yuanta-csv' }
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
  // CSV 的第幾行（1 起算），給預覽與錯誤訊息指出是哪一列；前端補的取得列是 0
  line: number
  // 只有前端補的「成本不明」取得列會帶 true（見 acquisitionRows）
  costUnknown?: boolean
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

// ---- bff-ts 回報賣超之後：匯出期間以前的部位 ----
//
// 成本法是**先進先出**（使用者 2026-10-05「比照券商就好」）。匯出期間以前持有、券商有成本的股票，最先被
// 賣掉；它們可能是好幾批不同成本的股票（2887F：7/04 賣的那批每股 45.769、12/05 那批 45.829），所以不能
// 合成「一檔一個期初部位」（bff-ts 的 openingPositions 一檔只有一個成本），那樣合計對、逐筆對不上券商。
//
// 做法：依先進先出走一遍該檔「券商有成本」的賣出，**以天為單位**，每一天碰到舊股票就補一批期初買進：
//   股數 ＝ 那天的賣出用到的舊股票股數（舊股票排在最前面，所以先用它）
//   每股成本 ＝（那天賣出的券商成本合計 − 同一天用到的、檔案內較早買進的成本）÷ 股數
// 以天而不是以筆：同一天的幾筆賣出，檔案裡的列序不是券商配對的順序。4205 在 12/22 賣了三筆，逐筆照列序推，
// 舊股票的成本會錯 1.5 萬（連這一檔的總損益都錯）；合成一天推，那天的合計與整檔合計都對，只有同一天幾筆之間
// 的分配可能跟券商不同——而績效的日期區間最細就是一天。
// 日期放在該檔最早交易日的前一天，externalRef 是那天第一筆賣出的加上 |pre（重匯時一樣去重）。
// 用使用者的真實檔案端到端驗算（先進先出、自動配股、同日先買後賣）：每天、每檔的已實現損益都對上券商損益欄。
//
// 舊股票的總股數 ＝ 該檔 shortBy 的**加總**（bff-ts 每筆賣超後夾成 0，每筆都是額外的缺口；起初照 bff 註解
// 取最大值，5314 同日兩筆賣超就少補了 628 股）。

interface Shortfall { symbol: string; tradeDate: string; externalRef: string; shortBy: number }

export interface PreWindowLot {
  symbol: string
  tradeDate: string
  quantity: number
  // 每股成本（含費用）
  price: number
  externalRef: string
}

export function preWindowLots(shortfalls: Shortfall[], trades: ImportedTrade[]): PreWindowLot[] {
  const missingBySymbol = new Map<string, number>()
  for (const item of shortfalls) missingBySymbol.set(item.symbol, (missingBySymbol.get(item.symbol) ?? 0) + item.shortBy)
  const lots: PreWindowLot[] = []
  for (const [symbol, missing] of missingBySymbol) {
    const tradeDate = dayBefore(earliestTradeDate(symbol, trades))
    const events = trades
      .filter(trade => trade.symbol === symbol && !(trade.action === 'SELL' && trade.brokerCost === null))
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate) || (a.action === b.action ? a.line - b.line : a.action === 'BUY' ? -1 : 1))
    const inFile: { quantity: number; perShare: number }[] = []
    let remaining = missing
    let lastSell: ImportedTrade | undefined
    for (let i = 0; i < events.length && remaining > 0; i++) {
      const trade = events[i]!
      if (trade.action === 'BUY') {
        inFile.push({ quantity: trade.quantity, perShare: (trade.quantity * trade.price + trade.fee) / trade.quantity })
        continue
      }
      // 同一天的賣出合在一起（events 已依日期排序、同日買在前，所以同日的賣出是連在一起的）
      const daySells = [trade]
      while (events[i + 1]?.action === 'SELL' && events[i + 1]!.tradeDate === trade.tradeDate) daySells.push(events[++i]!)
      lastSell = trade
      const dayQuantity = daySells.reduce((sum, sell) => sum + sell.quantity, 0)
      const dayBrokerCost = daySells.reduce((sum, sell) => sum + sell.brokerCost!, 0)
      const fromOld = Math.min(remaining, dayQuantity)
      let rest = dayQuantity - fromOld
      let knownCost = 0
      while (rest > 0 && inFile.length) {
        const lot = inFile[0]!
        const take = Math.min(lot.quantity, rest)
        knownCost += take * lot.perShare
        lot.quantity -= take
        rest -= take
        if (lot.quantity === 0) inFile.shift()
      }
      lots.push({ symbol, tradeDate, quantity: fromOld, price: Math.round(((dayBrokerCost - knownCost) / fromOld) * 1e4) / 1e4, externalRef: `${trade.externalRef}|pre` })
      remaining -= fromOld
    }
    // 理論上走不到：缺口一定來自券商有成本的賣出。萬一走到，用最後一筆賣出的價格補，不填 0。
    if (remaining > 0 && lastSell) lots.push({ symbol, tradeDate, quantity: remaining, price: lastSell.price, externalRef: `${lastSell.externalRef}|pre-rest` })
  }
  return lots
}

export function preWindowRows(lots: PreWindowLot[]): ImportedTrade[] {
  return lots.map(lot => ({ externalRef: lot.externalRef, tradeDate: lot.tradeDate, symbol: lot.symbol, action: 'BUY', quantity: lot.quantity, price: lot.price, fee: 0, tax: 0, brokerCost: null, line: 0 }))
}

// ---- bff-ts 回報賣超之後：分成「補期初」與「補成本不明的取得」 ----
//
// 除權配股由 bff-ts 依除權息行事曆在除權日自動入帳（a742fff），所以配股不會再出現在賣超清單裡。剩下的
// 賣超看那一筆賣出券商有沒有成本：
//   - 有 → 匯出期間以前買的部位，補期初買進，成本由券商成本倒推（preWindowLots）。
//   - 沒有 → 券商紀錄過期（例如 5283，使用者說是很久以前買的）、轉入、或匯出期間以前的配股。
//     在那筆賣出同一天補一筆「成本不明」的取得，股數＝shortBy；bff-ts 讓成本不明的股數先賣，所以剛好被
//     那筆賣出用掉，已實現損益不計入、報酬率當成以市值轉入（使用者 2026-10-05 選的處理）。使用者填了成本
//     就是一般的買進。
//
// 起初的做法是自己在前端補一筆「價格 0」的買進（externalRef 以 |acq 結尾），bff-ts 實測指出兩個副作用：
// 報酬率會把整筆賣出金額算成當天報酬（假暴漲），而且 0 成本會被平均進同檔成本已知的股數。

// 成本不明的取得代表「很久以前就有的股票」，記在該檔最早交易日的**前一天**：成本法是先進先出（使用者
// 2026-10-05「比照券商」），這樣它會最先被賣掉，跟券商把那幾筆賣出配到不明成本的股票上一致。記在賣出當天的話，
// 先進先出會先賣掉更早買進的那批，損益就配錯了。
function earliestTradeDate(symbol: string, trades: ImportedTrade[]): string {
  return trades.filter(trade => trade.symbol === symbol).map(trade => trade.tradeDate).sort()[0]!
}

function dayBefore(date: string): string {
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}

export function splitShortfalls<T extends Shortfall>(shortfalls: T[], trades: ImportedTrade[]): { known: T[]; unknown: Acquisition[] } {
  const known: T[] = []
  const unknown = new Map<string, Acquisition>()
  for (const item of shortfalls) {
    const sell = trades.find(trade => trade.externalRef === item.externalRef)
    if (!sell || sell.brokerCost !== null) {
      known.push(item)
      continue
    }
    const externalRef = `${item.externalRef}|cost-unknown`
    const existing = unknown.get(externalRef)
    if (existing) existing.quantity += item.shortBy
    else unknown.set(externalRef, { symbol: item.symbol, tradeDate: dayBefore(earliestTradeDate(item.symbol, trades)), quantity: item.shortBy, externalRef })
  }
  return { known, unknown: [...unknown.values()] }
}

export interface Acquisition {
  symbol: string
  tradeDate: string
  quantity: number
  externalRef: string
}

// 兩輪試算的取得要合併（同一個 externalRef 股數相加），不能重複送——bff-ts 會擋同批重複的 externalRef。
export function mergeAcquisitions(existing: Acquisition[], added: Acquisition[]): Acquisition[] {
  const merged = new Map(existing.map(item => [item.externalRef, { ...item }]))
  for (const item of added) {
    const row = merged.get(item.externalRef)
    if (row) row.quantity += item.quantity
    else merged.set(item.externalRef, { ...item })
  }
  return [...merged.values()]
}

// 送出的交易列：使用者填了成本 → 一般買進；沒填 → 成本不明（price 0、不帶費稅，bff-ts 規定）。
export function acquisitionRows(acquisitions: Acquisition[], costs: Record<string, number | null | undefined>): ImportedTrade[] {
  return acquisitions.map((item) => {
    const cost = costs[item.symbol]
    return { externalRef: item.externalRef, tradeDate: item.tradeDate, symbol: item.symbol, action: 'BUY', quantity: item.quantity, price: cost ?? 0, fee: 0, tax: 0, brokerCost: null, line: 0, costUnknown: cost == null }
  })
}

