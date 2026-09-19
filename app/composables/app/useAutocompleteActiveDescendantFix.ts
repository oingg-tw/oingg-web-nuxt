// Element Plus's el-autocomplete keeps `aria-activedescendant` on its <input> even while nothing
// is highlighted — it renders `${listboxId}-item--1` (highlightedIndex −1), an id that never
// exists — and axe reports it as a critical `aria-valid-attr-value` on every page with the
// header search (2026-09-19). WAI-ARIA wants the attribute absent (or empty) when no descendant
// is active. This watches the attribute and removes it whenever it points at an element that
// isn't in the document; a real highlighted option's id is left alone. Removing the attribute
// triggers one more mutation whose value is null, which is a no-op — no loop.
//
// Client-only by nature (DOM + MutationObserver): on the server it registers nothing at all —
// the `immediate` watcher below would otherwise run during SSR (real 500 caught on first run:
// "HTMLElement is not defined"). And it must never take a page down: el-autocomplete's root is a
// Fragment, so its `$el` is the first NODE (a comment/text node, not an element — a second real
// error, "root.matches is not a function", rendered the whole page as a 500 on the next run), so
// the <input> is looked up from the nearest element, and everything is wrapped so a future
// Element Plus markup change can only cost the fix, not the page.
export function useAutocompleteActiveDescendantFix(rootRef: Ref<{ $el?: Node } | Node | null | undefined>) {
  if (import.meta.server) return

  let observer: MutationObserver | undefined

  function attach(rootNode: Node) {
    const container = rootNode.nodeType === Node.ELEMENT_NODE ? (rootNode as Element) : rootNode.parentElement
    if (!container) return
    const input = container.matches('input') ? container : container.querySelector('input')
    if (!input) return
    const fix = () => {
      const value = input.getAttribute('aria-activedescendant')
      if (value !== null && (value === '' || !document.getElementById(value))) input.removeAttribute('aria-activedescendant')
    }
    fix()
    observer?.disconnect()
    observer = new MutationObserver(fix)
    observer.observe(input, { attributes: true, attributeFilter: ['aria-activedescendant'] })
  }

  watch(
    rootRef,
    instance => {
      try {
        // A component instance exposes its root node via $el; a plain node is used as is.
        const node = instance && 'nodeType' in instance ? (instance as Node) : (instance as { $el?: Node } | null | undefined)?.$el
        if (node) attach(node)
      } catch (error) {
        if (import.meta.dev) console.warn('[autocomplete-aria] could not attach the aria-activedescendant fix', error)
      }
    },
    { immediate: true, flush: 'post' }
  )

  onUnmounted(() => {
    observer?.disconnect()
  })
}
