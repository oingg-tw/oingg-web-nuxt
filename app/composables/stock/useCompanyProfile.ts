// 只留頁面真的會讀的欄位（2026-10-08 盤點刪了 22 個沒人讀的：董事長、發言人、地址、電話、股務代理…）：這份物件
// 會進每個個股頁的 SSR payload。financialReportType／metricDataType 留著（2026-09-22 的決定，見下）。
export interface NormalizedCompanyProfile {
  // 興櫃。**三態，`null` 不是疏漏**（bff-ts 2026-10-01）：上游正式環境還沒部署這個欄位，缺席時
  // bff 給 `null` 而不是 `false`——`false` 會把興櫃說成「不是興櫃」，那是一個**錯的標籤**，而錯的
  // 標籤比缺一個標籤糟（它會讓我們宣稱「這家公司有單季資料」而它永久沒有）。
  //
  //   true  → 興櫃。可以寫「這類公司沒有這個數字」
  //   false → 不是興櫃。單季為空就是真的尚無資料
  //   null  → 上游還沒送。**不要斷言任何事**，維持沒有這個欄位時的行為
  //
  // 刻意不用 `Boolean(raw.isEmerging)` 收斂成兩態：那會把 null 變成 false，正是上面要避免的。
  // 也刻意只接受真正的布林值——字串 `"false"` 用 truthy 判斷會變成 true（bff-ts 那一層也加了
  // 同樣的守衛）。
  isEmerging: boolean | null
  name: string | null
  shortName: string | null
  foreignRegistrationCountry: string | null
  industry: string
  // TWSE-only for now (bff-ts 2026-09-02) — TPEx's own source data has no industry-name
  // mapping yet, so this is null for TPEx-listed companies until tpex-ts adds one. Don't
  // assume it'll always be present just because `industry` (the raw code) is.
  industryName: string | null
  establishedDate: Date | null
  listedDate: Date | null
  paidInCapital: bigint | null
  privatePlacementShares: bigint | null
  preferredStockShares: bigint | null
  // ⚠ TWO FIELDS, INVERTED CONVENTIONS. Read this before using either.
  //
  //   financialReportType（交易所代碼）  "1" = 合併    "2" = 個別
  //   metricDataType                    "2" = 合併    "1" = 個體
  //
  // They mean the same thing and number it the opposite way round, so a value copied from one to
  // the other silently inverts. The comment that used to sit here documented "1" -> 個別財報 /
  // "2" -> 合併財報, which was the mapping analysis-ts shipped BACKWARDS and corrected on
  // 2026-09-22 (21fdd2d4). Verified live after that fix: 2330/2317/2891 all return
  // financialReportType "1" with financialReportTypeName「合併財報」.
  //
  // Nothing has ever RENDERED financialReportTypeName — it is mapped here and read nowhere — so
  // the inverted label never reached a visitor. Kept mapped, with the mapping now stated correctly,
  // rather than deleted: the field is the natural one to show beside a financial statement, and a
  // page that shows the wrong one would be making a factual claim about which entity's numbers a
  // reader is looking at.
  financialReportType: string
  financialReportTypeName: string | null
  // Which basis this company's METRICS were computed on, added 2026-09-22 (21fdd2d4). Distinct
  // from the two fields above, which describe what the company FILES: 249 companies file only
  // individual statements and so had no computed metrics at all until analysis-ts started deriving
  // them from the individual report.
  //
  // This is the field to check before labelling anything「個體報表」. Verified live: "2"（合併）on
  // every symbol sampled. The "1"（個體）side is analysis-ts's stated contract but NOT yet observed
  // here — 20 symbols sampled the day it shipped were all "2", with their backfill still running,
  // so treat a "1" as expected-but-unseen rather than confirmed.
  metricDataType: string | null
  auditingFirm: string
  issuedShares: bigint | null
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date
}

function toBigInt(value: unknown): bigint | null {
  if (value === null || value === undefined || value === '') return null
  try {
    return BigInt(value as string | number)
  } catch {
    return null
  }
}

// Real backend responses can't carry Date/bigint over JSON, so the raw payload arrives
// as ISO date strings and stringified numbers — hydrate it into the typed shape here.
function hydrateCompanyProfile(raw: Record<string, unknown>): NormalizedCompanyProfile {
  return {
    isEmerging: typeof raw.isEmerging === 'boolean' ? raw.isEmerging : null,
    // 不再用 String()：null 會變成字面上的 "null" 名稱（bff-ts f750e92）
    name: typeof raw.name === 'string' ? raw.name : null,
    shortName: typeof raw.shortName === 'string' ? raw.shortName : null,
    foreignRegistrationCountry: (raw.foreignRegistrationCountry as string | null) ?? null,
    industry: String(raw.industry),
    industryName: (raw.industryName as string | null) ?? null,
    establishedDate: toDate(raw.establishedDate),
    listedDate: toDate(raw.listedDate),
    paidInCapital: toBigInt(raw.paidInCapital),
    privatePlacementShares: toBigInt(raw.privatePlacementShares),
    preferredStockShares: toBigInt(raw.preferredStockShares),
    financialReportType: String(raw.financialReportType),
    financialReportTypeName: (raw.financialReportTypeName as string | null) ?? null,
    metricDataType: (raw.metricDataType as string | null) ?? null,
    auditingFirm: String(raw.auditingFirm),
    issuedShares: toBigInt(raw.issuedShares)
  }
}

// GET /stocks/{symbol}/profile — confirmed live by bff-ts 2026-09-02 (tested against 2330/
// 台積電 and 8299/群聯), replacing the earlier /api/company-profile/{symbol} guess that turned
// out to be entirely wrong (see this file's git history / project_stock_chart_lookback_window_
// research memory). Field names match NormalizedCompanyProfile exactly — no renaming needed.
// 404 means the symbol has no company-profile record on either market (not an error to log).
// TPEx companies always have englishAddress: null (that field doesn't exist in TPEx's own
// source data, not a bug). Returns null on any failure rather than fabricating officer/
// registration data, since that used to render real-looking company details (chairman,
// auditor, tax ID, etc.) that were actually seeded random values. stock/[code].vue shows
// StockProfileCardShell when this comes back null, same treatment as the other unbacked
// per-stock charts.
//
// Signature changed 2026-09-14 from `stock: Ref<Stock | undefined>` to a plain `symbol` ref —
// the old signature only ever read `stock.value.code`, but required a resolved Stock object to
// exist first. On stock/[code].vue that Stock came from useStockUniverse()'s own fake fallback
// universe (see that file's own comment), so this fetch silently never fired for any symbol
// outside that ~20-stock mock list — the profile card, and everything gated on `profile` (e.g.
// the summary card's website/logo), just stayed empty for most of the real market. Taking the
// route param directly removes that dependency entirely.
//
// Fetched through this app's own cached passthrough（/api/bff, server/api/bff/[...path].get.ts）
// since 2026-09-19 — same path and shape, cached 24h on the server.
export function useCompanyProfile(symbol: Ref<string | undefined>) {
  return useAsyncData<NormalizedCompanyProfile | null>(
    () => `company-profile-${symbol.value ?? 'none'}`,
    async () => {
      const current = symbol.value
      if (!current) return null

      try {
        const raw = await $fetch<Record<string, unknown>>(`/stocks/${current}/profile`, {
          baseURL: '/api/bff',
          retry: 0,
          timeout: BFF_REQUEST_TIMEOUT_MS
        })
        return hydrateCompanyProfile(raw)
      } catch (error) {
        devWarn('company-profile', `GET /api/bff/stocks/${current}/profile unavailable`, error)
        return null
      }
    },
    { watch: [symbol] }
  )
}
