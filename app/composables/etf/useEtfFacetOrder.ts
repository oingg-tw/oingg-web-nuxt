// ETF 面向的順序（2026-10-18，使用者：「這邊的 sidebar 要跟個股瀏覽那邊的 sidebar 一樣可以拖曳排序」）。存法見 useFacetOrder
//（2026-10-21 跟類股個別頁共用）；「指標速覽」固定在最上面，不參與排序
export const useEtfFacetOrder = () => useFacetOrder('etf-facet-order', ETF_FACETS.filter(facet => facet.key !== 'overview'))
