export interface FieldCatalogEntry {
  field: string
  label: string
  formula: string
  inputs: string[]
}

interface FieldCatalogResponse {
  fields: FieldCatalogEntry[]
}

// bff-ts's GET /stocks/preferred-stocks/field-catalog (confirmed live 2026-09-08, proxying
// analysis-ts's own /preferred-stocks/field-catalog) — a static description of how every
// derived/calculated preferred-stock field is computed (formula + the real fields it reads),
// built in response to a direct request that every shown value be traceable back to its
// source rather than just appearing as a bare number. Doesn't take query params and doesn't
// hit a database per bff-ts/analysis-ts's own description, so this is fetched once and cached
// for the session like every other schema-shaped fetch in this app (useEtfFilterSchema.ts,
// usePreferredStockList.ts's own list fetch).
export function useFieldCatalog() {
  const config = useRuntimeConfig()
  const fields = useState<FieldCatalogEntry[] | null>('preferred-stocks-field-catalog', () => null)
  const pending = ref(false)

  async function load() {
    if (fields.value !== null) return
    pending.value = true
    try {
      const result = await $fetch<FieldCatalogResponse>('/stocks/preferred-stocks/field-catalog', {
        baseURL: config.public.apiBase,
        retry: 0
      })
      fields.value = result.fields
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[preferred-stocks-field-catalog] GET ${config.public.apiBase}/stocks/preferred-stocks/field-catalog unavailable (${reason})`)
      }
      fields.value = []
    } finally {
      pending.value = false
    }
  }

  function fieldFormula(field: string): string | null {
    return fields.value?.find(item => item.field === field)?.formula ?? null
  }

  load()

  return { fields, pending, fieldFormula }
}
