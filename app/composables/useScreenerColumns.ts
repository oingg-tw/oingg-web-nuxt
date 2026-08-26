export interface ScreenerColumnPref {
  field: string
  metricName?: string
  fieldName?: string
}

// Confirmed contract (oingg-bff-ts API reference): GET/PUT {apiBase}/screener/columns,
// both requiring a Firebase ID token. PUT is a full overwrite (not incremental) and its
// array order is the display order — POST /screener has no columns param of its own, it
// always returns whatever was last saved here, so the screener page calls save() right
// before every search to keep the two in sync.
export function useScreenerColumns() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  async function save(fields: string[]) {
    if (!currentUser.value) return null
    try {
      const token = await currentUser.value.getIdToken()
      const response = await $fetch<{ columns: ScreenerColumnPref[] }>('/screener/columns', {
        baseURL: config.public.apiBase,
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: { columns: fields.map(field => ({ field })) }
      })
      return response.columns
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[filter] PUT ${config.public.apiBase}/screener/columns failed (${reason})`)
      }
      return null
    }
  }

  return { save }
}
