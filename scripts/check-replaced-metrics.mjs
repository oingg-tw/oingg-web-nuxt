// 被藏起來的指標 → 留下來的那一支（app/utils/replaced-metrics.ts）要對得上型錄：兩邊都還在、單位一樣（條件的數字照搬才有意義）。
// 上游改名（例如等著要改名的那 9 支）時這支會先紅。Run: 本機 dev（:3000）開著，node scripts/check-replaced-metrics.mjs
import assert from 'node:assert/strict'
import { PICKER_UNLISTED_METRICS, REPLACED_METRICS, replacedFields } from '../app/utils/replaced-metrics.ts'

const base = process.env.BASE ?? 'http://localhost:3000'
const catalog = await (await fetch(`${base}/api/hub/filter-schema`)).json()
const metrics = new Map(catalog.categories.flatMap(category => category.metrics).map(metric => [metric.key, metric]))
for (const [hidden, target] of Object.entries(REPLACED_METRICS)) {
  const [targetKey, targetField] = target.split('.')
  const from = metrics.get(hidden)
  const to = metrics.get(targetKey)?.fields.find(field => field.key === targetField)
  assert.ok(from, `${hidden} 不在型錄裡`)
  assert.ok(to, `${target} 不在型錄裡`)
  assert.ok(from.fields.every(field => field.unit === to.unit), `${hidden}（${from.fields.map(field => field.unit)}）跟 ${target}（${to.unit}）單位不同`)
}
// 只藏不換的也要還在型錄裡：上游改名或拿掉時，表上的名字就過期了
for (const key of PICKER_UNLISTED_METRICS) assert.ok(metrics.get(key), `${key} 不在型錄裡`)
// 官方欄位範本是業務中台的資料，這張表一改就可能過期（11-01 改留即時股價淨值比，範本舊了四天才發現）。沒有欄位組合的帳號（新帳號的第一個畫面）直接
// 讀總覽範本，網站換不到，紅了要請業務中台改範本（同它的 migration 0013）
const { templates } = await (await fetch(`${base}/api/core/screener/column-preset-templates`)).json()
assert.ok(templates.length, '讀不到官方欄位範本')
for (const { key, fields } of templates) assert.deepEqual(replacedFields(fields), fields, `官方欄位範本 ${key} 還有被藏起來的指標`)
// 只藏不換的指標也不留在官方範本裡（2026-11-10，使用者選「請業務中台拿掉這些範本」）：挑選器加不回來的條件與欄位，範本也不該帶。紅了要請業務中台改
const unlisted = field => PICKER_UNLISTED_METRICS.includes(field.split('.')[0])
for (const { key, fields } of templates) assert.ok(!fields.some(unlisted), `官方欄位範本 ${key} 用到藏起來的指標：${fields.filter(unlisted).join('、')}`)
const { templates: screenerTemplates } = await (await fetch(`${base}/api/core/screener/templates`)).json()
for (const { name, filters } of screenerTemplates) assert.ok(!filters.some(filter => unlisted(filter.field)), `官方篩選範本「${name}」用到藏起來的指標：${filters.map(filter => filter.field).filter(unlisted).join('、')}`)
// 換完去掉重複、留前面那一個位置；不在表上的照舊
assert.deepEqual(replacedFields(['stock.price', 'pegRatio.TTM', 'roe.TTM', 'livePegRatio.EOD', 'peRatioRiverBand.1Y_1D']), ['stock.price', 'livePegRatio.EOD', 'roe.TTM', 'peRatioRiverBand.1Y_1D'])
console.log('PASS: replaced metrics')
