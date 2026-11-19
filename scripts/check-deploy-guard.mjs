// scripts/deploy.mjs 的部署前檢查：分支最新的 commit 不是這一版就不部署（連推兩次時，較早的建置比較晚跑完不能蓋回舊版）。純函式，跑在 selfcheck。
// Run: node scripts/check-deploy-guard.mjs
import { deployDecision, publicRemote } from './deploy.mjs'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const mine = 'a'.repeat(40)
const newer = 'b'.repeat(40)
assert(deployDecision(mine, `${mine}\trefs/heads/development\n`).deploy === true, '分支最新的就是這一版：部署')
assert(deployDecision(mine, `${newer}\trefs/heads/development\n`).deploy === false, '分支上有更新的 commit：不部署')
assert(deployDecision(mine, `${newer}\trefs/heads/development\n`).reason.includes('bbbbbbb'), '理由寫出更新的那個 commit')
assert(deployDecision(mine, '').deploy === true, '查不到分支（ls-remote 失敗或沒有輸出）：照常部署')
assert(deployDecision('', `${newer}\trefs/heads/development\n`).deploy === true, '不知道這次建置的 commit：照常部署')
assert(deployDecision(mine, 'fatal: unable to access').deploy === true, 'ls-remote 回錯誤訊息：照常部署')
// 去掉 origin 網址裡的權杖（repo 是公開的，查分支不用權杖）
assert(publicRemote('https://x-access-token:ghs_abc@github.com/oingg-tw/oingg-web-nuxt.git\n') === 'https://github.com/oingg-tw/oingg-web-nuxt.git', '帶權杖的網址去掉帳密')
assert(publicRemote('https://github.com/oingg-tw/oingg-web-nuxt.git') === 'https://github.com/oingg-tw/oingg-web-nuxt.git', '沒有帳密的網址不變')

console.log(failures ? `FAIL ${failures}` : 'PASS: deploy guard')
process.exit(failures ? 1 : 0)
