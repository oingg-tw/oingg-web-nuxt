// 指標總覽（/stock/{code}/metrics，2026-11-29）：13 個母項收成 6 大類、不列這家公司沒有的指標。
// 判斷不適用的 notApplicableSlugs（shared/utils/metric-pages.ts）用 DEV 量到的三種公司（金控、一般公司、金控集團資本適足率只有半年報），
// 版面的 metricIndexSections 與上市櫃別的 marketHiddenSlugs（app/utils/stock-page-nav.ts）。Run: node scripts/check-metric-index.mjs（pnpm selfcheck 會跑）
import assert from 'node:assert/strict'
import { APPLICABILITY_PROBES, METRIC_PAGES, notApplicableSlugs } from '../shared/utils/metric-pages.ts'
import { STOCK_METRIC_INDEX, marketHiddenSlugs, metricIndexSections } from '../app/utils/stock-page-nav.ts'

const slugOf = link => link.to('_').split('/').pop()
const indexSlugs = new Set(STOCK_METRIC_INDEX.flatMap(group => group.children.map(slugOf)))

// 每一支探針都是目錄裡的頁，每一頁指標頁都有探針
for (const probe of APPLICABILITY_PROBES) assert.ok(indexSlugs.has(probe.slug), `${probe.slug} 不在指標總覽`)
for (const page of METRIC_PAGES) assert.ok(APPLICABILITY_PROBES.some(probe => probe.slug === page.slug), `${page.slug} 沒有探針`)

const cell = (value, nullReason = null) => ({ value, nullReason })
const NA = cell(null, 'not_applicable_industry')
const series = (byTimeframe) => timeframe => byTimeframe[timeframe] ?? []

// 金控：毛利率不適用、銀行資本適足率不適用但集團資本適足率第 2 季有值（第 3 季沒有那一格）→ 毛利率與它借去判斷的關係頁不列，資本適足率留著
const holding = series({
  TTM: [{ values: { grossMargin: NA, operatingCycle: NA, bankNetRevenuePerShare: cell(2.1) } }],
  Q: [
    { values: { bankCarRatio: NA, groupCapitalAdequacyRatio: cell(127.5), currentRatio: NA } },
    { values: { bankCarRatio: NA, currentRatio: NA, debtRatio: cell(93.2) } }
  ]
})
const holdingHidden = notApplicableSlugs(APPLICABILITY_PROBES, holding)
for (const slug of ['gross-margin', 'operating-cycle', 'cash-cycle', 'current-ratio', 'solvency', 'current-asset-composition']) assert.ok(holdingHidden.includes(slug), `金控應該不列 ${slug}`)
for (const slug of ['capital-adequacy', 'net-revenue', 'net-revenue-composition', 'asset-composition', 'debt-ratio']) assert.ok(!holdingHidden.includes(slug), `金控應該列 ${slug}`)

// 一般公司：銀行專屬的一期都沒有、不帶原因 → 不列；一般指標沒有資料（新上市）不算不適用，照列；最新一期是別的原因（insufficient_history）照列
const company = series({
  TTM: [{ values: { grossMargin: cell(59.1), operatingCycle: cell(null, 'insufficient_history') } }],
  Q: [{ values: { currentRatio: cell(2.4) } }]
})
const companyHidden = notApplicableSlugs(APPLICABILITY_PROBES, company)
assert.deepEqual(new Set(companyHidden), new Set(['net-revenue', 'capital-adequacy', 'npl-ratio', 'npl-coverage', 'net-revenue-composition', 'asset-composition']))

// 最新一期才是判斷的那一格：舊的不適用、新的有值 → 列
const changed = series({ TTM: [{ values: { grossMargin: NA } }, { values: { grossMargin: cell(12.3) } }] })
assert.ok(!notApplicableSlugs(APPLICABILITY_PROBES, changed).includes('gross-margin'))

// 版面：6 類照目錄順序；一整組被藏掉時那一組不畫，同一類照舊；一整類被藏掉時那一類不畫；錨點用原本的位置
const sections = metricIndexSections(STOCK_METRIC_INDEX, new Set())
assert.deepEqual(sections.map(section => section.label), ['公司與交易', '股價與股利', '獲利', '現金與週轉', '資產與負債', '原始財報'])
assert.equal(sections.reduce((sum, section) => sum + section.groups.reduce((total, group) => total + group.links.length, 0), 0), indexSlugs.size)
const tradeGroup = STOCK_METRIC_INDEX.find(group => group.label === '交易')
const withoutTrade = metricIndexSections(STOCK_METRIC_INDEX, new Set(tradeGroup.children.map(slugOf)))
assert.deepEqual(withoutTrade[0].groups.map(group => group.label), ['公司'])
const statements = STOCK_METRIC_INDEX.find(group => group.label === '原始財報')
assert.equal(metricIndexSections(STOCK_METRIC_INDEX, new Set(statements.children.map(slugOf))).length, 5)
assert.equal(sections[2].id, `stock-metric-section-${STOCK_METRIC_INDEX.findIndex(group => group.label === '資本報酬')}`)

// 每一組第一列是新手最常查的那一支
const firstOf = label => STOCK_METRIC_INDEX.find(group => group.label === label).children[0].label
assert.deepEqual(['股利', '資本報酬', '盈餘', '淨值', '償債能力'].map(firstOf), ['現金殖利率', 'ROE', '每股盈餘', '每股淨值', '負債比率'])
const operating = STOCK_METRIC_INDEX.find(group => group.label === '本業損益').children.map(link => link.label)
assert.ok(operating.indexOf('毛利率') < operating.indexOf('每股營收'), '毛利率要排在每股細項前面')

// 上市櫃別：興櫃不在個股輪廓的比較範圍、不能信用交易、沒有內部人申報與三大法人；上市沒有三大法人；上櫃全有
assert.deepEqual(marketHiddenSlugs('rotc'), ['six-dimensions', 'margin-trading', 'insider-transfers', 'institutional-trades'])
assert.deepEqual(marketHiddenSlugs('sii'), ['institutional-trades'])
assert.deepEqual(marketHiddenSlugs('otc'), [])
assert.deepEqual(marketHiddenSlugs(undefined), [])
for (const slug of [...marketHiddenSlugs('rotc'), ...marketHiddenSlugs('sii')]) assert.ok(indexSlugs.has(slug), `${slug} 不在指標總覽`)

console.log('check-metric-index: ok')
