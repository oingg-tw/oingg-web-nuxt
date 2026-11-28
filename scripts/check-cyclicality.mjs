// 景氣循環度（app/utils/cyclicality.ts）：答句、四項特徵的句子、沒有分數時的句子、年度營業利益率與趨勢線的座標。
// 三家是 DEV 的真資料（2026-11-28，資料日期 2026-11-26）加上 v4 的 points（年度營業利益率）與 sector（數據中台的試算值）。
// Run: node scripts/check-cyclicality.mjs（pnpm selfcheck 會跑）
import assert from 'node:assert/strict'
import { formatMoney } from '../shared/utils/number-format.ts'
import { cappedPoint, marginBounds } from '../app/utils/margin-cap.ts'

Object.assign(globalThis, { formatMoney, marginBounds, cappedPoint })
const { CYCLICALITY_ITEMS, cyclicalityAnswer, cyclicalityItemNullText, cyclicalityItems, cyclicalityMissingText, cyclicalityRows, cyclicalitySector, cyclicalitySectorText, cyclicalityTrend, cyclicalityTrendCaption, cyclicalityTrendLabel } = await import('../app/utils/cyclicality.ts')

const NAMES = { 15: { name: '航運業' }, 24: { name: '半導體業' }, 27: { name: '通信網路業' } }
const years = (from, values) => values.map((value, index) => ({ fiscalYear: from + index, value }))

const wanHai = {
  symbol: '2615', asOf: '2026-11-26', value: 99.4, nullReason: null,
  sector: { code: '15', name: '航運業', companies: 29, median: 51 },
  profitSwing: {
    percentile: 85.49, nullReason: null, fromYear: 2016, toYear: 2025, years: 10,
    operatingMargin: { serMeanPct: 110.03, ser: 19.76, mean: 17.96, highest: { fiscalYear: 2021, value: 56 }, lowest: { fiscalYear: 2023, value: -6.29 }, trendStart: { fiscalYear: 2016, value: 4.53 }, trendEnd: { fiscalYear: 2025, value: 31.39 }, percentile: 69.51, points: years(2016, [3.27, 5.17, 1.48, 3.91, 15.61, 56, 45.54, -6.29, 31.23, 23.66]) },
    grossMargin: { serMeanPct: 82.36, ser: 18.95, mean: 23.01, percentile: 91.54 }
  },
  peakDecline: {
    percentile: 88.42, nullReason: null, quarters: 40,
    revenue: { peak: { fiscalYear: 2022, fiscalQuarter: 2, value: 297000824 }, trough: { fiscalYear: 2023, fiscalQuarter: 4, value: 100220040 }, drawdownPct: 66.26, percentile: 83.68 },
    operatingMargin: { peak: { fiscalYear: 2022, fiscalQuarter: 2, value: 59.06 }, trough: { fiscalYear: 2023, fiscalQuarter: 4, value: -6.29 }, declinePp: 65.35, percentile: 88.87 }
  },
  peerComovement: { percentile: 96.75, nullReason: null, months: 120, sectorCode: '15', sector: { correlation: 0.7447, peers: 33, percentile: 92.25 }, market: { correlation: 0.7919, peers: 1847, percentile: 98.25 } },
  heavyAssets: { percentile: 95.97, nullReason: null, fiscalYear: 2026, fiscalQuarter: 3, ratio: 45.22, ratioPercentile: 88.94, turnover: { swingPct: 77.64, highest: { fiscalYear: 2021, value: 3.33 }, lowest: { fiscalYear: 2023, value: 0.75 }, percentile: 79.46 } }
}
const chunghwa = {
  symbol: '2412', asOf: '2026-11-26', value: 0.6, nullReason: null,
  sector: { code: '27', name: null, companies: 86, median: 51 },
  profitSwing: {
    percentile: 0.33, nullReason: null, fromYear: 2016, toYear: 2025,
    operatingMargin: { ser: 0.6, mean: 20.64, trendStart: { fiscalYear: 2016, value: 20.49 }, trendEnd: { fiscalYear: 2025, value: 20.78 }, percentile: 0.07, points: years(2016, [20.92, 20.53, 20.25, 19.59, 20.4, 21.35, 21.6, 20.77, 20.38, 20.56]) },
    grossMargin: { ser: 0.84, mean: 35.73, percentile: 1.73 }
  },
  peakDecline: {
    percentile: 2.63, nullReason: null,
    revenue: { peak: { fiscalYear: 2016, fiscalQuarter: 4, value: 229991428 }, trough: { fiscalYear: 2020, fiscalQuarter: 2, value: 202038588 }, drawdownPct: 12.15, percentile: 9.67 },
    operatingMargin: { peak: { fiscalYear: 2022, fiscalQuarter: 3, value: 21.63 }, trough: { fiscalYear: 2024, fiscalQuarter: 3, value: 20.17 }, declinePp: 1.47, percentile: 1.94 }
  },
  peerComovement: { percentile: 68.9, nullReason: null, months: 120, sectorCode: '27', sector: { correlation: 0.5223, peers: 91, percentile: 70.64 }, market: { correlation: 0.4014, percentile: 61.69 } },
  heavyAssets: { percentile: 0.34, nullReason: null, fiscalYear: 2026, fiscalQuarter: 3, ratio: 53.01, ratioPercentile: 94.01, turnover: { swingPct: 11.28, highest: { fiscalYear: 2025, value: 0.82 }, lowest: { fiscalYear: 2019, value: 0.72 }, percentile: 0.13 } }
}

// 四項的順序與名稱固定；百分位照資料
assert.deepEqual(CYCLICALITY_ITEMS.map(item => item.label), ['獲利起伏', '高點回落', '同業連動', '重資產'])
assert.deepEqual(cyclicalityItems(wanHai).map(item => [item.label, item.percentile]), [['獲利起伏', 85.49], ['高點回落', 88.42], ['同業連動', 96.75], ['重資產', 95.97]])
assert.deepEqual(cyclicalityItems(null).map(item => item.percentile), [null, null, null, null])

// 位置條上的產業參照：名稱照回應，回應沒給就用網站的類股名稱；家數或中位數沒有（不到 5 家、沒有分數）不畫
const shipping = cyclicalitySector(wanHai, NAMES)
assert.deepEqual(shipping, { name: '航運業', companies: 29, median: 51 })
assert.equal(cyclicalitySectorText(shipping), '航運業 29 家的中位數 51')
assert.deepEqual(cyclicalitySector(chunghwa, NAMES), { name: '通信網路業', companies: 86, median: 51 })
assert.equal(cyclicalitySector({ value: 50, sector: { code: '33', name: '農業科技業', companies: 4, median: null } }, NAMES), null)
assert.equal(cyclicalitySector({ value: null, sector: null }, NAMES), null)
assert.equal(cyclicalitySector({ value: 50 }, NAMES), null)

// 答句：位置、產業的中位數、四項裡最高與最低；至多 80 字
const answer = cyclicalityAnswer('萬海', wanHai, shipping)
assert.equal(answer, '萬海的景氣循環度是百分位 99；航運業有分數的 29 家，中位數是 51。四項特徵裡同業連動最高（97），獲利起伏最低（85）。')
assert.equal(cyclicalityAnswer('中華電', chunghwa, null), '中華電的景氣循環度是百分位 1。四項特徵裡同業連動最高（69），獲利起伏最低（0）。')
// 名稱與產業都很長、又有一項算不出來：先拿掉產業那一句
const long = cyclicalityAnswer('台灣高鐵公司', { ...wanHai, heavyAssets: { percentile: null, nullReason: 'missing_input' } }, { name: '電腦及週邊設備業', companies: 161, median: 51 })
assert.ok(long.length <= 80, long)
assert.ok(!long.includes('中位數') && long.endsWith('重資產算不出來。'), long)
for (const text of [answer, long]) assert.ok(text.length <= 80, `${text.length} 字：${text}`)
// 沒有分數：寫原因（哪些公司不適用、要幾年），不寫「目前沒有」
assert.equal(cyclicalityAnswer('國泰金', { value: null, nullReason: 'not_applicable_industry' }, null), '金融保險業、建材營造業，以及用異業合併格式申報財報的公司，不適用景氣循環度。')
assert.equal(cyclicalityMissingText('insufficient_history'), '財報未滿 8 年，算不出景氣循環度。')
assert.equal(cyclicalityMissingText('not_in_universe'), '景氣循環度只算上市櫃的普通股，這一檔不在比較範圍裡。')
assert.equal(cyclicalityMissingText('something_new'), '要用的財報數字不齊，目前算不出景氣循環度。')
assert.equal(cyclicalityItemNullText('insufficient_history'), '歷史資料不夠長')
assert.equal(cyclicalityItemNullText('something_new'), '')

// 頁面的表：每一項底下兩個數字，各有自己的百分位
const rows = cyclicalityRows(wanHai, NAMES)
assert.deepEqual(rows.map(row => [row.label, row.note, row.measures.map(measure => [measure.text, measure.percentile])]), [
  ['獲利起伏', '2016～2025 年', [
    ['年度營業利益率平均 17.96%，每年通常偏離趨勢線 19.76 個百分點', 69.51],
    ['年度毛利率平均 23.01%，每年通常偏離趨勢線 18.95 個百分點', 91.54]
  ]],
  ['高點回落', '', [
    ['近四季合計營收從 2,970億元（2022 Q2）跌到 1,002億元（2023 Q4），跌 66.26%', 83.68],
    ['近四季營業利益率從 59.06%（2022 Q2）掉到 −6.29%（2023 Q4），少 65.35 個百分點', 88.87]
  ]],
  ['同業連動', '近 120 個月，近三個月營收的年增率', [
    ['跟航運業其他 33 家公司中位數的相關係數 0.74', 92.25],
    ['跟全市場中位數的相關係數 0.79', 98.25]
  ]],
  ['重資產', '', [
    ['不動產、廠房及設備占總資產 45.22%（2026 Q3）', 88.94],
    ['固定資產週轉率最低 0.75 次（2023 年）、最高 3.33 次（2021 年），高低差 77.64%', 79.46]
  ]]
])
// 中華電的兩支高點、低點不在同一季，各寫各的
assert.deepEqual(cyclicalityRows(chunghwa, NAMES)[1].measures.map(measure => measure.text), [
  '近四季合計營收從 2,300億元（2016 Q4）跌到 2,020億元（2020 Q2），跌 12.15%',
  '近四季營業利益率從 21.63%（2022 Q3）掉到 20.17%（2024 Q3），少 1.47 個百分點'
])
// 沒有跌過、某一支沒有值、整個沒有資料：不寫出半句
const flat = cyclicalityRows({ value: 10, peakDecline: { percentile: 0, revenue: { drawdownPct: 0, percentile: 0 }, operatingMargin: { declinePp: null } }, peerComovement: { percentile: 30, sectorCode: '99', market: { correlation: -0.004, percentile: 30 } } }, NAMES)
assert.deepEqual(flat[1].measures, [{ text: '近四季合計營收沒有從高點跌下來過', percentile: 0 }])
assert.deepEqual(flat[2].measures, [{ text: '跟全市場中位數的相關係數 0.00', percentile: 30 }])
assert.deepEqual(flat[0].measures, [])
assert.deepEqual(cyclicalityRows(null, NAMES).map(row => row.measures.length), [0, 0, 0, 0])

// 圖下面那一句
assert.equal(cyclicalityTrendCaption(wanHai.profitSwing.operatingMargin), '年度營業利益率平均 17.96%，每年通常偏離趨勢線 19.76 個百分點')
assert.equal(cyclicalityTrendCaption({ mean: null, ser: 3 }), '')

// 年度營業利益率與趨勢線：縱軸含 0，最高那一年在最上面、最低（負的）在最下面，0% 的線在中間
const trend = cyclicalityTrend(wanHai.profitSwing.operatingMargin)
assert.deepEqual(trend.years, [2016, 2025])
assert.equal(trend.dots.length, 10)
assert.deepEqual([trend.dots[0].x, trend.dots.at(-1).x], [0, 100])
assert.deepEqual(trend.dots.find(dot => dot.year === 2021), { year: 2021, x: 55.56, y: 0, capped: null })
assert.equal(trend.dots.find(dot => dot.year === 2023).y, 100)
assert.equal(trend.zero, 89.9)
assert.deepEqual(trend.line, [0, 82.63, 100, 39.51])
assert.deepEqual(trend.labels, [
  { text: '56.00%（2021）', x: 55.56, y: 0, below: false, align: 'center' },
  { text: '−6.29%（2023）', x: 77.78, y: 100, below: true, align: 'center' }
])
// 每個點到趨勢線的距離：2021 年從最上面連到線上
assert.deepEqual(trend.stems.find(stem => stem.x === 55.56), { x: 55.56, y1: 0, y2: 58.67 })
// 0% 標在右端
assert.equal(trend.zeroLabel, 'end')
// 最後一年貼著 0% 的線就標左端；兩端都貼著不標
assert.equal(cyclicalityTrend({ trendStart: { fiscalYear: 2016, value: 30 }, trendEnd: { fiscalYear: 2019, value: 5 }, points: years(2016, [30, 25, 10, 1]) }).zeroLabel, 'start')
assert.equal(cyclicalityTrend({ trendStart: { fiscalYear: 2016, value: 1 }, trendEnd: { fiscalYear: 2019, value: 1 }, points: years(2016, [1, 30, 25, 1]) }).zeroLabel, null)
assert.equal(trend.capped, false)
assert.equal(cyclicalityTrendLabel('萬海', trend, wanHai.profitSwing.operatingMargin), '萬海 2016～2025 年的年度營業利益率與趨勢線：最高 56.00%（2021 年），最低 −6.29%（2023 年）；年度營業利益率平均 17.96%，每年通常偏離趨勢線 19.76 個百分點')

// 中華電：全部是正的，0% 就是底邊、照樣標（讀者才知道底邊是 0）；十個點擠在最上面 10% 裡，是一條平線
const steady = cyclicalityTrend(chunghwa.profitSwing.operatingMargin)
assert.equal(steady.zero, 100)
assert.equal(steady.zeroLabel, 'end')
assert.ok(steady.dots.every(dot => dot.y < 10), JSON.stringify(steady.dots.map(dot => dot.y)))

// 超過 ±100% 的年度照全站利益率圖的規則畫在邊上（少數幾年才截）；最低那一年的字照寫原數字
const loss = cyclicalityTrend({ trendStart: { fiscalYear: 2016, value: -40 }, trendEnd: { fiscalYear: 2025, value: 20 }, points: years(2016, [-320, -150, 5, 8, 12, 15, 18, 20, 22, 25]) })
assert.equal(loss.capped, true)
assert.deepEqual(loss.dots.slice(0, 2).map(dot => [dot.y, dot.capped]), [[100, 'down'], [100, 'down']])
assert.equal(loss.labels[1].text, '−320.00%（2016）')
assert.equal(loss.labels[1].align, 'start')
// 多數年度都超出：照實撐開，不截
assert.equal(cyclicalityTrend({ trendStart: { fiscalYear: 2016, value: -300 }, trendEnd: { fiscalYear: 2019, value: -200 }, points: years(2016, [-320, -150, -250, -180]) }).capped, false)

// 畫不出來：v3 還沒有 points、不到 2 個點、沒有趨勢線、每一年都是 0
assert.equal(cyclicalityTrend({ trendStart: { fiscalYear: 2016, value: 4.53 }, trendEnd: { fiscalYear: 2025, value: 31.39 } }), null)
assert.equal(cyclicalityTrend({ trendStart: { fiscalYear: 2016, value: 1 }, trendEnd: { fiscalYear: 2025, value: 2 }, points: years(2016, [3]) }), null)
assert.equal(cyclicalityTrend({ points: years(2016, [3, 4, 5]) }), null)
assert.equal(cyclicalityTrend({ trendStart: { fiscalYear: 2016, value: 0 }, trendEnd: { fiscalYear: 2018, value: 0 }, points: years(2016, [0, 0, 0]) }), null)
assert.equal(cyclicalityTrend(null), null)

console.log('PASS: cyclicality')
