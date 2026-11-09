// /api/core 不轉業務中台只給 Nitro 的路徑（2026-11-09，資安盤點 M6）：openapi.json 與 cold-starts/ 底下回 404，換個寫法
// （多一個斜線、結尾斜線、./）也到不了業務中台；一般的路徑照樣轉。被擋的回應要是 Nitro 自己的（detail「不接受的路徑」），
// 不是上游剛好沒有。路徑原樣送出（fetch 會先把 ./ 正規化掉，所以用 node:http）。
// POST 只在同一條路徑的 GET 確定被這裡擋下之後才送：還沒換上這一版的伺服器會把它轉給業務中台，業務中台收到任何 id 都會新增一列。
// Run: 本機 dev（:3000）開著，node scripts/check-core-proxy-block.mjs（BASE= 換伺服器，例如 DEV 的網址）
import http from 'node:http'
import https from 'node:https'

const base = new URL(process.env.BASE ?? 'http://localhost:3000')
const BLOCKED = '不接受的路徑'
let failures = 0
const check = (ok, label) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const send = (path, method = 'GET') => new Promise((resolve, reject) => {
  const body = method === 'POST' ? '{}' : ''
  const request = (base.protocol === 'https:' ? https : http).request({
    host: base.hostname,
    port: base.port || undefined,
    path: `/api/core/${path}`,
    method,
    headers: body ? { 'content-type': 'application/json', 'content-length': body.length } : {}
  }, (response) => {
    let text = ''
    response.setEncoding('utf8')
    response.on('data', chunk => (text += chunk))
    response.on('end', () => resolve({ status: response.statusCode, blocked: text.includes(BLOCKED) }))
  })
  request.on('error', reject)
  request.end(body)
})

for (const path of ['openapi.json', '/openapi.json', 'openapi.json/', 'cold-starts', 'cold-starts/x', 'cold-starts/x/client-timing']) {
  const { status, blocked } = await send(path)
  check(status === 404 && blocked, `GET /api/core/${path} → ${status}${blocked ? '，Nitro 擋的' : '，不是 Nitro 擋的'}（要 404）`)
}
if ((await send('cold-starts/x/client-timing')).blocked) {
  const { status, blocked } = await send('cold-starts/x/client-timing', 'POST')
  check(status === 404 && blocked, `POST /api/core/cold-starts/x/client-timing → ${status}（要 404）`)
} else {
  check(false, 'POST /api/core/cold-starts/x/client-timing 沒送：這台伺服器還沒擋，送了會真的寫進業務中台')
}
// Cloudflare 可能先把 ./ 正規化成 /api/core/openapi.json（→ 404），本機的 Nitro 直接拒絕（→ 400）：兩種都沒轉出去
for (const path of ['./openapi.json', 'x/../openapi.json']) {
  const { status, blocked } = await send(path)
  check((status === 400 || status === 404) && blocked, `GET /api/core/${path} → ${status}（要 400 或 404，Nitro 擋的）`)
}
const control = await send('industries/sector-dividend-summary')
check(control.status === 200, `一般路徑照樣轉：GET /api/core/industries/sector-dividend-summary → ${control.status}`)

console.log(failures ? `\n${failures} 項沒過` : '\n全部通過')
process.exitCode = failures ? 1 : 0
