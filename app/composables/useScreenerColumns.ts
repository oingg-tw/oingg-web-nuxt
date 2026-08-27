export interface ScreenerColumnPref {
  field: string
  metricName?: string
  fieldName?: string
}

// Confirmed contract (oingg-bff-ts API reference): GET/PUT {apiBase}/screener/columns,
// both requiring a Firebase ID token. PUT is a full overwrite (not incremental) and its
// array order is the display order. This preference is per-user, not per-preset — every
// screener tab shares the same displayed-columns setting, and GET .../presets/{id}/run
// returns whatever was last saved here regardless of which tab triggered the search.
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
