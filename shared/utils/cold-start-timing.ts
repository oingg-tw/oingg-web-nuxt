// 冷啟動等待的量測（2026-10-26，管理站轉達使用者的想法；使用者：「只記錄把中台 coldstart 叫醒的請求」）。
// 業務中台只在每個容器的第一個請求回 `Server-Timing: cold;desc="<coldStartId>"`；web-nuxt 伺服器看到就把每個 id 與等了多久寫進那個回應
// 自己的 Server-Timing（server/plugins/cold-start-timing.ts），瀏覽器載完讀 Navigation／Resource Timing，每個 id 送一份回 /api/cold-start-timing，
// 再轉給業務中台 POST /cold-starts/{id}/client-timing 併進它的冷啟動紀錄。業務中台內部的分段只給管理站，不經這裡露給瀏覽器。
// 欄位與限制照業務中台定的（數字 0～600000 的整數或 null、route 以 / 開頭不含 ?、最長 300、其他欄位一律拒收）。
// 這個檔案不 import 任何東西：scripts/check-cold-start-timing.mjs 直接讀它

export interface ColdStartReport {
  id: string
  route: string
  kind: 'document' | 'api'
  at: string
  // 名稱 2026-10-28 對齊詞彙表（使用者選「管理站能讀新名後就改」；舊名 webWaitMs／webWaitAllMs／webCold／ttfbMs，業務中台收到 11/11；
  // webUptimeMs 是 App Hosting 的行程啟動時間，同日退役）。Worker 量的三段：等這個冷容器那一支業務中台呼叫、等所有業務中台呼叫
  //（同時的只算一次）、處理整個請求（含等業務中台）
  webColdWaitMs: number | null
  // 從 web-nuxt 收到這個請求到送出叫醒這台容器的那一支（2026-10-28，對上業務中台的到達時刻就分得出晚送還是網路）
  webColdOffsetMs: number | null
  // 那一支回應主體的 UTF-8 位元組數（2026-10-31，管理站：等待比到達、回完多出來的 0.3～0.6 秒是不是回應大）。webColdWaitMs 算到主體讀完、
  // 解析完，所以大的回應等比較久；沒拿到回應（逾時、連不上）是 null
  webColdResponseBytes: number | null
  webBusinessWaitMs: number | null
  webServerMs: number | null
  isWebCold: boolean | null
  // 以下三個是瀏覽器 Navigation／Resource Timing 的 requestStart／responseStart／responseEnd 減掉這個請求的 startTime（相對開始的偏移，
  // 不是各段自己的長度）。requestStart 之前是 DNS／連線與瀏覽器自己（2026-10-27 管理站提議、使用者核准；測試機的 Chromium 約 2.8 秒）
  requestStartMs: number | null
  responseStartMs: number | null
  responseEndMs: number | null
  dnsMs: number | null
  connectMs: number | null
  tlsMs: number | null
  // 使用者連進的 Cloudflare 機房（2026-10-27 使用者核准）：中華電信固網進 SJC、行動網路進 SIN，冷啟動要分開看。三個大寫字母；本機沒有，是 null
  edgeColo: string | null
  // 瀏覽器到 Cloudflare 入口的 TCP 來回（request.cf.clientTcpRtt，2026-10-28）：第 1 段扣掉它，剩下的是 Cloudflare 那一側（含 isolate 啟動，量不到）
  clientTcpRttMs: number | null
  // 叫醒數據中台那次（2026-10-28）：從收到請求到送出（冷 isolate 含換 ID token）、換 token 多久、送出到回應；頁面回應前沒回來就是 null
  webWakeOffsetMs: number | null
  webWakeMs: number | null
  webWakeTokenMs: number | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLO = /^[A-Z]{3}$/
const MS_FIELDS = ['webColdWaitMs', 'webColdOffsetMs', 'webBusinessWaitMs', 'webServerMs', 'requestStartMs', 'responseStartMs', 'responseEndMs', 'dnsMs', 'connectMs', 'tlsMs',
  'clientTcpRttMs', 'webWakeOffsetMs', 'webWakeMs', 'webWakeTokenMs'] as const
// 回應大小的上限（業務中台同一個數字）：最大的日線歷史約 1 MB，100 MB 只是擋亂送的
const MAX_RESPONSE_BYTES = 100_000_000

// 業務中台回應標頭裡的冷啟動 id：`cold;desc="<uuid>"`（可能跟其他項目用逗號串在一起）
export function coldStartIdOf(serverTiming: string | null | undefined): string | null {
  const match = serverTiming?.match(/(?:^|,)\s*cold\s*;[^,]*?desc\s*=\s*"?([0-9a-f-]{36})"?/i)
  return match && UUID.test(match[1]!) ? match[1]!.toLowerCase() : null
}

export interface ColdStartWait {
  id: string
  waitMs: number
  // 從 web-nuxt 收到這個請求到送出這一支（2026-10-28，管理站要分出「web-nuxt 晚送」和「網路」）
  offsetMs?: number
  // 回應主體的 UTF-8 位元組數（2026-10-31）
  bytes?: number
}

// 叫醒數據中台的那一次 GET /（server/utils/business.ts 的 wakeAnalysis）：從收到請求到送出、換 ID token、送出到回應
export interface AnalysisWake {
  offsetMs: number
  tokenMs: number
  ms: number
}

// web-nuxt 寫給瀏覽器的 Server-Timing：只有 web-nuxt 自己量到的數字。一頁可能同時叫醒好幾個容器（2026-10-26 DEV 實測：一頁同時打
// 約 10 支，Cloud Run 一次開了 4 個，各帶一個 id；卡最久的是 /stocks/:symbol 7 秒），每個冷啟動一項 cold，dur 是等那一支多久
// waitall 是這一趟等所有業務中台呼叫的時間，同時進行的只算一次（管理站把「web-nuxt 自己」和「等同一頁其他請求」分開）。
// 沒有冷啟動的回應也寫（colds 是空的，2026-10-27），只是沒有 cold 那幾項；
// colo 是 Cloudflare 的入口機房，沒有就不寫。
// 2026-10-28（管理站要把「網路＋開容器」拆開）：coldsent 是送出那一支的時間點（從收到請求算）；rtt 是瀏覽器到入口的 TCP 來回；
// wake／wakesent／waketoken 是叫醒數據中台那次，回應送出前還沒回來就不寫。
// coldbytes（2026-10-31）是那一支回應的位元組數，借 dur 放（Server-Timing 只有 dur 是數字）
export function coldStartServerTiming(colds: readonly ColdStartWait[], waitAllMs: number, serverMs: number, webCold: boolean, colo: string | null, clientTcpRttMs: number | null = null, wake: AnalysisWake | null = null): string {
  return [
    ...colds.flatMap(cold => [
      `cold;dur=${Math.round(cold.waitMs)};desc="${cold.id}"`,
      ...(cold.offsetMs === undefined ? [] : [`coldsent;dur=${Math.round(cold.offsetMs)};desc="${cold.id}"`]),
      ...(cold.bytes === undefined ? [] : [`coldbytes;dur=${cold.bytes};desc="${cold.id}"`])
    ]),
    `waitall;dur=${Math.round(waitAllMs)}`,
    `web;dur=${Math.round(serverMs)}`,
    ...(webCold ? ['webcold'] : []),
    ...(clientTcpRttMs === null ? [] : [`rtt;dur=${Math.round(clientTcpRttMs)}`]),
    ...(wake ? [`wake;dur=${Math.round(wake.ms)}`, `wakesent;dur=${Math.round(wake.offsetMs)}`, `waketoken;dur=${Math.round(wake.tokenMs)}`] : []),
    ...(colo ? [`colo;desc="${colo}"`] : [])
  ].join(', ')
}

// 一組 [開始, 結束] 的聯集長度：重疊的只算一次
export function unionMs(intervals: readonly (readonly [number, number])[]): number {
  let total = 0
  let end = -Infinity
  for (const [from, to] of [...intervals].sort((a, b) => a[0] - b[0])) {
    if (to <= end) continue
    total += to - Math.max(from, end)
    end = to
  }
  return total
}

interface TimingEntry {
  name: string
  startTime: number
  domainLookupStart: number
  domainLookupEnd: number
  connectStart: number
  connectEnd: number
  secureConnectionStart: number
  requestStart: number
  responseStart: number
  responseEnd: number
  serverTiming?: readonly { name: string; duration: number; description: string }[]
}

// 瀏覽器端：一個 Navigation／Resource Timing 項目 → 每個冷啟動一份回報（webColdWaitMs 各自是等那一支多久，其餘相同）；
// 回應沒有 cold 就是空陣列（這次沒有叫醒業務中台）。時間都從這個請求開始算（document 的 startTime 是 0）；沒量到的段落是 0，當成 null
export function coldStartReportsOf(entry: TimingEntry, kind: 'document' | 'api', timeOrigin: number): ColdStartReport[] {
  const items = entry.serverTiming ?? []
  const colds = items.filter(item => item.name === 'cold' && UUID.test(item.description))
  if (!colds.length) return []
  const span = (from: number, to: number) => (from > 0 && to >= from ? to - from : null)
  const sinceStart = (at: number) => (at > 0 ? at - entry.startTime : null)
  const dur = (name: string) => items.find(item => item.name === name)?.duration ?? null
  const shared = {
    route: new URL(entry.name).pathname.slice(0, 300),
    kind,
    at: new Date(timeOrigin + entry.startTime).toISOString(),
    webBusinessWaitMs: dur('waitall'),
    webServerMs: dur('web'),
    isWebCold: items.some(item => item.name === 'webcold'),
    requestStartMs: sinceStart(entry.requestStart),
    responseStartMs: sinceStart(entry.responseStart),
    responseEndMs: sinceStart(entry.responseEnd),
    dnsMs: span(entry.domainLookupStart, entry.domainLookupEnd),
    connectMs: span(entry.connectStart, entry.connectEnd),
    tlsMs: span(entry.secureConnectionStart, entry.connectEnd),
    edgeColo: items.find(item => item.name === 'colo' && COLO.test(item.description))?.description ?? null,
    clientTcpRttMs: dur('rtt'),
    webWakeOffsetMs: dur('wakesent'),
    webWakeMs: dur('wake'),
    webWakeTokenMs: dur('waketoken')
  }
  const ofId = (name: string, id: string) => items.find(item => item.name === name && item.description.toLowerCase() === id)?.duration ?? null
  return colds.map((cold) => {
    const id = cold.description.toLowerCase()
    return { id, webColdWaitMs: cold.duration, webColdOffsetMs: ofId('coldsent', id), webColdResponseBytes: ofId('coldbytes', id), ...shared }
  })
}

// 伺服器端收到的回報（公開端點，什麼都可能送來）：只留定好的欄位，其他欄位、格式不對就整筆不收
export function cleanColdStartReport(raw: unknown): ColdStartReport | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const input = raw as Record<string, unknown>
  const allowed = new Set<string>(['id', 'route', 'kind', 'at', 'isWebCold', 'edgeColo', 'webColdResponseBytes', ...MS_FIELDS])
  if (Object.keys(input).some(key => !allowed.has(key))) return null
  const { id, route, kind, at, isWebCold, edgeColo, webColdResponseBytes: bytes } = input
  if (typeof id !== 'string' || !UUID.test(id)) return null
  if (typeof route !== 'string' || !route.startsWith('/') || route.includes('?') || route.length > 300) return null
  if (kind !== 'document' && kind !== 'api') return null
  if (typeof at !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(at) || Number.isNaN(Date.parse(at))) return null
  if (isWebCold !== undefined && isWebCold !== null && typeof isWebCold !== 'boolean') return null
  if (edgeColo !== undefined && edgeColo !== null && (typeof edgeColo !== 'string' || !COLO.test(edgeColo))) return null
  if (bytes !== undefined && bytes !== null && !(Number.isInteger(bytes) && (bytes as number) >= 0 && (bytes as number) <= MAX_RESPONSE_BYTES)) return null
  const ms: Partial<Record<(typeof MS_FIELDS)[number], number | null>> = {}
  for (const field of MS_FIELDS) {
    const value = input[field]
    if (value === undefined || value === null) ms[field] = null
    else if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 600_000) ms[field] = Math.round(value)
    else return null
  }
  return { id: id.toLowerCase(), route, kind, at, isWebCold: isWebCold ?? null, edgeColo: edgeColo ?? null, webColdResponseBytes: bytes ?? null, ...ms } as ColdStartReport
}
