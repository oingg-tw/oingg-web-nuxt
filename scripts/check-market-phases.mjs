// The one runnable check for shared/utils/market-phases.ts's zigzag — asserts the properties that
// break if the algorithm is wrong, on synthetic data where the right answer is known by hand, then
// runs it on the live series and prints what it finds.
//
// Run: node scripts/check-market-phases.mjs   (bff-ts must be up for the live half)
import { findMarketPhases, PHASE_CONTEXT, FAST_PHASE_CONTEXT } from '../shared/utils/market-phases.ts'

const m = (period, value) => ({ period, value })
let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

console.log('合成序列')
// One clean bear: 100 → 70 → back to 110. Exactly one phase, −30%, recovered.
{
  const s = [m('01', 100), m('02', 90), m('03', 70), m('04', 85), m('05', 110)]
  const p = findMarketPhases(s, 20)
  assert(p.length === 1, '單一段下跌被找到')
  assert(p[0]?.peakPeriod === '01' && p[0]?.troughPeriod === '03', '高點與低點的月份正確')
  assert(Math.abs(p[0]?.declinePct - (-30)) < 1e-9, '跌幅 −30%')
  assert(p[0]?.recoveryPeriod === '05', '回到前高的月份正確')
  assert(p[0]?.open === false, '已結束的段落不標記為進行中')
}
// A dip under the threshold is NOT a phase.
{
  const s = [m('01', 100), m('02', 85), m('03', 100)]
  assert(findMarketPhases(s, 20).length === 0, '−15% 的回檔不算一段')
}
// Two separate bears, where the second peak never reaches the first — the naive all-time-high
// method would merge these into one; the zigzag must keep them apart.
{
  const s = [m('01', 100), m('02', 50), m('03', 80), m('04', 40), m('05', 60)]
  const p = findMarketPhases(s, 20)
  assert(p.length === 2, '第二個高點沒回到第一個高點，仍然是兩段（不會被合併成一段）')
  assert(p[0]?.recoveryPeriod === null, '第一段從未回到前高，recoveryPeriod 為 null')
}
// Still falling at the end → open.
{
  const s = [m('01', 100), m('02', 90), m('03', 70)]
  const p = findMarketPhases(s, 20)
  assert(p.length === 1 && p[0]?.open === true, '序列結尾仍在下跌的段落標記為進行中')
}
// Never names anything: the output has no label field at all.
{
  const p = findMarketPhases([m('01', 100), m('02', 70), m('03', 100)], 20)
  assert(!('label' in (p[0] ?? {})) && !('name' in (p[0] ?? {})), '輸出沒有任何命名欄位')
}

console.log('\n實際序列')
try {
  const res = await fetch('http://localhost:4000/macro/stock-market-summary', { signal: AbortSignal.timeout(30_000) })
  const entries = (await res.json()).entries ?? []
  const months = entries.filter(e => e.avgTaiex != null).map(e => ({ period: e.period, value: Number(e.avgTaiex) }))
  const phases = findMarketPhases(months)
  console.log(`  ${months.length} 個月，門檻 20%，找到 ${phases.length} 段`)
  const biggest = phases.reduce((a, b) => (b.declinePct < a.declinePct ? b : a))
  assert(biggest.peakPeriod === '1990-02' && biggest.declinePct < -70, '最大回撤是 1990-02 起的那一段（−75%）')
  assert(phases.some(p => p.peakPeriod === '2007-10'), '2007-10 起的那一段（金融海嘯）在裡面')
  assert(!phases.some(p => p.peakPeriod.startsWith('2020-0')), 'COVID 不在裡面（月平均只跌 15%，未達門檻）— 頁面要明講')
  // Every computed phase must have a context entry keyed by its peak month. A restated series could
  // shift a peak and orphan its context; this is what turns that into a failure instead of a blank.
  const orphaned = phases.filter(p => !PHASE_CONTEXT[p.peakPeriod])
  assert(orphaned.length === 0, '每一段都有「當時的背景」（缺：' + (orphaned.map(p => p.peakPeriod).join(', ') || '無') + '）')
  const stale = Object.keys(PHASE_CONTEXT).filter(k => !phases.some(p => p.peakPeriod === k))
  assert(stale.length === 0, '沒有對不到任何一段的背景條目（多：' + (stale.join(', ') || '無') + '）')
  // The daily series gets the same coverage guard, against its own context table. Keyed by peak
  // DATE, not month — see FAST_PHASE_CONTEXT's own comment for why the two can't share.
  try {
    const dailyRes = await fetch('http://localhost:4000/market/taiex-daily-price?interval=daily&limit=8000', { signal: AbortSignal.timeout(60_000) })
    const daily = (await dailyRes.json()).entries ?? []
    const days = daily.map(e => ({ period: e.tradeDate, value: Number(e.close) })).filter(d => Number.isFinite(d.value))
    const fast = findMarketPhases(days)
    console.log(`  日線 ${days.length} 筆，找到 ${fast.length} 段急跌`)
    const fastOrphans = fast.filter(p => !FAST_PHASE_CONTEXT[p.peakPeriod])
    assert(fastOrphans.length === 0, '每一段急跌都有「當時的背景」（缺：' + (fastOrphans.map(p => p.peakPeriod).join(', ') || '無') + '）')
    const fastStale = Object.keys(FAST_PHASE_CONTEXT).filter(k => !fast.some(p => p.peakPeriod === k))
    assert(fastStale.length === 0, '沒有對不到任何急跌段的背景條目（多：' + (fastStale.join(', ') || '無') + '）')
    assert(fast.some(p => p.peakPeriod === '2020-01-14'), 'COVID 的急跌段在日線裡（月平均抓不到的那一段）')
  } catch (e) {
    console.log('  日線檢查跳過：' + e.message)
  }

  for (const p of phases) console.log(`    ${p.peakPeriod} → ${p.troughPeriod}  ${p.declinePct.toFixed(1)}%  回到前高 ${p.recoveryPeriod ?? '尚未'}${p.open ? '（進行中）' : ''}`)
} catch (e) {
  console.log('  bff-ts 未就緒，跳過實際序列：' + e.message)
}

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
