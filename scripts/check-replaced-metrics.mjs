// 被藏起來的指標 → 留下來的那一支（app/utils/replaced-metrics.ts）要對得上型錄：兩邊都還在、單位一樣（條件的數字照搬才有意義）。
// 上游改名（例如等著要改名的那 9 支）時這支會先紅。Run: 本機 dev（:3000）開著，node scripts/check-replaced-metrics.mjs
import assert from 'node:assert/strict'
import { REPLACED_METRICS, replacedFields } from '../app/utils/replaced-metrics.ts'

const catalog = await (await fetch(`${process.env.BASE ?? 'http://localhost:3000'}/api/hub/filter-schema`)).json()
const metrics = new Map(catalog.categories.flatMap(category => category.metrics).map(metric => [metric.key, metric]))
for (const [hidden, target] of Object.entries(REPLACED_METRICS)) {
  const [targetKey, targetField] = target.split('.')
  const from = metrics.get(hidden)
  const to = metrics.get(targetKey)?.fields.find(field => field.key === targetField)
  assert.ok(from, `${hidden} 不在型錄裡`)
  assert.ok(to, `${target} 不在型錄裡`)
  assert.ok(from.fields.every(field => field.unit === to.unit), `${hidden}（${from.fields.map(field => field.unit)}）跟 ${target}（${to.unit}）單位不同`)
}
// 換完去掉重複、留前面那一個位置；不在表上的照舊
assert.deepEqual(replacedFields(['stock.price', 'pegRatio.TTM', 'roe.TTM', 'livePegRatio.EOD', 'peRatioRiverBand.1Y_1D']), ['stock.price', 'livePegRatio.EOD', 'roe.TTM', 'peRatioRiverBand.1Y_1D'])
console.log('PASS: replaced metrics')
