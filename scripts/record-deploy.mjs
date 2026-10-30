// 部署完在業務中台登記一筆部署紀錄（2026-10-29，使用者「要做發布管理，尤其是 breaking changes」；管理站的版本發布頁讀它，詞彙表二之七節）。
// 照抄業務中台 tools/record-deploy.mjs，差在跑的地方：Workers Builds 的部署指令在 `npx wrangler deploy` 之後跑它，那裡沒有 gcloud，
// Google 身分用服務帳號金鑰自己換（shared/utils/id-token.ts，跟網站呼叫業務中台同一套）。破壞性照 Conventional Commits：標題的 `!`
// 或內文的 `BREAKING CHANGE:`（我們只用後者、標題照常寫；哪些算破壞性見 CLAUDE.md）。
//
// 用法（Workers Builds 的部署指令）：npx wrangler deploy && node scripts/record-deploy.mjs --environment dev
// 建置環境要有 DEPLOY_RECORD_KEY（業務中台 Secret Manager 的 DEPLOY_RECORD_KEY_DEV／_PRD）與 DEPLOY_RECORD_GOOGLE_KEY（只能呼叫業務中台的
// 服務帳號金鑰 JSON）。失敗時網站已經部署好了、只是沒登記：結束碼 1 讓建置標成失敗看得到；下一次部署會把這次的 commit 一起補上。
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { GOOGLE_TOKEN_URL, serviceAccountAssertion } from '../shared/utils/id-token.ts'

// 業務中台 Rust 版（10/30 起；Go 版同日刪掉，latest 接得上 Go 記的那幾筆）。PRD 還沒有 web-nuxt 的部署，用到時 web-nuxt-deploy-record
// 要先成為 oingg-business-rust 的 invoker（業務中台核准），建置變數換 DEPLOY_RECORD_KEY_PRD
const URLS = {
  dev: 'https://oingg-business-rust-dev-xradmqyx5q-as.a.run.app',
  prd: 'https://oingg-business-rust-704437269028.asia-southeast1.run.app'
}

// `git log --format=%H%x1f%s%x1f%b%x1e` 的輸出 → commits[]（最多 200 個、新到舊）
export function parseCommits(raw) {
  return raw
    .split('\x1e')
    .map(entry => entry.replace(/^\n/, ''))
    .filter(Boolean)
    .slice(0, 200)
    .map(entry => {
      const [sha, subject, body = ''] = entry.split('\x1f')
      // 說明停在第一個空行或下一個 footer（`Co-Authored-By: …`）；跟業務中台 9c281fa 一致
      const breaking = body.match(/^BREAKING[ -]CHANGE:[ \t]*(.*(?:\n(?![ \t]*\n|[A-Za-z][\w-]*: ).*)*)/m)
      const note = breaking?.[1].trim() || null
      return { sha, subject: subject.slice(0, 300), isBreaking: /^[a-z]+(\([^)]*\))?!:/.test(subject) || breaking !== null, breakingNote: note?.slice(0, 2000) ?? null }
    })
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const known = sha => {
  try {
    git('cat-file', '-e', `${sha}^{commit}`)
    return true
  } catch {
    return false
  }
}

// 業務中台冷啟動時可能逾時或回 5xx：每支請求最多試 3 次（登記是冪等的，重送同一筆回 200）
async function call(url, init) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) })
      if (res.status < 500 || attempt === 3) return res
    } catch (error) {
      if (attempt === 3) throw error
    }
    await new Promise(resolve => setTimeout(resolve, attempt * 5000))
  }
}

async function main() {
  const environment = process.argv[process.argv.indexOf('--environment') + 1]
  const base = URLS[environment]
  if (!base) throw new Error('要給 --environment dev 或 prd')
  const deployKey = process.env.DEPLOY_RECORD_KEY
  const googleKey = process.env.DEPLOY_RECORD_GOOGLE_KEY ? JSON.parse(process.env.DEPLOY_RECORD_GOOGLE_KEY) : null
  if (!deployKey || !googleKey) throw new Error('建置環境缺 DEPLOY_RECORD_KEY 或 DEPLOY_RECORD_GOOGLE_KEY')

  const assertion = await serviceAccountAssertion(googleKey, { target_audience: base }, Date.now() / 1000)
  const token = await call(GOOGLE_TOKEN_URL, { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) })
  if (!token.ok) throw new Error(`換 Google ID token 回 ${token.status}: ${await token.text()}`)
  const headers = { authorization: `Bearer ${(await token.json()).id_token}`, 'x-oingg-deploy-key': deployKey, 'content-type': 'application/json' }

  // 剛才 wrangler deploy 切過去的那一版：版本編號（＝管理站第一階段看到的 scriptVersion）與流量切換的時刻
  const deployment = JSON.parse(execFileSync('npx', ['--yes', 'wrangler', 'deployments', 'status', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' }))
  const commitSha = (process.env.WORKERS_CI_COMMIT_SHA ?? git('rev-parse', 'HEAD')).slice(0, 7)

  const latest = await call(`${base}/deploy-records/latest?service=web-nuxt&environment=${environment}`, { headers })
  if (latest.status !== 200 && latest.status !== 404) throw new Error(`GET /deploy-records/latest 回 ${latest.status}: ${await latest.text()}`)
  const previous = latest.status === 200 ? (await latest.json()).commitSha : null

  // Workers Builds 抓下來的歷史可能很淺：上次的 commit 不在就補抓；補不到（或第一次登記）只記這一個
  const shallow = git('rev-parse', '--is-shallow-repository') === 'true'
  if (previous && !known(previous) && shallow) {
    try {
      git('fetch', '--unshallow', '--quiet', 'origin')
    } catch (error) {
      console.warn(`補抓 git 歷史失敗，只記這一個 commit：${error.message}`)
    }
  }
  const range = previous && known(previous) ? [`${previous}..${commitSha}`] : ['-1', commitSha]
  const commits = parseCommits(git('log', '--format=%H%x1f%s%x1f%b%x1e', ...range))

  const body = {
    service: 'web-nuxt',
    environment,
    revision: deployment.versions[0].version_id,
    commitSha,
    deployedAt: new Date(deployment.created_on).toISOString(),
    deployedBy: googleKey.client_email,
    commits
  }
  const res = await call(`${base}/deploy-records`, { method: 'POST', headers, body: JSON.stringify(body) })
  if (res.status !== 201 && res.status !== 200) throw new Error(`POST /deploy-records 回 ${res.status}: ${await res.text()}`)
  const breaking = commits.filter(commit => commit.isBreaking).length
  console.log(`${res.status === 201 ? '登記' : '已經登記過'}：web-nuxt ${environment} ${body.revision} ${commitSha}，${commits.length} 個 commit（${breaking} 個破壞性）${previous ? `，上次 ${previous}` : '，第一次登記'}${shallow ? '（建置的 git 歷史是淺的）' : ''}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(error => {
    console.error(`部署紀錄沒登記到（網站已經部署好了；下一次部署會把這次的 commit 一起補上）：${error.message}`)
    process.exit(1)
  })
}
