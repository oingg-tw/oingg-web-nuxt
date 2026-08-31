// Whether Firebase's onAuthStateChanged has fired at least once — distinct from
// useCurrentUser() being non-null, since a real "signed out" resolution also leaves that
// null. Anything that renders differently for guest vs signed-in (e.g. useScreenerTabs'
// tab bootstrap) needs this to avoid optimistically rendering the guest state and then
// swapping it out once sign-in actually resolves — see useScreenerTabs.ts's own comment for
// the concrete bug this fixed (a full tab/results swap on every reload, reported as visible
// UI jitter).
export function useAuthResolved() {
  return useState('firebase-auth-resolved', () => false)
}
