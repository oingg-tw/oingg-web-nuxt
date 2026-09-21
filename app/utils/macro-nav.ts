// 總經特區 的導覽樹（2026-09-22,「可以成立 總經特區 了，Sidebar 就放不同指標跟大盤比較」）.
//
// The zone's premise is one page per macro series, each read against the market index — so every
// entry here pairs a gov-ts dataset with 加權股價指數. That pairing is the whole point, and it is
// also why this zone exists separately from the per-stock navigation: a macro series is about the
// market, and nothing under /stock/{code} would ever lead to it.
//
// WHY MOST OF IT IS PARKED. gov-ts holds eight macro datasets; exactly two are reachable from this
// app today（cbc_policy_rate and the TAIEX index）. The other six sit in their `export` schema with
// no endpoint, requested from analysis-ts on 2026-09-22 in the priority order below — which is
// gov-ts's own ranking by explanatory power against the index, not this app's guess.
//
// Parked entries stay here as comments rather than living somewhere else, the same convention
// APP_FEATURES uses for its shelved pages: the plan is worth keeping next to the thing it plans,
// and un-parking is then a one-line edit rather than an archaeology exercise. Each one records
// what it is waiting on, so nobody re-derives that.
export interface MacroNavNode {
  label: string
  to: string
}

export const MACRO_NAV_ITEMS: MacroNavNode[] = [
  { label: '政策利率與大盤', to: '/macro/policy-rate' }

  // ── 等 analysis-ts 的端點（依 gov-ts 建議的解釋力排序）─────────────────────────────
  //
  // 景氣燈號與大盤        monthly_business_cycle_indicator（月，1982-01 起 535 筆）
  //   signal_score 9–45 配 signal_light 五色；分數折線 + 燈號色帶當背景，疊大盤月線。
  //   gov-ts 把它排第一，理由是它對大盤的解釋力最直接。
  //
  // 貨幣供給與大盤        monthly_monetary_aggregate（月，1987-05 起 471 筆）
  //   M1B 年增率 vs M2 年增率兩條線。注意：這一頁只畫線，不寫「黃金交叉代表資金流入股市」
  //   那種結論——那是判斷，不是這個站能寫的句子。
  //
  // 公債殖利率與大盤      monthly_gov_bond_yield_10y（月，1994-01 起 369 筆）
  //   無風險利率，跟本益比反向。可以跟政策利率放同一張圖（都是利率、同一個 % 軸）。
  //
  // 台幣匯率與大盤        daily_usd_twd_rate（日，1992-01 起 8,945 筆）
  //   ⚠ 日頻但落後約一個月（CBC 隨月報批次補），所以頁面必須標明資料涵蓋到哪一天，
  //   不能呈現成「今日匯率」。數字越小＝台幣越強，軸向要特別說明。
  //
  // 通膨與大盤            monthly_cpi（月，1981-01 起；category='total'）
  //   CPI 年增率。端點會保留 category 參數，之後要拆七大類不用改後端。
  //
  // 經濟成長率與大盤      quarterly_gdp（季，1981-Q1 起；category='growth_rate'）
  //   季頻，跟月頻的大盤對齊要另外處理。
  //
  // 不在計畫內：monthly_unemployment_rate。gov-ts 自己也列為次要，而且是落後指標——
  // 前六個做完再評估，不是漏掉。
]

// The sidebar renders only when the zone has more than one destination. With a single page it
// would be a navigation control that navigates nowhere, which is worse than no control at all —
// so today /macro/policy-rate carries no sidebar, and the first un-parked entry above turns it on
// with no other change.
export const MACRO_NAV_ENABLED = MACRO_NAV_ITEMS.length > 1
