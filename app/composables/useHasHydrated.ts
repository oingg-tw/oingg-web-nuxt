// True once the app's very first client-side hydration has finished — false during SSR and
// during the client's initial hydration pass, then flips once via app.vue's onMounted and
// stays true for the rest of this browser session, including every later client-side route
// navigation (unlike a route component's own onMounted, which fires again on every remount).
//
// This is what lets a page avoid a hydration-mismatch-prone value (e.g. anything derived from
// Firebase auth, which resolves asynchronously and unpredictably relative to hydration) WITHOUT
// paying <ClientOnly>'s cost of re-deferring on every remount: gate on `hasHydrated.value &&
// theRealCondition` instead of wrapping in <ClientOnly>. During SSR and the client's first
// render, hasHydrated is false on both sides (onMounted can't have run yet either way), so
// there's nothing to mismatch regardless of what theRealCondition happens to be at that moment.
// After that first hydration, hasHydrated is already true, so a later remount (client-side nav
// back to the same page) renders directly from the current value with no artificial delay —
// see useScreenerTabs.ts's tabsReady comment for the concrete flash this fixed.
export function useHasHydrated() {
  return useState('app-has-hydrated', () => false)
}
