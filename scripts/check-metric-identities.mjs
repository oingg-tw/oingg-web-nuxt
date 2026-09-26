// 指標恆等式檢查 — 用資料內部的自洽性找出量級錯誤，不依賴任何上游訊號。
//
// 2026-09-26 建立。那一天上游跑了四波重算，其中一波帶進回歸（6546 的近四季 EPS 從 4.08 變成 40.84，
// 錯 10 倍），而**逐格 formulaVersion 對它完全沉默**——版本號只在公式改變時跳，資料修正不動它。當天
// 靠人工比對年報才發現，而那個對照一直都在我們自己的資料裡：同一家公司的年度 EPS 是 2.73。
//
// 這支腳本把那個比對變成可以隨時跑的東西。
//
// ## 只報座標與量級，不報成因 —— 這是設計，不是偷懶
//
// 建立這支腳本的那一天，我三次偵測成功、三次歸因講錯：
//
//   偵測到 5904 股價 ÷(本淨比×每股淨值) 差 9.3 倍  → 我說「每股淨值算錯」
//                                                  → 實際是面額 10→1，股價在舊基準、每股淨值在新基準
//   偵測到 5904 的 ROE 51.39 可疑                   → 我說「跟著錯的每股淨值走」
//                                                  → 實際 ROE 不經過股數，51.39 是對的
//   偵測到上櫃股價全部停在 09-08                     → 我說「上游抓取壞了」
//                                                  → 實際是本機讀 dev 庫，環境特性
//
// 三次的數字都對，三次的解釋都錯。合作的 bff-ts 同一天也犯了同型的錯（把 diff 的「變了」讀成
// 「修好了」，而新值才是錯的）。所以這支腳本**刻意不輸出任何成因推測**——它報「這裡有矛盾，量級多大，
// 去看」。一個會輸出原因的版本，只會把那三種錯誤系統化，而且因為它印在終端機上看起來更像事實。
//
// ## 兩條恆等式，各自抓得到不同的東西
//
//   A. 年度 EPS ↔ 同一年 Q4 的近四季 EPS
//      兩者涵蓋同一段期間，理論上相等。實測 n=180：中位數 1.000、p25 0.994、p75 1.000、
//      範圍 0.738~1.403，落在 0.70~1.40 之外的只有 1 筆（0.6%）。而異常是 10 倍以上——中間有
//      7 倍以上的間隙，門檻非常好訂。
//
//      **期間一定要對齊。** 第一版拿「最新 TTM」比「最新 FY」，那是今年前四季對去年整年，成長或
//      衰退本來就會差很多（實測誤報率 30%，p1 到 -56）。對齊之後標準差從 6.5 降到 0.047。
//
//   B. 股價 ↔ 本淨比 × 每股淨值
//      這三個數字來自同一份資料，相乘應該等於股價。實測正常公司 0.97~1.10，5904 是 9.30。
//
//      **B 抓不到「兩個數字一起錯」**：8171 的本淨比與每股淨值都從同一個錯誤股數算出來，所以內部
//      自洽而兩者皆錯，B 給它 1.10（通過）。那一類要靠外部錨點（交易所隱含值）才抓得到，不在這支
//      腳本的能力範圍內——知道自己抓不到什麼，跟知道抓得到什麼一樣重要。
//
// ## 這支腳本永遠 exit 0
//
// 它檢查的是**上游的資料**，不是我們的程式碼。上游資料變動跟我們的 commit 無關，讓它擋建置等於用
// 別人的狀態決定我們能不能發版。它的用途是清快取前後跑一次、或懷疑數字時跑一次。
//
// 用法：
//   node scripts/check-metric-identities.mjs              # 抽樣 120 家
//   node scripts/check-metric-identities.mjs --sample 400
//   node scripts/check-metric-identities.mjs --all        # 全市場，慢（每家 2 次請求）
//   node scripts/check-metric-identities.mjs --symbols 5904,6546
const API = process.env.BFF_BASE ?? 'http://localhost:4000'
const SITE = process.env.SITE_BASE ?? 'http://localhost:3000'

// 門檻取自實測分布，不是拍腦袋：A 的正常範圍是 0.738~1.403（n=180），異常是 10 倍以上。訂在
// 0.70/1.45 留了一點邊，而離最近的異常還有 7 倍距離。B 的正常是 0.97~1.10，訂 0.80/1.25。
const EPS_LOW = 0.70
const EPS_HIGH = 1.45
// 這兩個數字比 EPS 那條鬆很多，是有原因的：`pbRatio.Q` 是用**季末股價**算的，而我們手上只有**今天的
// 股價**。季末到今天之間股票漲跌兩三成是家常便飯，所以窄門檻會把正常波動報成錯誤（實測 6417 比值
// 1.295，就是這種情況而不是資料問題）。
//
// 這條恆等式的用途是抓**量級錯誤**——5904 那次是 9.30 倍。0.5~2.0 的範圍離它還有 4 倍以上距離，
// 同時容得下任何合理的股價變動。想抓 30% 等級的偏差需要季末股價，那要另一個資料來源。
const PRICE_LOW = 0.5
const PRICE_HIGH = 2.0
// 太接近零的分母會讓比值爆炸而沒有意義（一家 EPS 0.001 的公司，比值多少都不代表錯誤）。
const MIN_EPS = 0.05
const MIN_PRICE = 1

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const value = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// 重試＋節流。第一版沒有這個，掃 83 家時**整批**失敗（0 家有資料）而不是零星失敗——那不是上游掛了，
// 是連線耗盡：每家 2 個並發請求快速連發，Windows 的 socket 回收跟不上。整批失敗比零星失敗更危險，
// 因為它看起來像「沒有異常」而不是「沒有檢查到」。
async function getJson(url, init, attempt = 0) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`${response.status} ${url}`)
    return await response.json()
  } catch (error) {
    if (attempt >= 2) throw error
    await sleep(300 * (attempt + 1))
    return getJson(url, init, attempt + 1)
  }
}

async function universe() {
  const explicit = value('--symbols')
  if (explicit) return explicit.split(',').map(s => s.trim()).filter(Boolean)
  // 走我們自己的 directory：它已經排除了興櫃，而興櫃的財報稀疏、比值沒有判別力。
  const directory = await getJson(`${SITE}/api/hub/directory`)
  const all = [...(directory.sectors ?? []).flatMap(s => s.companies ?? []), ...(directory.others ?? [])]
    .filter(company => !company.isEmerging)
    .map(company => company.symbol)
  if (flag('--all')) return all
  // 均勻抽樣，不是取前 N 家：代號有產業順序，取前段會系統性地漏掉電子股以外的公司，而這種偏誤
  // 正是 2026-09-26 那天讓一次全市場量測得出「0 筆異常」的原因。
  const want = Number(value('--sample') ?? 120)
  const step = Math.max(1, Math.floor(all.length / want))
  return all.filter((_, i) => i % step === 0)
}

// A. 年度 EPS ↔ 同一年 Q4 的近四季 EPS
async function epsIdentity(symbol) {
  const [fy, ttm] = await Promise.all([
    getJson(`${API}/stocks/${symbol}/metrics-history?metricCodes=eps&basis=FY&limit=8`),
    getJson(`${API}/stocks/${symbol}/metrics-history?metricCodes=eps&basis=TTM&limit=40`)
  ])
  const q4 = new Map()
  for (const entry of ttm.entries ?? []) {
    if (entry.fiscalQuarter === 4 && entry.values.eps?.value != null) q4.set(entry.fiscalYear, entry.values.eps.value)
  }
  const found = []
  for (const entry of fy.entries ?? []) {
    const annual = entry.values.eps?.value
    const trailing = q4.get(entry.fiscalYear)
    if (annual == null || trailing == null || Math.abs(annual) < MIN_EPS) continue
    const ratio = trailing / annual
    if (ratio >= EPS_LOW && ratio <= EPS_HIGH) continue
    found.push({ symbol, period: `${entry.fiscalYear} 年度`, ratio, detail: `年度 ${annual}　Q4 近四季 ${trailing}` })
  }
  return found
}

// B. 股價 ↔ 本淨比 × 每股淨值。批量取，200 檔一次。
async function priceIdentity(symbols) {
  const found = []
  for (let i = 0; i < symbols.length; i += 200) {
    const batch = symbols.slice(i, i + 200)
    const response = await getJson(`${API}/screener/values`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbols: batch,
        columns: [{ field: 'bvps.Q' }, { field: 'pbRatio.Q' }, { field: 'stock.price' }]
      })
    })
    for (const row of response.results ?? []) {
      const bvps = row.values?.['bvps.Q']?.value
      const pb = row.values?.['pbRatio.Q']?.value
      const price = row.values?.['stock.price']?.value
      if (bvps == null || pb == null || price == null || Math.abs(price) < MIN_PRICE) continue
      const ratio = (pb * bvps) / price
      if (ratio >= PRICE_LOW && ratio <= PRICE_HIGH) continue
      found.push({
        symbol: row.symbol,
        period: '最新一期',
        ratio,
        detail: `本淨比 ${pb} × 每股淨值 ${bvps} = ${(pb * bvps).toFixed(1)}　股價 ${price}`
      })
    }
  }
  return found
}

const symbols = await universe()
console.log(`檢查 ${symbols.length} 家（${flag('--all') ? '全市場' : value('--symbols') ? '指定' : '均勻抽樣'}）`)

const epsHits = []
let checked = 0
for (const symbol of symbols) {
  try {
    epsHits.push(...await epsIdentity(symbol))
    checked += 1
    await sleep(40)
  } catch (error) {
    // 單一公司抓不到不該中斷整輪——這支腳本的價值在覆蓋率。
    if (process.env.DEBUG_IDENTITIES) console.log(`  [debug] ${symbol}: ${error.message}`)
  }
}

let priceHits = []
try {
  priceHits = await priceIdentity(symbols)
} catch (error) {
  console.log(`\n股價恆等式跳過：${error.message}`)
}

const report = (title, hits, note) => {
  console.log(`\n── ${title} ──`)
  if (!hits.length) { console.log('  沒有超出範圍的。'); return }
  hits.sort((a, b) => Math.abs(Math.log(Math.abs(b.ratio) || 1)) - Math.abs(Math.log(Math.abs(a.ratio) || 1)))
  for (const hit of hits.slice(0, 30)) {
    console.log(`  ${hit.symbol}  ${hit.period.padEnd(10)} 比值 ${hit.ratio.toFixed(3).padStart(8)}   ${hit.detail}`)
  }
  if (hits.length > 30) console.log(`  …另外 ${hits.length - 30} 筆`)
  console.log(`  ${note}`)
}

if (checked === 0 && symbols.length > 0) {
  console.log('')
  console.log('⚠ 一家都沒檢查到。這是「沒有檢查到」不是「沒有異常」——先確認 bff-ts 可達。')
} else if (checked < symbols.length * 0.8) {
  console.log('')
  console.log(`⚠ 只檢查到 ${checked}/${symbols.length} 家，覆蓋率偏低，結果可能不完整。`)
}

report(`年度 EPS ↔ 同年 Q4 近四季（${checked} 家有資料，正常範圍 ${EPS_LOW}~${EPS_HIGH}）`, epsHits,
  '這兩個數字涵蓋同一段期間，理論上相等。')
report(`股價 ↔ 本淨比 × 每股淨值（正常範圍 ${PRICE_LOW}~${PRICE_HIGH}）`, priceHits,
  '三個數字來自同一份資料，相乘應等於股價。')

console.log('\n以上只是座標與量級，不含成因。比值異常的原因可能是資料錯誤、也可能是面額變更、股價與財報')
console.log('期間不同步、或這支腳本沒想到的情況——請逐筆去看，不要照著數字推論原因。')
