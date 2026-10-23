// GET /api/hub/filter-schema — useFilterSchema 讀的精簡指標目錄（server/utils/hub-data.ts 的 getFilterSchemaCatalog，2026-10-16）。
// 會畫長文字（limitations、misreadings）的頁面讀完整的 /api/hub/metrics；兩支都來自同一份快取的 GET /metrics
export default defineEventHandler(() => getFilterSchemaCatalog().catch(() => {
  throw createError({ statusCode: 503, statusMessage: 'metric catalog unavailable' })
}))
