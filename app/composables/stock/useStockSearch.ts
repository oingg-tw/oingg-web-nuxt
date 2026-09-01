import type { Stock } from '~/composables/useStocks'

export function useStockSearch() {
  const { searchUniverse } = useStocks()
  const router = useRouter()

  const keyword = ref('')

  function fetchSuggestions(query: string, callback: (results: Stock[]) => void) {
    callback(searchUniverse(query))
  }

  function goToStock(code: string) {
    keyword.value = ''
    router.push(`/stock/${code}`)
  }

  function handleSelect(stock: Stock) {
    goToStock(stock.code)
  }

  function handleEnter() {
    const matches = searchUniverse(keyword.value)
    if (matches.length > 0) {
      goToStock(matches[0]!.code)
    }
  }

  return { keyword, fetchSuggestions, handleSelect, handleEnter }
}
