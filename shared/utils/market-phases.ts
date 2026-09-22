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

// 當時的背景 — what was going on during each computed phase（2026-09-22,「每一段都請上網找，一定有
// 事件發生，未必是單一日期，但是也請蒐集起來呈現」）.
//
// This is the one place in 總經特區 that carries NARRATIVE, and the discipline around it is what
// lets it stay: every line is a dated fact verified against Wikipedia the day it was written（the
// page the user pointed at:「可以從wikipedia找找資料」）, each phase names its sources, and no line
// says 導致／造成／引發. The heading on the page is「當時發生了什麼」, not「為什麼跌」— it lists what
// the world was doing while the index fell, and stops.
//
// Keyed by the phase's PEAK MONTH, which is a computed value: a restated index series could shift a
// peak by a month and silently orphan its context. scripts/check-market-phases.mjs asserts every
// computed phase has an entry here, so that drift fails loudly instead of leaving a blank cell.
//
// A phase with no entry renders「（尚未整理）」, never nothing — an empty cell beside a 40% decline
// reads as「nothing happened」, which is a claim.
export interface PhaseContext {
  // Dated facts, one per line, in date order. Descriptive only.
  facts: string[]
  // Wikipedia article titles the facts were checked against.
  sources: string[]
}

export const PHASE_CONTEXT: Record<string, PhaseContext> = {
  '1987-10': {
    facts: ['1987-10-19 黑色星期一：華爾街及世界各地股市同日崩盤，短時間內市值大幅蒸發。'],
    sources: ['黑色星期一']
  },
  '1988-09': {
    facts: [
      '1988-09-24 財政部長郭婉容於收盤後召開記者會，宣布自 1989-01-01 起復徵證券交易所得稅。',
      '假期後開盤起，台股連續 19 個交易日無量下跌，累計 3,174 點、跌幅 37%；證所稅政策最終在壓力下終止，改課證券交易稅。'
    ],
    sources: ['郭婉容', '1988年臺灣']
  },
  '1990-02': {
    facts: [
      '1990-02-12 加權指數收在 12,682 點的歷史高點；同年 10-12 跌至 2,485 點。',
      '廣場協議後新台幣持續升值，1990 年一度達 24.62 元兌 1 美元；預期升值的熱錢大量流入，資金充斥股市與房市。',
      '政府公告地價 1989 年上漲 47.31%、1990 年上漲 103.05%，之後轉為下跌。',
      '1990-08-02 伊拉克入侵科威特，波斯灣戰爭爆發。'
    ],
    sources: ['台灣泡沫經濟', '波斯灣戰爭']
  },
  '1991-05': {
    facts: [
      '泡沫破裂後的第二段回落：指數自 5,459 點高峰下滑 13 個月，至 1993-01-08 的 3,098 點，下跌 43.25%。',
      '1991-01-17 至 02-28 波斯灣戰爭進入沙漠風暴行動階段；公告地價自 1990 年的高峰轉為下降。'
    ],
    sources: ['加權指數', '台灣泡沫經濟', '波斯灣戰爭']
  },
  '1994-09': {
    facts: [
      '1994-12 墨西哥爆發金融危機（龍舌蘭效應），開發中國家市場大幅波動。',
      '1995-06 總統李登輝訪問美國康乃爾大學；1995-07-21 至 07-28 解放軍向台灣北方海域試射東風-15 飛彈六枚，第一次台海飛彈危機。'
    ],
    sources: ['龍舌蘭酒效應', '台灣海峽飛彈危機']
  },
  '1997-08': {
    facts: [
      '1997-07-02 泰國放棄固定匯率，泰銖當日貶值約 17%，亞洲金融風暴自東南亞擴散；8 月馬來西亞放棄保衛令吉。',
      '台灣經濟隨之放緩，財政盈餘轉為赤字。',
      '1998 年國產汽車因本業獲利下滑、股市自九千多點跌至六千多點、資金調度困難而宣告破產，為當年本土企業財務危機之一。'
    ],
    sources: ['亞洲金融風暴', '國產汽車股份有限公司', '台灣經濟史']
  },
  '2000-02': {
    facts: [
      '2000-03-10 那斯達克綜合指數達 5,048 點高峰後開始下跌，網際網路泡沫破裂。',
      '2000-03 總統大選由陳水扁、呂秀蓮勝出，中華民國行憲以來首次政黨輪替，05-20 就職。',
      '2000-10-27 行政院長張俊雄宣布停建核四。',
      '2001-09-11 美國 911 事件，紐約證交所停市至 09-17。',
      '2001-12-02 安隆公司聲請破產，資產總額 634 億美元，為當時美國史上最大破產案。'
    ],
    sources: ['網際網路泡沫', '2000年中華民國總統選舉', '龍門核能發電廠', '安隆醜聞案']
  },
  '2002-04': {
    facts: [
      '美國企業會計醜聞接連曝光：2002-06 世界通訊、2002-07 Adelphia；2002-07-21 世界通訊聲請破產保護，超越安隆成為美國史上最大破產案。',
      '2002-10-09 那斯達克 100 指數跌至 1,114 點，較高峰下跌 78%；自泡沫高點以來美股市值蒸發 5 兆美元。'
    ],
    sources: ['網際網路泡沫', '世界通訊', '沙賓法案']
  },
  '2007-10': {
    facts: [
      '2007-08-09 起美國次級房貸危機浮現。',
      '2008-09-15 雷曼兄弟向紐約南區破產法院聲請第 11 章破產保護。',
      '多間大型金融機構倒閉或被政府接管；全球隨後進入經濟衰退。'
    ],
    sources: ['2008年環球金融危機', '美國次貸危機時間表']
  },
  '2011-01': {
    facts: [
      '2011-03-11 日本東北大地震。',
      '歐洲主權債務危機持續。',
      '2011-08-05 標準普爾將美國主權信用評等自 AAA 調降至 AA+，為 94 年來首次；08-04 美股三大指數跌幅 4.3%–5.1%，08-05 亞太股市走跌，08-08 全球股市再度大跌。'
    ],
    sources: ['2011年美國債務上限危機', '歐洲主權債務危機', '標普全球評級']
  },
  '2022-01': {
    facts: [
      '2022-02-24 俄羅斯入侵烏克蘭。',
      '2022-03-16 美國聯準會宣布升息，啟動本輪升息循環。'
    ],
    sources: ['俄羅斯入侵烏克蘭', '聯邦公開市場委員會']
  }
}

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
