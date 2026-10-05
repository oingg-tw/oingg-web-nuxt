// The one runnable check for app/utils/broker-trade-csv.ts. The fixture is SYNTHETIC — same 27-column
// shape as the real broker export, invented trades. Never paste a real export in here: it is a user's
// personal trading history.
//
// Run: node scripts/check-broker-trade-csv.mjs
import { acquisitionRows, decodeBrokerCsv, mergeAcquisitions, parseBrokerTradeCsv, preWindowLots, preWindowRows, splitShortfalls } from '../app/utils/broker-trade-csv.ts'

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

console.log('\n期初部位（先進先出倒推成本）')
{
  const t = (symbol, action, quantity, price, fee, date, brokerCost, ref, line) => ({ symbol, action, quantity, price, fee, tax: 0, tradeDate: date, brokerCost, externalRef: ref, line })
  // 2887F：匯出期間以前的 10,000 股是兩批不同成本，7/04、12/05 各賣 5,000
  const t2887 = [t('2887F', 'SELL', 5000, 45.8, 195, '2025-07-04', 228845, 'a', 2), t('2887F', 'SELL', 5000, 46.05, 196, '2025-12-05', 229146, 'b', 3)]
  const lots = preWindowLots([{ symbol: '2887F', tradeDate: '2025-07-04', externalRef: 'a', shortBy: 5000 }, { symbol: '2887F', tradeDate: '2025-12-05', externalRef: 'b', shortBy: 5000 }], t2887)
  assert(lots.length === 2 && lots[0].price === 45.769 && lots[1].price === 45.8292, '兩批各帶自己的成本（45.769、45.8292），不合成一個期初平均——逐筆才對得上券商')
  assert(lots.every(l => l.tradeDate === '2025-07-03' && l.externalRef.endsWith('|pre')), '期初買進記在最早交易日的前一天，先進先出最先賣掉')
  // 6592B：2024/11/18 買 1,000（含費 95,581），06/09 賣 1,000（券商成本 95,281），06/12 賣 2,000（190,862）；舊股票 2,000
  const t6592 = [t('6592B', 'BUY', 1000, 95.5, 81, '2024-11-18', null, 'p', 2), t('6592B', 'SELL', 1000, 97.7, 83, '2025-06-09', 95281, 'b', 3), t('6592B', 'SELL', 2000, 97.5, 166, '2025-06-12', 190862, 'c', 4)]
  const l6592 = preWindowLots([{ symbol: '6592B', tradeDate: '2025-06-12', externalRef: 'c', shortBy: 2000 }], t6592)
  assert(l6592.length === 2 && l6592[0].quantity === 1000 && l6592[0].price === 95.281 && l6592[1].quantity === 1000 && l6592[1].price === 95.281, '最先碰到舊股票的是 06/09 那筆（95.281）；06/12 那筆扣掉 2024/11/18 那批後，剩下的也是 95.281')
  // 4205 形狀：同一天三筆賣出，券商的配對順序跟列序不同 → 合成一天倒推
  const t4205 = [t('X', 'BUY', 1000, 87, 74, '2025-10-30', null, 'p', 2), t('X', 'SELL', 2000, 80, 0, '2025-12-22', 169145, 's1', 3), t('X', 'SELL', 200, 80, 0, '2025-12-22', 20517, 's2', 4), t('X', 'SELL', 1000, 80, 0, '2025-12-22', 102587, 's3', 5)]
  const l4205 = preWindowLots([{ symbol: 'X', tradeDate: '2025-12-22', externalRef: 's1', shortBy: 2200 }], t4205)
  assert(l4205.length === 1 && l4205[0].quantity === 2200 && l4205[0].price === Math.round((292249 - 87074) / 2200 * 1e4) / 1e4, '同一天的賣出合起來倒推：（那天券商成本合計 − 檔案內那批的成本）÷ 舊股票股數，那天與整檔的合計才對')
  assert(preWindowRows(l4205)[0].action === 'BUY' && preWindowRows(l4205)[0].fee === 0, '期初部位送成一般的買進列')
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
  assert(unknown.length === 2 && unknown.every(a => a.symbol === '5283' && a.quantity === 2000 && a.tradeDate === '2025-04-07' && a.externalRef.endsWith('|cost-unknown')), '券商沒成本的賣超 → 補成本不明的取得，股數＝shortBy，日期是該檔最早交易日的前一天（先進先出先賣它）')
  const rows = acquisitionRows(unknown, {})
  assert(rows.every(r => r.costUnknown === true && r.action === 'BUY' && r.price === 0 && r.fee === 0 && r.tax === 0), '沒填成本 → 成本不明（price 0、不帶費稅，bff-ts 規定）')
  assert(acquisitionRows(unknown, { 5283: 60 }).every(r => r.costUnknown === false && r.price === 60), '填了成本 → 一般買進')
  const merged = mergeAcquisitions(unknown, [{ symbol: '5283', tradeDate: '2025-04-08', quantity: 100, externalRef: 'a|1|cost-unknown' }])
  assert(merged.length === 2 && merged.find(a => a.externalRef === 'a|1|cost-unknown').quantity === 2100, '兩輪試算的取得：同一個 externalRef 股數相加，不重複送')
}

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
