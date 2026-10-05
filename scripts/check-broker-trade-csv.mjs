// The one runnable check for app/utils/broker-trade-csv.ts. The fixture is SYNTHETIC — same 27-column
// shape as the real broker export, invented trades. Never paste a real export in here: it is a user's
// personal trading history.
//
// Run: node scripts/check-broker-trade-csv.mjs
import { decodeBrokerCsv, parseBrokerTradeCsv } from '../app/utils/broker-trade-csv.ts'

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

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
