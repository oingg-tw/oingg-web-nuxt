export type EtfFilterFieldKind = 'numeric' | 'categorical'

export interface EtfFilterField {
  field: string
  label: string
  kind: EtfFilterFieldKind
  // Only present when kind === 'categorical' (confirmed live 2026-09-07: GET
  // /etf-screener/filters returns e.g. { field: 'market', kind: 'categorical',
  // values: ['TWSE', 'TPEx'] } — numeric fields have no `values` at all, not an empty array).
  values?: string[]
  // Added 2026-09-11 alongside the category regrouping below — numeric fields only (e.g. "元"/
  // "%"/"人"), categorical/date fields never carry one. Optional/absent on anything fetched
  // before this date's payload, same "don't invent it" convention as every other bff-ts-sourced
  // optional field in this app.
  unit?: string
}

export interface EtfFilterCategory {
  categoryKey: string
  categoryDisplayName: string
  fields: EtfFilterField[]
}

// Real bug found live 2026-09-11 (relayed cross-session by analysis-ts: "GET /etf-screener/
// filters 回應形狀改變，比照股票端 GET /filters 建立指標選單") — analysis-ts regrouped their own
// upstream endpoint from a flat field list into 5 categories (identity/sizeAndFlow/navAndPrice/
// performance/cost), matching the stock screener's own GET /metrics shape. bff-ts's proxy hadn't
// caught up yet at the moment this was relayed (confirmed live: GET /etf-screener/filters
// through bff-ts returned a hard error, "response is missing a fields array" — its own
// validation was still checking for the old flat shape against the new nested payload underneath
// it). This composable is the one place every ETF screener consumer (EtfFilterEditor.vue/
// EtfResultTable.vue) reads field metadata from, all via the exact same flat `fields` array this
// file already exposed — rather than redesign those into a grouped picker (no request to do
// that; the ETF screener only has ~20 fields total, still not enough to need one), `fields` stays
// a flattened concat of every category's own fields, so every existing caller keeps working
// unchanged. `categories` is exposed alongside it for a future grouped picker if the field count
// ever grows enough to want one.
interface EtfFilterSchemaResponse {
  categories: EtfFilterCategory[]
}

// bff-ts's GET /etf-screener/filters (confirmed live 2026-09-07, proxying sitca-ts's
// export.etf_basic_info) — regrouped into categories 2026-09-11 (see above), still genuinely
// simpler than the stock screener's own GET /metrics in practice (ETF has ~20 fields total across
// 5 categories, no deep metric→field nesting). Client-only/own-cache like every other
// filter-schema fetch in this app — this rarely changes within a session, and every screener page
// here treats it the same way.
export function useEtfFilterSchema() {
  const config = useRuntimeConfig()
  const categories = useState<EtfFilterCategory[] | null>('etf-filter-categories', () => null)
  const fields = computed<EtfFilterField[]>(() => categories.value?.flatMap(category => category.fields) ?? [])
  const pending = ref(false)

  async function load() {
    if (categories.value !== null) return
    pending.value = true
    try {
      const result = await $fetch<EtfFilterSchemaResponse>('/etf-screener/filters', {
        baseURL: config.public.apiBase,
        retry: 0
      })
      categories.value = result.categories
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[etf-filter-schema] GET ${config.public.apiBase}/etf-screener/filters unavailable (${reason})`)
      }
      categories.value = []
    } finally {
      pending.value = false
    }
  }

  function fieldLabel(field: string): string {
    return fields.value.find(item => item.field === field)?.label ?? field
  }

  load()

  return { fields, categories, pending, fieldLabel }
}
