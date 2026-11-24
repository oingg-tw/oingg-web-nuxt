// 組成段挑期別的規則：現有成分加起來等於母項才畫，缺的那幾項才寫成 0。檔尾是組成圖的小項併進「其他」（foldSmallLayers）。
// 數字全部來自 GET /stocks/{code}/metrics-history 的實測（2026-09-28，TTM，每股營業費用的四個成分）。
// 跑：node scripts/check-metric-composition.mjs
import assert from 'node:assert/strict'
// shared/utils/metric-composition.ts 沒有 import，Node 直接剝型別載入（2026-10-08，取代原本用正規表達式剝型別註記的做法）
import { COMPOSITION_TOLERANCE, compositionRow, foldSmallLayers, SMALL_LAYER_SHARE } from '../shared/utils/metric-composition.ts'

assert.equal(COMPOSITION_TOLERANCE, 0.03, '容差是 5 × 0.005 的進位預算，改動要連同註解一起想清楚')

// 2330 2026Q2：四項齊全（預期信用減損是真的 0）。
assert.deepEqual(
  compositionRow({ parent: 14.23, parts: [0.69, 3.15, 10.4, 0] }),
  { parent: 14.23, parts: [0.69, 3.15, 10.4, 0] }
)

// 2330 2021Q3：預期信用減損 null（insufficient_history），另外三項 4.72＋1.14＋0.29 ＝ 6.15，母項 6.16，
// 差 0.01 在容差內 → 缺的那一項在這一期就是 0。這一條就是那 16 期從「不畫」變成「畫」的全部理由。
assert.deepEqual(
  compositionRow({ parent: 6.16, parts: [4.72, 1.14, 0.29, null] }),
  { parent: 6.16, parts: [4.72, 1.14, 0.29, 0] }
)

// 1101 的四期加不起來（實測最大差 0.10 > 0.03）→ 整期不畫。前端不用「母項 − 其他成分」去湊，
// 那樣恆等式永遠成立，圖上看不出哪一段是推算的。
assert.equal(compositionRow({ parent: 2.12, parts: [1.77, 0.21, 0.04, null] }), null)

// 2882 這類金融業：成分全 null → 不畫。**不是**把四項都當 0 畫出一根空柱子。
assert.equal(compositionRow({ parent: 3.5, parts: [null, null, null, null] }), null)

// 母項自己沒有值 → 不畫，即使成分有值。
assert.equal(compositionRow({ parent: null, parts: [1, 2, 3, null] }), null)

// 容差是雙向的，而且剛好在邊界上要通過（0.03 是「各項進位加起來」的上限，不是「超過就錯」的下限）。
assert.ok(compositionRow({ parent: 10, parts: [5, 4.97, null, null] }), '差 0.03 應該通過')
assert.equal(compositionRow({ parent: 10, parts: [5, 4.96, null, null] }), null, '差 0.04 應該擋掉')

// ---- 小項併進「其他」（foldSmallLayers）----
assert.equal(SMALL_LAYER_SHARE, 0.02, '門檻是量過畫面才訂的，改動要重量（見 metric-composition.ts）')
const ASSET_OTHERS = { 存貨: '其他流動資產', 流動金融資產: '其他流動資產' }
// 7767 2025Q4～2026Q3 的流動資產（占比換成一百的數字）：流動金融資產每一期都不到 2%，併進其他流動資產，名字寫出含了誰，合計不變
const folded = foldSmallLayers([
  { name: '存貨', values: [23.24, 40.78, 26.48, 43.67] },
  { name: '其他流動資產', values: [21.17, 16.68, 12.18, 17.23] },
  { name: '流動金融資產', values: [0.67, 0.22, 0.62, 0] },
  { name: '應收票據及帳款', values: [54.92, 42.32, 60.72, 39.1] }
], ASSET_OTHERS)
assert.deepEqual(folded.map(layer => layer.name), ['存貨', '其他流動資產（含流動金融資產）', '應收票據及帳款'])
assert.deepEqual(folded[1].values.map(value => Math.round(value * 100) / 100), [21.84, 16.9, 12.8, 17.23])
// 有一期到 2% 就照畫（那一期看得到）
assert.equal(foldSmallLayers([{ name: '存貨', values: [97.5, 98.5] }, { name: '流動金融資產', values: [2, 1] }, { name: '其他流動資產', values: [0.5, 0.5] }], ASSET_OTHERS).length, 3)
// 負的層跟負的層比：資本支出 1 對支出合計 100 是 1%，併進其他投資活動；營業活動沒有可以併的「其他」，照畫
const flow = foldSmallLayers([
  { name: '營業活動', values: [100] },
  { name: '資本支出', values: [-1] },
  { name: '其他投資活動', values: [-60] },
  { name: '償還債務', values: [-39] }
], { 資本支出: '其他投資活動', 償還債務: '其他籌資活動' })
assert.deepEqual(flow.map(layer => [layer.name, layer.values[0]]), [['營業活動', 100], ['其他投資活動（含資本支出）', -61], ['償還債務', -39]])
// 沒有值的期別（null，應收帳款帳齡沒有逾期占比的那幾季）留著 null、大小照 0 判斷；全是 null 的層不畫
const gaps = foldSmallLayers([{ name: '存貨', values: [null, 99] }, { name: '流動金融資產', values: [null, 1] }, { name: '其他流動資產', values: [null, 0] }, { name: '合約資產', values: [null, null] }], ASSET_OTHERS)
assert.deepEqual(gaps.map(layer => [layer.name, layer.values]), [['存貨', [null, 99]], ['其他流動資產（含流動金融資產）', [null, 1]]])
// 全是 0 的層不畫；指定的「其他」不在圖上就照畫
assert.deepEqual(foldSmallLayers([{ name: '存貨', values: [99, 99] }, { name: '流動金融資產', values: [1, 1] }, { name: '合約資產', values: [0, 0] }], ASSET_OTHERS).map(layer => layer.name), ['存貨', '流動金融資產'])

console.log('metric composition rows and small layers: ok')
