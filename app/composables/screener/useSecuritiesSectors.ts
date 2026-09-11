export interface SecuritiesSector {
  code: string
  name: string
  companyCount: number
}

// bff-ts's GET /industries/securities-sectors (confirmed live 2026-09-11, commit relayed
// cross-session) — 40 TWSE/TPEx "證交所類股" codes (e.g. "24" 半導體業), a DIFFERENT
// classification system from the 稅籍 industry tree on industries.vue (see that page's own
// comment: "與個股頁的證交所產業分類是不同的兩套系統，不能互相對照"). Public, guest-usable, no
// auth — same as GET /industries/tree. Whole-market list, effectively static within a session,
// same fetch-once treatment as useFilterSchema.ts's own getCachedData.
export function useSecuritiesSectors() {
  const config = useRuntimeConfig()

  return useAsyncData<SecuritiesSector[]>(
    'securities-sectors',
    async () => {
      try {
        const response = await $fetch<{ sectors: SecuritiesSector[] }>('/industries/securities-sectors', {
          baseURL: config.public.apiBase
        })
        return response.sectors
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[securities-sectors] GET ${config.public.apiBase}/industries/securities-sectors unavailable (${reason})`)
        }
        return []
      }
    },
    { default: () => [], getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key] }
  )
}
