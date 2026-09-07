export type EtfFilterFieldKind = 'numeric' | 'categorical'

export interface EtfFilterField {
  field: string
  label: string
  kind: EtfFilterFieldKind
  // Only present when kind === 'categorical' (confirmed live 2026-09-07: GET
  // /etf-screener/filters returns e.g. { field: 'market', kind: 'categorical',
  // values: ['TWSE', 'TPEx'] } — numeric fields have no `values` at all, not an empty array).
  values?: string[]
}

interface EtfFilterSchemaResponse {
  fields: EtfFilterField[]
}

// bff-ts's GET /etf-screener/filters (confirmed live 2026-09-07, proxying sitca-ts's
// export.etf_basic_info) — a flat field list, genuinely simpler than the stock screener's own
// GET /filters (nested category → metric → field hierarchy, see useFilterSchema.ts): ETF has
// ~20 fields total, no need for a browsable 3-level picker. Client-only/own-cache like every
// other filter-schema fetch in this app — this rarely changes within a session, and every
// screener page here treats it the same way.
export function useEtfFilterSchema() {
  const config = useRuntimeConfig()
  const fields = useState<EtfFilterField[] | null>('etf-filter-schema', () => null)
  const pending = ref(false)

  async function load() {
    if (fields.value !== null) return
    pending.value = true
    try {
      const result = await $fetch<EtfFilterSchemaResponse>('/etf-screener/filters', {
        baseURL: config.public.apiBase,
        retry: 0
      })
      fields.value = result.fields
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[etf-filter-schema] GET ${config.public.apiBase}/etf-screener/filters unavailable (${reason})`)
      }
      fields.value = []
    } finally {
      pending.value = false
    }
  }

  function fieldLabel(field: string): string {
    return fields.value?.find(item => item.field === field)?.label ?? field
  }

  load()

  return { fields, pending, fieldLabel }
}
