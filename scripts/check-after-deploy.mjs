// 部署後對真的網址跑一輪（管理站轉達的 PRD 上線策略配套 6，使用者 2026-11-11「2 要」）。Workers Builds 的部署指令在 wrangler deploy、
// 部署紀錄之後跑這支，有問題就讓這次建置失敗：
//   npx wrangler deploy && node scripts/record-deploy.mjs --environment dev && node scripts/check-after-deploy.mjs https://oingg-web-nuxt-dev.oingg-web-nuxt.workers.dev
// CI 的開機測試在模擬環境打同一批頁面（ci.yml 的 SMOKE_PATHS，清單只有那一份），抓不到只有真的環境才會壞的：Cloudflare 上的設定與密鑰、
// 跟業務中台的連線。這時部署已經生效，照 CLAUDE.md 先退版再回報。本機對 DEV 跑也行（不在 Workers Builds 裡就不比版本，只打網址）
import { readFileSync } from 'node:fs'

const base = process.argv[2]?.replace(/\/$/, '')
if (!base) throw new Error('要給網址：node scripts/check-after-deploy.mjs https://…')
const paths = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8').match(/^\s*SMOKE_PATHS:\s*(.+)$/m)?.[1].trim().split(/\s+/)
if (!paths?.length) throw new Error('ci.yml 裡找不到 SMOKE_PATHS')
const failures = []

// 網址上的版本要是剛建好的這一版（新版本幾秒內就到各機房，最多等 2 分鐘）。只在 Workers Builds 裡比：本機的 .output 可能是舊的建置
if (process.env.WORKERS_CI_COMMIT_SHA) {
  const expected = JSON.parse(readFileSync(new URL('../.output/public/_nuxt/builds/latest.json', import.meta.url), 'utf8')).id
  let live = null
  for (let attempt = 0; attempt < 24 && live !== expected; attempt++) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, 5000))
    live = await fetch(`${base}/_nuxt/builds/latest.json`, { cache: 'no-store' }).then(response => response.json()).then(body => body.id).catch(() => null)
  }
  console.log(`${live === expected ? 'ok  ' : 'FAIL'} 版本 ${live}${live === expected ? '' : `，剛建好的是 ${expected}`}`)
  if (live !== expected) failures.push('版本')
} else console.log('---- 不在 Workers Builds 裡，不比版本')

// 業務中台 DEV 會冷啟動十幾秒：每個網址等 60 秒，失敗再試一次。轉址不跟（同 CI 的 curl，清單裡的頁都該直接 200）
async function get(path) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(60_000) }).catch(error => ({ status: error.name }))
    if (response.status === 200 || attempt === 2) return response
  }
}
for (const path of paths) {
  const { status } = await get(path)
  console.log(`${status === 200 ? 'ok  ' : 'FAIL'} ${status} ${path}`)
  if (status !== 200) failures.push(path)
}
// 開機測試的頁面在業務中台連不到時照樣回 200（設計如此），所以另外打一支要經過業務中台的 API，確認伺服器層連得到、金鑰有效
const upstream = await get('/api/core/stocks/2330/badges')
const reached = upstream.status === 200 && Array.isArray((await upstream.json().catch(() => null))?.categories)
console.log(`${reached ? 'ok  ' : 'FAIL'} ${upstream.status} /api/core/stocks/2330/badges（經過業務中台）`)
if (!reached) failures.push('業務中台')

if (failures.length) {
  console.error(`部署後檢查失敗：${failures.join('、')}。這一版已經生效，先退回上一版（wrangler rollback）再查`)
  process.exit(1)
}
console.log('部署後檢查通過')
