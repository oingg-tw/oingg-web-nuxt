// 券商「成交明細」CSV → 正規化的交易列。只在瀏覽器裡跑：原始檔案不上傳，送給 bff-ts 的只有解析後的列。
//
// 零 import，讓 scripts/check-broker-trade-csv.mjs 能直接 import（同 holdings-summary.ts 的理由）。
//
// 支援的格式只有一種：2026-10-05 使用者提供的券商匯出檔（Big5、27 欄、每日一列「小計」、
// 最後一列「[TWD台幣]總計」）。實測那一份 120 筆成交：價金＝股數×成交價、應收付＝±(價金∓費稅) 全部
// 對得上，所以下面把這兩條當成「格式沒變」的檢查——對不上就整份拒絕，不猜。
//
// 三件從那份檔案量出來、會影響下游的事：
//   1. **委託書號單獨不唯一**（120 筆裡 6 個重複，跨日重用），日期＋委託書號才唯一 → externalRef。
//   2. **券商成本 0 ＝ 券商不知道成本**，不是成本 0：配股、增資、匯出期間以前買的股票，賣出時損益
//      等於應收付全額。所以 brokerCost 在那種情況是 null，不是 0。
//   3. 同一天內的列序**不是**成交順序（同日先賣後買的部位，檔案裡排成先買後賣）。誰先誰後交給 bff-ts
//      的重算規則決定，這裡照檔案順序送。

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
  // el-input-number 清空時是 null
  quantity: number | null | undefined
  averageCost: number | null | undefined
  // 成本是否由券商的「應收付 − 損益」推算；false ＝ 券商沒有成本資料，使用者要自己填
  fromBroker: boolean
}

interface Shortfall { symbol: string; externalRef: string; shortBy: number }

// 同一檔有多筆賣超時取**最大**的 shortBy：bff-ts 的後面幾筆是在前一筆已夾成 0 的前提下算的，相加會多算。
// 已經有列的代號（再試算仍不夠）把新缺口加到已填的股數上，保留使用者填的成本。
// 預填成本＝那筆賣出的券商成本 ÷ 股數，四捨五入到分；券商沒有成本資料就留空，絕不填 0
// （0 在 bff-ts 是「真的零成本」，會把已實現損益灌水）。
export function mergeOpeningShortfalls(existing: OpeningRow[], shortfalls: Shortfall[], trades: ImportedTrade[]): OpeningRow[] {
  const worst = new Map<string, Shortfall>()
  for (const item of shortfalls) {
    const current = worst.get(item.symbol)
    if (!current || item.shortBy > current.shortBy) worst.set(item.symbol, item)
  }
  const next = existing.map(row => ({ ...row }))
  for (const [symbol, item] of worst) {
    const row = next.find(candidate => candidate.symbol === symbol)
    if (row) {
      row.quantity = (row.quantity ?? 0) + item.shortBy
      continue
    }
    const sell = trades.find(trade => trade.externalRef === item.externalRef)
    const perShare = sell && sell.brokerCost !== null ? Math.round((sell.brokerCost / sell.quantity) * 100) / 100 : undefined
    next.push({ symbol, quantity: item.shortBy, averageCost: perShare, fromBroker: perShare !== undefined })
  }
  return next
}
