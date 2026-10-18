// 前端 Lighthouse 分數留存（2026-10-18，使用者透過管理站提出：把歷次 Lighthouse 分數存下來、在管理站看，比照業務中台的資安測試留存）。
// 使用者選定：PageSpeed Insights（Google 的機器）量 DEV、手動跑、兩組頁面任選（基準／全站）、每頁手機與桌機各 3 次取中位數。
// 本機 Lighthouse 不準的理由見記憶 project_lighthouse_dev_baseline（這台電腦忙時手機分數兩極，同頁差 25 分）。
//
// 用法：
//   pnpm lighthouse:check                 基準組（9 頁）
//   pnpm lighthouse:check -- --plan=full  全站組（scripts/site-routes.mjs 的每一種頁面模板）
//   pnpm lighthouse:check -- --dry-run    只量、不送業務中台（摘要存在報告資料夾）
//   pnpm lighthouse:check -- --send=lighthouse-report/<資料夾>/run.json   補送（量完時業務中台沒開、或送出失敗）
// 需要 .env 的 PSI_API_KEY（只限 PageSpeed Insights API 的金鑰）；送業務中台要 LIGHTHOUSE_INGEST_KEY（從業務中台的 .env 複製）。兩把都永不印出。
//
// 量法（同記憶裡的經驗）：每頁先打兩次暖機（DEV 的 minInstances 是 0，冷啟動會算進第一次）；PSI 會回同一網址的快取結果，所以網址帶
// 不重複的 psi 參數，每一次才是獨立樣本。分數與每項指標各自取中位數；沒通過的稽核取「效能分數是中位數的那一次」，屬於同一次真實的量測。
// 完整報告只存中位數那一次、拿掉截圖（每份從約 1.5 MB 降到幾百 KB），放在 lighthouse-report/（不進版控、不進資料庫）。
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { ALL_ROUTES } from './site-routes.mjs'

// PSI 只量得到公開網址；業務中台的 target 也只收 dev
const baseUrl = 'https://web-nuxt-dev--oingg-web-dev.asia-east1.hosted.app'
const BASELINE_ROUTES = ['/', '/stock/2330', '/screener/common', '/screener/etf', '/etf/0050', '/holdings', '/learn', '/macro/business-cycle-clock', '/preferred/2881a']
const PLANS = { baseline: BASELINE_ROUTES, full: ALL_ROUTES }
const FORM_FACTORS = ['mobile', 'desktop']
const SAMPLES = 3
const CONCURRENCY = 4
const CATEGORIES = { performance: 'performance', accessibility: 'accessibility', 'best-practices': 'bestPractices', seo: 'seo' }
const METRICS = { fcpMs: 'first-contentful-paint', lcpMs: 'largest-contentful-paint', tbtMs: 'total-blocking-time', cls: 'cumulative-layout-shift', speedIndexMs: 'speed-index' }

const args = process.argv.slice(2)
const planName = args.find(arg => arg.startsWith('--plan='))?.slice('--plan='.length) ?? 'baseline'
const dryRun = args.includes('--dry-run')
const sendPath = args.find(arg => arg.startsWith('--send='))?.slice('--send='.length)
const routes = PLANS[planName]

const median = (values) => {
  const sorted = values.filter(value => typeof value === 'number').sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
// 分數要整數（業務中台只收 0～100 整數）：失敗一次剩兩個樣本、或全站組 74 頁取中位數時，中位數是兩數平均，可能是 .5
const intMedian = (values) => {
  const value = median(values)
  return value === null ? null : Math.round(value)
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// 送業務中台（POST /lighthouse-runs）：只打本機（NUXT_BUSINESS_BASE）。本機跟 DEV 共用資料庫，DEV 的業務中台有 IAM 鎖。
// 沒有金鑰就只存本機；送不出去報告還在，用 --send= 補送
async function send(run, runPath) {
  const key = process.env.LIGHTHOUSE_INGEST_KEY
  if (!key) {
    console.log('.env 沒有 LIGHTHOUSE_INGEST_KEY：沒有送出')
    return
  }
  const response = await fetch(`${(process.env.NUXT_BUSINESS_BASE ?? 'http://localhost:4000').replace(/\/$/, '')}/lighthouse-runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-oingg-lighthouse-key': key },
    body: JSON.stringify(run)
  }).catch(error => ({ ok: false, status: 0, text: async () => error.cause?.code ?? error.message }))
  if (response.ok) {
    console.log(`已送出（${response.status}，id ${(await response.json()).id}）`)
    return
  }
  console.log(`送出失敗 ${response.status}：${(await response.text()).slice(0, 300)}\n修好後補送：pnpm lighthouse:check -- --send=${runPath}`)
  process.exitCode = 1
}

if (sendPath) {
  await send(JSON.parse(readFileSync(sendPath, 'utf8')), sendPath)
  process.exit()
}
if (!routes) {
  console.error(`沒有「${planName}」這組頁面；可用的有 ${Object.keys(PLANS).join('、')}`)
  process.exit(2)
}
if (!process.env.PSI_API_KEY) {
  console.error('要 .env 的 PSI_API_KEY：用 pnpm lighthouse:check（已帶 --env-file=.env）')
  process.exit(2)
}

async function runPsi(path, formFactor, sample) {
  const target = new URL(`${baseUrl}${path}`)
  target.searchParams.set('psi', `${Date.now()}-${sample}`)
  const query = new URLSearchParams({ url: target.href, strategy: formFactor, key: process.env.PSI_API_KEY })
  for (const category of Object.keys(CATEGORIES)) query.append('category', category)
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${query}`).catch(error => ({ ok: false, status: 0, error }))
    if (response.ok) {
      const body = await response.json()
      if (body.lighthouseResult?.runtimeError) throw new Error(`${body.lighthouseResult.runtimeError.code}: ${body.lighthouseResult.runtimeError.message}`)
      return body.lighthouseResult
    }
    // 429／5xx 退避重試；其他錯誤（網址錯、金鑰錯）直接丟出
    if (response.status && response.status < 500 && response.status !== 429) throw new Error(`PSI ${response.status}: ${(await response.text()).slice(0, 200)}`)
    await sleep(10000 * (attempt + 1))
  }
  throw new Error('PSI 重試三次都失敗')
}

const scoreOf = (result, category) => (result.categories[category]?.score == null ? null : Math.round(result.categories[category].score * 100))

// 沒通過：四大類裡會計分的稽核（排除 informative／manual／notApplicable），分數低於 0.9（Lighthouse 自己的及格線）
function failedAudits(result) {
  const failed = []
  for (const [category, key] of Object.entries(CATEGORIES)) {
    for (const ref of result.categories[category]?.auditRefs ?? []) {
      const audit = result.audits[ref.id]
      if (!audit || audit.score === null || audit.score >= 0.9) continue
      if (['informative', 'manual', 'notApplicable'].includes(audit.scoreDisplayMode)) continue
      failed.push({ id: audit.id, title: audit.title, category: key, score: audit.score, displayValue: audit.displayValue ?? null })
    }
  }
  return failed
}

const startedAt = new Date()
const reportDir = `lighthouse-report/${startedAt.toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${planName}`
mkdirSync(reportDir, { recursive: true })
let webVersion = null
try {
  webVersion = execSync('git rev-parse origin/development', { encoding: 'utf8' }).trim()
} catch {
  // 沒有遠端分支（例如淺層 clone）就留空
}

console.log(`${planName}：${routes.length} 頁 × ${FORM_FACTORS.length} 種 × ${SAMPLES} 次，量 ${baseUrl}`)
// 暖機兩次：DEV 冷啟動與 Nitro 快取不算在量測裡
for (const path of routes) {
  for (let i = 0; i < 2; i++) await fetch(`${baseUrl}${path}`).catch(() => null)
}

const jobs = routes.flatMap(path => FORM_FACTORS.map(formFactor => ({ path, formFactor })))
const pages = []
let lighthouseVersion = null
let aborted = null
let cursor = 0
async function worker() {
  while (cursor < jobs.length && !aborted) {
    const { path, formFactor } = jobs[cursor++]
    const results = []
    for (let sample = 0; sample < SAMPLES; sample++) {
      try {
        results.push(await runPsi(path, formFactor, sample))
      } catch (error) {
        console.log(`  ! ${formFactor} ${path} 第 ${sample + 1} 次：${error.message.slice(0, 160)}`)
        // 金鑰失效、額度用完：後面的也不會成功，整輪停下來
        if (/API key|quota|403/i.test(error.message)) aborted = error.message.slice(0, 200)
      }
    }
    if (!results.length) continue
    lighthouseVersion ??= results[0].lighthouseVersion
    const scores = Object.fromEntries(Object.entries(CATEGORIES).map(([category, key]) => [key, intMedian(results.map(result => scoreOf(result, category)))]))
    // 毫秒取整數、CLS 留四位小數（PSI 的 numericValue 帶一長串浮點雜訊：3901.030151649087）
    const metrics = Object.fromEntries(Object.entries(METRICS).map(([key, id]) => {
      const value = median(results.map(result => result.audits[id]?.numericValue))
      return [key, value === null ? null : key === 'cls' ? Math.round(value * 10000) / 10000 : Math.round(value)]
    }))
    const byPerformance = [...results].sort((a, b) => (scoreOf(a, 'performance') ?? 0) - (scoreOf(b, 'performance') ?? 0))
    const representative = byPerformance[Math.floor(byPerformance.length / 2)]
    pages.push({ path, formFactor, samples: results.length, scores, metrics, failedAudits: failedAudits(representative) })
    // 完整報告：只存中位數那一次，拿掉截圖
    for (const id of ['screenshot-thumbnails', 'final-screenshot', 'full-page-screenshot']) delete representative.audits[id]
    writeFileSync(`${reportDir}/${formFactor}${path.replace(/[/?=&]/g, '_') || '_'}.json`, JSON.stringify(representative))
    console.log(`  ${formFactor.padEnd(7)} ${String(scores.performance).padStart(3)} ${String(scores.accessibility).padStart(3)} ${String(scores.bestPractices).padStart(3)} ${String(scores.seo).padStart(3)}  LCP ${Math.round(metrics.lcpMs ?? 0)}ms CLS ${(metrics.cls ?? 0).toFixed(3)} TBT ${Math.round(metrics.tbtMs ?? 0)}ms  ${path}`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const summary = {
  pageCount: routes.length,
  byFormFactor: Object.fromEntries(FORM_FACTORS.map(formFactor => [formFactor, Object.fromEntries(Object.values(CATEGORIES).map(key =>
    [key, intMedian(pages.filter(page => page.formFactor === formFactor).map(page => page.scores[key]))]))]))
}
const run = {
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  source: 'psi',
  target: 'dev',
  baseUrl,
  plan: planName,
  webVersion,
  lighthouseVersion,
  samplesPerPage: SAMPLES,
  aborted,
  notes: ['DEV 全站 noindex，SEO 的 is-crawlable 必扣'],
  pages: pages.sort((a, b) => routes.indexOf(a.path) - routes.indexOf(b.path) || a.formFactor.localeCompare(b.formFactor)),
  summary
}
writeFileSync(`${reportDir}/run.json`, JSON.stringify(run, null, 2))
console.log(`\n中位數（手機）${JSON.stringify(summary.byFormFactor.mobile)}；（桌機）${JSON.stringify(summary.byFormFactor.desktop)}`)
console.log(`完整報告與摘要：${reportDir}`)

if (dryRun) console.log('--dry-run：沒有送出')
else if (!pages.length) console.log('一頁都沒量到：沒有送出')
else await send(run, `${reportDir}/run.json`)
