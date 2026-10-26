// 冷啟動等待的量測（2026-10-26，管理站轉達使用者的想法；使用者：「只記錄把中台 coldstart 叫醒的請求」）。
// 業務中台只在每個容器的第一個請求回 `Server-Timing: cold;desc="<coldStartId>"`；web-nuxt 伺服器看到就把 id 與等了多久寫進那個回應
// 自己的 Server-Timing（server/plugins/cold-start-timing.ts），瀏覽器載完讀 Navigation／Resource Timing，送回 /api/cold-start-timing，
// 再轉給業務中台 POST /cold-starts/{id}/client-timing 併進它的冷啟動紀錄。業務中台內部的分段只給管理站，不經這裡露給瀏覽器。
// 欄位與限制照業務中台定的（數字 0～600000 的整數或 null、route 以 / 開頭不含 ?、最長 300、其他欄位一律拒收）。
// 這個檔案不 import 任何東西：scripts/check-cold-start-timing.mjs 直接讀它

export interface ColdStartReport {
  id: string
  route: string
  kind: 'document' | 'api'
  at: string
  webWaitMs: number | null
  webServerMs: number | null
  webCold: boolean | null
  webUptimeMs: number | null
  ttfbMs: number | null
  responseEndMs: number | null
  dnsMs: number | null
  connectMs: number | null
  tlsMs: number | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MS_FIELDS = ['webWaitMs', 'webServerMs', 'webUptimeMs', 'ttfbMs', 'responseEndMs', 'dnsMs', 'connectMs', 'tlsMs'] as const

// 業務中台回應標頭裡的冷啟動 id：`cold;desc="<uuid>"`（可能跟其他項目用逗號串在一起）
export function coldStartIdOf(serverTiming: string | null | undefined): string | null {
  const match = serverTiming?.match(/(?:^|,)\s*cold\s*;[^,]*?desc\s*=\s*"?([0-9a-f-]{36})"?/i)
  return match && UUID.test(match[1]!) ? match[1]!.toLowerCase() : null
}

// web-nuxt 寫給瀏覽器的 Server-Timing：只有 web-nuxt 自己量到的數字
export function coldStartServerTiming(id: string, waitMs: number, serverMs: number, uptimeMs: number, webCold: boolean): string {
  return [`cold;desc="${id}"`, `wait;dur=${Math.round(waitMs)}`, `web;dur=${Math.round(serverMs)}`, `webup;dur=${Math.round(uptimeMs)}`, ...(webCold ? ['webcold'] : [])].join(', ')
}

interface TimingEntry {
  name: string
  startTime: number
  domainLookupStart: number
  domainLookupEnd: number
  connectStart: number
  connectEnd: number
  secureConnectionStart: number
  responseStart: number
  responseEnd: number
  serverTiming?: readonly { name: string; duration: number; description: string }[]
}

// 瀏覽器端：一個 Navigation／Resource Timing 項目 → 回報內容；回應沒有 cold 就是 null（這次沒有叫醒業務中台）。
// 時間都從這個請求開始算（document 的 startTime 是 0）；跨網域或沒量到的段落是 0，當成 null
export function coldStartReportOf(entry: TimingEntry, kind: 'document' | 'api', timeOrigin: number): ColdStartReport | null {
  const timing = new Map((entry.serverTiming ?? []).map(item => [item.name, item]))
  const id = timing.get('cold')?.description
  if (!id || !UUID.test(id)) return null
  const span = (from: number, to: number) => (from > 0 && to >= from ? to - from : null)
  const sinceStart = (at: number) => (at > 0 ? at - entry.startTime : null)
  const dur = (name: string) => timing.get(name)?.duration ?? null
  return {
    id,
    route: new URL(entry.name).pathname.slice(0, 300),
    kind,
    at: new Date(timeOrigin + entry.startTime).toISOString(),
    webWaitMs: dur('wait'),
    webServerMs: dur('web'),
    webCold: timing.has('webcold'),
    webUptimeMs: dur('webup'),
    ttfbMs: sinceStart(entry.responseStart),
    responseEndMs: sinceStart(entry.responseEnd),
    dnsMs: span(entry.domainLookupStart, entry.domainLookupEnd),
    connectMs: span(entry.connectStart, entry.connectEnd),
    tlsMs: span(entry.secureConnectionStart, entry.connectEnd)
  }
}

// 伺服器端收到的回報（公開端點，什麼都可能送來）：只留定好的欄位，其他欄位、格式不對就整筆不收
export function cleanColdStartReport(raw: unknown): ColdStartReport | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const input = raw as Record<string, unknown>
  const allowed = new Set<string>(['id', 'route', 'kind', 'at', 'webCold', ...MS_FIELDS])
  if (Object.keys(input).some(key => !allowed.has(key))) return null
  const { id, route, kind, at, webCold } = input
  if (typeof id !== 'string' || !UUID.test(id)) return null
  if (typeof route !== 'string' || !route.startsWith('/') || route.includes('?') || route.length > 300) return null
  if (kind !== 'document' && kind !== 'api') return null
  if (typeof at !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(at) || Number.isNaN(Date.parse(at))) return null
  if (webCold !== undefined && webCold !== null && typeof webCold !== 'boolean') return null
  const ms: Partial<Record<(typeof MS_FIELDS)[number], number | null>> = {}
  for (const field of MS_FIELDS) {
    const value = input[field]
    if (value === undefined || value === null) ms[field] = null
    else if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 600_000) ms[field] = Math.round(value)
    else return null
  }
  return { id: id.toLowerCase(), route, kind, at, webCold: webCold ?? null, ...ms } as ColdStartReport
}
