// The one runnable check for app/utils/broker-trade-csv.ts. The fixture is SYNTHETIC — same 27-column
// shape as the real broker export, invented trades. Never paste a real export in here: it is a user's
// personal trading history.
//
// Run: node scripts/check-broker-trade-csv.mjs
import { acquisitionRows, decodeBrokerCsv, mergeAcquisitions, mergeOpeningShortfalls, openingPositions, parseBrokerTradeCsv, splitShortfalls } from '../app/utils/broker-trade-csv.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const HEADER = ',成交日期,市場別,股票代號,股票名稱,交易種類,買賣別,交易類別,成交數量,成交價,價金,手續費,交易稅,應收付帳款,融資金額/融券保證金,自備款擔保品,融資券利息,融券手續費,標借費,利息代扣稅款,二代健保補充費,損益,報酬率,交割日,幣別,,'
const ZEROS = '0,0,0,0,0,0,0'
const row = (date, sym, kind, side, cls, q, p, amt, fee, tax, net, pnl, ref, currency = '台幣') =>
  `,  ${date},台股,${sym},名稱,${kind},${side},${cls},${q},${p},${amt},${fee},${tax},${net},${ZEROS},${pnl},,${date},${currency},名稱 ${cls} ${side},${ref}`

const fixture = [
  HEADER,
  row('2025/01/02', '1101', '普通', '買', '現股', '"1,000"', '40.00', '"40,000"', '34', '0', '"-40,034"', '0', 'A00010000'),
  ',  2025/01/02 小計,,,,,,,"1,000",40.00,"40,000",34,0,"-40,034",0,0,0,0,0,0,0,0,,,,,',
  row('2025/02/03', '1101', '普通', '賣', '現股', '"1,000"', '42.00', '"42,000"', '35', '126', '"41,839"', '"1,805"', 'A00010000'),
  row('2025/02/03', '9999A', '盤中零股', '賣', '現股', '50', '30.00', '"1,500"', '1', '4', '"1,495"', '"1,495"', 'B00020000'),
  row('2025/02/03', '2002', '普通', '買', '融資', '"1,000"', '20.00', '"20,000"', '17', '0', '"-8,017"', '0', 'C00030000'),
  ',[TWD台幣]總計：,,,,,,,,,"103,500",87,130,"-4,717",0,0,0,0,0,0,0,"3,300",,,,,'
].join('\r\n')

console.log('解析')
{
  const r = parseBrokerTradeCsv(fixture)
  assert(r.ok, '合成檔解析成功')
  const [buy, sell, oddLot] = r.trades
  assert(r.trades.length === 3, '小計、總計列不算成交（3 筆）')
  assert(buy.tradeDate === '2025-01-02' && buy.action === 'BUY' && buy.quantity === 1000 && buy.price === 40 && buy.fee === 34, '日期轉 ISO、千分位去掉、買進欄位正確')
  assert(buy.externalRef !== sell.externalRef, '同一個委託書號在不同日期 → 不同 externalRef（實測券商會跨日重用）')
  assert(sell.tax === 126 && sell.brokerCost === 41839 - 1805, '賣出：交易稅、券商成本＝應收付−損益')
  assert(oddLot.brokerCost === null, '損益等於應收付全額（券商成本 0）→ brokerCost 是 null，不是 0')
  assert(r.skipped.length === 1 && r.skipped[0].reason.includes('融資'), '融資列被跳過並說明原因，不是默默丟掉')
}

console.log('\n拒絕')
{
  const shifted = fixture.replace('"-40,034"', '"-40,000"')
  const r = parseBrokerTradeCsv(shifted)
  assert(!r.ok && r.error.includes('應收付'), '應收付對不上 → 整份拒絕（欄位可能錯位）')
}
{
  const r = parseBrokerTradeCsv(fixture.replace('"40,000",34', '"41,000",34'))
  assert(!r.ok && r.error.includes('價金'), '價金不等於股數×成交價 → 整份拒絕')
}
{
  const r = parseBrokerTradeCsv(fixture.replace('A00010000\r\n', '\r\n'))
  assert(!r.ok && r.error.includes('委託書號'), '沒有委託書號 → 整份拒絕（無法去重）')
}
{
  const r = parseBrokerTradeCsv('date,symbol\n2025-01-01,2330')
  assert(!r.ok, '不認得的格式 → 拒絕')
}
{
  const r = parseBrokerTradeCsv(fixture.replace(',損益,', ',盈虧,'))
  assert(!r.ok && r.error.includes('損益'), '缺欄位時錯誤訊息說出缺哪一欄')
}

console.log('\n編碼')
{
  const big5 = Uint8Array.from(Buffer.from('a6a8a5e6a4e9b4c12caad1b2bca54eb8b9', 'hex'))
  assert(decodeBrokerCsv(big5) === '成交日期,股票代號', 'Big5 原檔解得出來')
  assert(decodeBrokerCsv(Uint8Array.from([0xEF, 0xBB, 0xBF, ...Buffer.from('成交日期')])) === '成交日期', 'UTF-8 BOM（Excel 另存）去掉 BOM')
}

console.log('\n期初部位')
{
  const trades = [
    { externalRef: 'd1|S1', symbol: '1101', quantity: 1000, price: 42, brokerCost: 40250 },
    { externalRef: 'd2|S2', symbol: '1101', quantity: 500, price: 45, brokerCost: 20000 },
    { externalRef: 'd3|S3', symbol: '2002', quantity: 300, price: 27.75, brokerCost: null }
  ]
  const rows = mergeOpeningShortfalls([], [
    { symbol: '1101', tradeDate: '2025-03-01', externalRef: 'd1|S1', shortBy: 1000 },
    { symbol: '1101', tradeDate: '2025-04-01', externalRef: 'd2|S2', shortBy: 500 },
    { symbol: '2002', tradeDate: '2025-05-01', externalRef: 'd3|S3', shortBy: 300 }
  ], trades)
  const a = rows.find(r => r.symbol === '1101')
  const b = rows.find(r => r.symbol === '2002')
  assert(rows.length === 2 && a.quantity === 1500, '同一檔的 shortBy 相加（1000＋500），不是取最大值——bff-ts 每筆賣超後夾成 0，取最大會少補')
  assert(a.averageCost === 40.17 && a.fromBroker && a.shortfallCount === 2 && a.shortfallDate === '2025-03-01', '成本＝幾筆賣超的券商成本合計 ÷ 股數合計：60,250 ÷ 1,500 = 40.17；標出最早日期與筆數')
  assert(b.averageCost === undefined && !b.fromBroker, '券商沒有成本資料 → 留空，不填 0')
  assert(a.soldPrice === 43 && b.soldPrice === 27.75, '賣出加權均價（全部賣出時當期初成本）：(42×1000＋45×500)÷1500 = 43')
  a.averageCost = 39
  const again = mergeOpeningShortfalls(rows, [{ symbol: '1101', tradeDate: '2025-04-01', externalRef: 'd2|S2', shortBy: 200 }], trades)
  const a2 = again.find(r => r.symbol === '1101')
  assert(a2.quantity === 1700 && a2.averageCost === 39, '再試算仍不夠：缺口加到已填股數上，保留使用者改過的成本')
  assert(a.quantity === 1500, '不改動傳入的列（回傳新陣列）')
  const mixed = mergeOpeningShortfalls([], [
    { symbol: '5314', tradeDate: '2026-09-17', externalRef: 'd1|S1', shortBy: 12000 },
    { symbol: '5314', tradeDate: '2026-09-17', externalRef: 'd3|S3', shortBy: 628 }
  ], trades.map(t => ({ ...t, symbol: '5314' })))
  assert(mixed[0].quantity === 12628 && mixed[0].averageCost === undefined, '其中一筆券商沒有成本 → 股數照樣相加（12,628），成本留空不推算')
}

console.log('\n成本不明的取得')
{
  const sell = (symbol, quantity, date, brokerCost, ref) => ({ symbol, action: 'SELL', quantity, tradeDate: date, brokerCost, price: 10, fee: 1, tax: 1, externalRef: ref })
  const trades = [sell('5283', 2000, '2025-04-08', null, 'a|1'), sell('5283', 2000, '2025-04-08', null, 'a|2'), sell('8112A', 8000, '2025-01-13', 343493, 'b|1')]
  const { known, unknown } = splitShortfalls([
    { symbol: '5283', tradeDate: '2025-04-08', externalRef: 'a|1', shortBy: 2000 },
    { symbol: '5283', tradeDate: '2025-04-08', externalRef: 'a|2', shortBy: 2000 },
    { symbol: '8112A', tradeDate: '2025-01-13', externalRef: 'b|1', shortBy: 8000 }
  ], trades)
  assert(known.length === 1 && known[0].symbol === '8112A', '券商有成本的賣超 → 補期初部位')
  assert(unknown.length === 2 && unknown.every(a => a.symbol === '5283' && a.quantity === 2000 && a.externalRef.endsWith('|cost-unknown')), '券商沒成本的賣超 → 在那筆賣出同一天補成本不明的取得，股數＝shortBy')
  const rows = acquisitionRows(unknown, {})
  assert(rows.every(r => r.costUnknown === true && r.action === 'BUY' && r.price === 0 && r.fee === 0 && r.tax === 0), '沒填成本 → 成本不明（price 0、不帶費稅，bff-ts 規定）')
  assert(acquisitionRows(unknown, { 5283: 60 }).every(r => r.costUnknown === false && r.price === 60), '填了成本 → 一般買進')
  const merged = mergeAcquisitions(unknown, [{ symbol: '5283', tradeDate: '2025-04-08', quantity: 100, externalRef: 'a|1|cost-unknown' }])
  assert(merged.length === 2 && merged.find(a => a.externalRef === 'a|1|cost-unknown').quantity === 2100, '兩輪試算的取得：同一個 externalRef 股數相加，不重複送')
  const payload = openingPositions([{ symbol: '8112A', quantity: 8000, averageCost: 42.94, soldPrice: 44 }, { symbol: '2330', quantity: 100, averageCost: undefined, soldPrice: 600 }])
  assert(payload[0].averageCost === 42.94 && payload[1].averageCost === 600, '期初部位用券商成本；券商沒成本時用賣出均價')
}

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
