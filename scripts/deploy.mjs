// Workers Builds 的部署指令（2026-11-19，管理站轉達使用者：「新問題如果可以建立自動化的方式解掉的取代人工就做」）：
//   node scripts/deploy.mjs --environment dev https://oingg-web-nuxt-dev.oingg-web-nuxt.workers.dev
// 取代主控台原本的 `npx wrangler deploy && node scripts/record-deploy.mjs --environment dev && node scripts/check-after-deploy.mjs <網址>`，
// 三步照舊，前面多一個檢查：付費方案同時跑得了 6 個建置，Workers Builds 只跳過還在排隊、被更新的推送取代的那個，已經在跑的不會停。
// 連推兩次時，較早的建置如果比較晚跑完，會把線上蓋回舊版，部署紀錄的順序也亂掉，要等下次推版才蓋回來。
// 所以部署前先看分支最新的 commit：已經不是這一版，就是後面還有一個建置會部署更新的那版，這一版不部署、不登記，正常結束。
// 查不到（網路、沒有分支名稱）就照常部署：寧可偶爾多部署一次，也不要因為查不到而不部署。
// 較早的建置通過檢查時，較新的還沒推上來；較新的建置至少要幾分鐘才跑完，比這一版的 wrangler deploy 晚，所以最後線上一定是最新的。
// 判斷規則在 deployDecision，scripts/check-deploy-guard.mjs 驗
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

// 去掉網址裡的帳密：Workers Builds 複製 repo 時 origin 可能帶著一次性的權杖，過期後拿它查會被拒；repo 是公開的，查分支不用權杖
export function publicRemote(url) {
  return url.trim().replace(/^(https?:\/\/)[^@/]+@/, '$1')
}

// git ls-remote <遠端> refs/heads/<分支> 的輸出（「<sha>\trefs/heads/<分支>」）跟這次建置的 commit 比
export function deployDecision(commitSha, lsRemoteOutput) {
  const head = /^([0-9a-f]{40})\s/.exec(lsRemoteOutput ?? '')?.[1]
  if (!commitSha || !head) return { deploy: true, reason: '查不到分支最新的 commit，照常部署' }
  if (head === commitSha) return { deploy: true, reason: `這一版就是分支最新的 commit（${commitSha.slice(0, 7)}）` }
  return { deploy: false, reason: `分支上已經有更新的 commit ${head.slice(0, 7)}，由它的建置部署；這一版（${commitSha.slice(0, 7)}）不部署也不登記` }
}

function main() {
  const args = process.argv.slice(2)
  const envAt = args.indexOf('--environment')
  const environment = envAt >= 0 ? args[envAt + 1] : 'dev'
  const siteUrl = args.find(arg => /^https?:\/\//.test(arg))
  if (!siteUrl) throw new Error('要給網站網址：node scripts/deploy.mjs --environment dev https://…')

  const commitSha = process.env.WORKERS_CI_COMMIT_SHA ?? ''
  const branch = process.env.WORKERS_CI_BRANCH ?? ''
  let lsRemote = ''
  if (commitSha && branch) {
    // 先用去掉帳密的公開網址，查不到再用 origin 本身
    let remotes = ['origin']
    try {
      remotes = [...new Set([publicRemote(execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' })), 'origin'])]
    } catch (error) {
      console.warn(`讀不到 origin 的網址：${error.message}`)
    }
    for (const remote of remotes) {
      try {
        lsRemote = execFileSync('git', ['ls-remote', remote, `refs/heads/${branch}`], { encoding: 'utf8', timeout: 30_000 })
        if (lsRemote.trim()) break
      } catch (error) {
        console.warn(`git ls-remote 失敗（${remote === 'origin' ? 'origin' : '公開網址'}）：${error.message}`)
      }
    }
  }
  const decision = deployDecision(commitSha, lsRemote)
  console.log(decision.reason)
  if (!decision.deploy) return

  const run = (command, commandArgs) => execFileSync(command, commandArgs, { stdio: 'inherit', shell: process.platform === 'win32' })
  run('npx', ['wrangler', 'deploy'])
  run('node', ['scripts/record-deploy.mjs', '--environment', environment])
  run('node', ['scripts/check-after-deploy.mjs', siteUrl])
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
