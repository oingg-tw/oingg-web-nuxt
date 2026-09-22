// 市場階段 — bear phases computed from the index series itself（2026-09-22,「總經事件 1990年台股
// 崩盤事件簿，不能放進來嗎? 「市場階段」，跟「宣告事件」如果分開sidebar功能呢？」）.
//
// WHY THIS IS A SEPARATE THING from market-events.ts, and why the split is the whole answer.
//
// The events page admits only declarations with a date, and that rule correctly EXCLUDES「1990
// 台股崩盤」— it is named after a market move and has no declaration behind it. The rule exists so
// that nobody hand-picks the events that sit above big drops; admitting the crash itself would be
// exactly that. But a reader who lived through 1990 is right that the page is missing something.
//
// The resolution is that a drawdown is a different KIND of fact. A declaration is a fact about the
// world（「某機構某日宣告」）; a drawdown is a fact about the series（「指數從 A 跌到 B，跌了 X%」）.
// Neither claims the other caused it, and the second needs no curation at all — it is computed.
// So：
//
//   宣告事件   external, dated, cited, chosen by having a declaration date
//   市場階段   internal, computed, chosen by exceeding a threshold, NEVER named
//
// The threshold is the only parameter, and it is an external convention rather than ours: 20% is
// the textbook definition of a bear market. Every phase over it appears; none under it does; the
// series decides.
//
// NO NAMES. A row says「1990-02 高 11,983 → 1990-10 低 2,912，−75.7%」and nothing else. The reader
// who remembers 台灣泡沫 will connect it themselves; the page never writes 泡沫, 股災 or 崩盤 next
// to a number, because those are judgements about a period and the number is the period.
//
// WHAT THE MONTHLY-AVERAGE SERIES DOES AND DOES NOT CATCH, stated on the page so a reader does not
// conclude something is missing: a sharp V that recovers within the quarter is halved by averaging.
// COVID is the example — daily closes fell 28.7% from 2020-01 to 2020-03（12,180 → 8,681）while the
// monthly averages fell 15.2%（11,962 → 10,138）, under the threshold. That is a property of the
// series, not an omission: this page finds SUSTAINED declines, the events page marks the
// declaration, and neither page is trying to be the other.
//
// ALGORITHM. A symmetric zigzag: a peak is confirmed once the series has fallen `threshold` below
// it, a trough once the series has risen `threshold` above it. Naive「fall from the all-time high」
// was measured first and rejected — the 1990-02 high（11,983 on this series）was not exceeded until
// 2020-07, so it produced ONE thirty-year drawdown that swallowed 2000 and 2008 whole. The zigzag
// resets its peak after every confirmed recovery, which is what lets each decline stand on its own.
export interface IndexMonth {
  period: string
  value: number
}

export interface MarketPhase {
  peakPeriod: string
  peakValue: number
  troughPeriod: string
  troughValue: number
  // Negative, in percent.
  declinePct: number
  // The first month at or above the peak again, or null while still below it.
  recoveryPeriod: string | null
  // Still falling at the end of the series — the trough is provisional.
  open: boolean
}

export const BEAR_THRESHOLD_PCT = 20

export function findMarketPhases(months: IndexMonth[], thresholdPct: number = BEAR_THRESHOLD_PCT): MarketPhase[] {
  if (months.length < 2) return []
  const down = 1 - thresholdPct / 100
  const up = 1 + thresholdPct / 100
  const phases: MarketPhase[] = []
  let peak = months[0]!
  let trough = months[0]!
  // 1 = rising, looking for a peak; -1 = falling, looking for a trough.
  let direction: 1 | -1 = 1

  for (const month of months) {
    if (direction === 1) {
      if (month.value > peak.value) peak = month
      if (month.value <= peak.value * down) {
        direction = -1
        trough = month
      }
    } else {
      if (month.value < trough.value) trough = month
      if (month.value >= trough.value * up) {
        phases.push(phaseOf(peak, trough, months, false))
        direction = 1
        peak = month
      }
    }
  }
  if (direction === -1) phases.push(phaseOf(peak, trough, months, true))
  return phases
}

function phaseOf(peak: IndexMonth, trough: IndexMonth, months: IndexMonth[], open: boolean): MarketPhase {
  const after = months.filter(month => month.period > trough.period)
  const recovery = after.find(month => month.value >= peak.value) ?? null
  return {
    peakPeriod: peak.period,
    peakValue: peak.value,
    troughPeriod: trough.period,
    troughValue: trough.value,
    declinePct: (trough.value / peak.value - 1) * 100,
    recoveryPeriod: recovery?.period ?? null,
    open
  }
}
