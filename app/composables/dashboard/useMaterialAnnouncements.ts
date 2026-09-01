// Confirmed live with bff-ts 2026-09-01: GET /market/material-announcements?limit=20 —
// 重大訊息公告, newest first by announcement date. Real data now (twse-ts's own schedule is
// stable, 254 real rows confirmed), no backfill wait like foreign-holding-ranking had. No
// auth, `name` already included.
export interface MaterialAnnouncement {
  symbol: string
  name: string | null
  announcementDate: string
  // twse-ts's own raw HHMMSS, NOT zero-padded (e.g. "70003" for 07:00:03) and not
  // reformatted server-side — see formatAnnouncementTime in MaterialAnnouncementCard.vue for
  // the HH:mm conversion.
  announcementTime: string
  reportDate: string
  subject: string
  clause: string
  factDate: string
  description: string
}

export interface MaterialAnnouncementsResponse {
  limit: number
  items: MaterialAnnouncement[]
  warnings: string[]
}

const FALLBACK: MaterialAnnouncementsResponse = {
  limit: 20,
  items: [],
  warnings: ['offline fallback']
}

export function useMaterialAnnouncements(limit = 20) {
  const config = useRuntimeConfig()

  return useAsyncData<MaterialAnnouncementsResponse>(
    `material-announcements-${limit}`,
    async () => {
      try {
        return await $fetch<MaterialAnnouncementsResponse>('/market/material-announcements', {
          baseURL: config.public.apiBase,
          query: { limit }
        })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[material-announcements] GET ${config.public.apiBase}/market/material-announcements unavailable (${reason}), using fallback instead`
          )
        }
        return FALLBACK
      }
    },
    { default: () => FALLBACK }
  )
}
