// 只留頁面真的會讀的欄位（2026-10-08 盤點刪了 22 個沒人讀的：董事長、發言人、地址、電話、股務代理…）：這份物件
// 會進每個個股頁的 SSR payload。metricDataType 留著（2026-09-22 的決定，見下）。
export interface NormalizedCompanyProfile {
  name: string | null
  shortName: string | null
  // 證交所類股代碼（生態系詞彙表：sectorCode，中文「類股」；2026-10-11 內部名稱也跟著改），類股名稱查 SECTORS。listedDate 讀的是上游的 listingDate。
  // 實收資本、股數那四個欄位與 auditingFirm 2026-11-03 拿掉：沒有地方讀，卻用 BigInt()／String() 轉了一遍（String(null) 還會變成 "null"）
  // sectorName、establishedDate 2026-11-08 拿掉：一樣沒有地方讀（數據中台盤點 /companies/profile 的讀者時查到）
  // 沒有類股是 null（原本 String(null) 會變成字面上的 "null"）
  sectorCode: string | null
  listedDate: Date | null
  // financialReportType／financialReportTypeName 2026-10-10 刪掉：從來沒有地方讀它們，而上游同日改名成 declaredDataType 時
  // 編碼方向也反了（舊的交易所代碼 "1"＝合併，新的 MOPS 編號 "2"＝合併，跟 metricDataType 同向）。要顯示「合併／個別」時
  // 讀 raw.declaredDataType，"2"＝合併、"1"＝個別——別照舊欄位的方向寫。
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
  // 面額（parValue、parValueCurrency、isNoParValue）2026-11-08 不讀了：唯一的讀者是摘要卡那句，使用者「Summary不該放說明文字」
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date
}

// Real backend responses can't carry Date over JSON, so the raw payload arrives
// as ISO date strings — hydrate it into the typed shape here.
function hydrateCompanyProfile(raw: Record<string, unknown>): NormalizedCompanyProfile {
  // 全名 companyFullName、簡稱 companyName
  const name = raw.companyFullName
  const shortName = raw.companyName
  return {
    // 不再用 String()：null 會變成字面上的 "null" 名稱（業務中台 f750e92）
    name: typeof name === 'string' ? name : null,
    shortName: typeof shortName === 'string' ? shortName : null,
    sectorCode: typeof raw.sectorCode === 'string' && raw.sectorCode ? raw.sectorCode : null,
    listedDate: toDate(raw.listingDate),
    metricDataType: (raw.metricDataType as string | null) ?? null
  }
}

// GET /stocks/{symbol}/profile（業務中台 2026-09-02 以 2330／8299 實測；欄位名與 NormalizedCompanyProfile 一致）。404＝兩個市場都
// 沒有這檔的公司資料，不記錄為錯誤。讀取失敗往上丟（不捏造董事長／
// 會計師／統編那類看起來像真的資料（以前真的這樣渲染過隨機值））；404 才回 null。
// 參數是路由上的 symbol ref（2026-09-14 起），不再要求先有一個已解析的 Stock 物件。
// 2026-09-19 起走本站的快取直通 /api/cached（server/api/cached），同路徑同形狀，伺服器快取 24 小時。
export function useCompanyProfile(symbol: Ref<string | undefined>) {
  return useAsyncData<NormalizedCompanyProfile | null>(
    () => `company-profile-${symbol.value ?? 'none'}`,
    async () => {
      const current = symbol.value
      if (!current) return null

      try {
        const raw = await apiFetch<Record<string, unknown>>(`/stocks/${current}/profile`, { baseURL: BUSINESS_CACHED_BASE })
        return hydrateCompanyProfile(raw)
      } catch (error) {
        // 只有 404 是「沒有這檔」；其他失敗往上丟，交給 useStockDetailSummary 報給全站讀取失敗彈窗（2026-10-11）。
        // 原本一律回 null，讀不到時每一個個股頁都說「找不到這檔股票」。
        if (classifyApiError(error).status === 404) return null
        devWarn('company-profile', `GET /api/cached/stocks/${current}/profile unavailable`, error)
        throw error
      }
    },
    { watch: [symbol] }
  )
}
