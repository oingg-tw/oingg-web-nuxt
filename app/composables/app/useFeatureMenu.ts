// Shared visible state for AppFeatureMenu.vue's fullscreen nav dialog — pulled out of that
// component's own local ref() so a second trigger (StockSearchBar.vue's mobile-only menu
// button, replacing the logo's old home-link behavior) can open the exact same dialog
// instance instead of each owning a separate one. useState (not a plain module-level ref) for
// the same SSR-safety reason every other cross-component toggle in this app uses it — a bare
// module ref would leak state across requests on the server.
export function useFeatureMenu() {
  const visible = useState('feature-menu-visible', () => false)

  function open() {
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  return { visible, open, close }
}
