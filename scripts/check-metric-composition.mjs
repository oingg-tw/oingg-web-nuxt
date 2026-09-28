// 組成段挑期別的規則：現有成分加起來等於母項才畫，缺的那幾項才寫成 0。
// 數字全部來自 GET /stocks/{code}/metrics-history 的實測（2026-09-28，TTM，每股營業費用的四個成分）。
// 跑：node scripts/check-metric-composition.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// shared/utils/metric-composition.ts 是純 TypeScript，沒有 import——把型別註記剝掉就能直接跑，
// 不必為一個檢查拉進打包工具。剝法很笨但會爆得很大聲：檔案一旦長出真的 import 就會壞，那時候再說。
const source = readFileSync(new URL('../shared/utils/metric-composition.ts', import.meta.url), 'utf8')
  .replace(/^export (interface|type)[\s\S]*?\n}\n/gm, '')
  .replace(/: \(number \| null\)\[\]/g, '')
  .replace(/: number \| null/g, '')
  .replace(/: CompositionInput\)/g, ')')
  .replace(/\): CompositionResult \| null \{/, ') {')
  .replace(/\(value\): value is number =>/g, 'value =>')
  .replace(/^export /gm, '')
const { compositionRow, COMPOSITION_TOLERANCE } = await import(
  `data:text/javascript,${encodeURIComponent(`${source}\nexport { compositionRow, COMPOSITION_TOLERANCE }`)}`
)

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

console.log('metric composition rows: ok')
