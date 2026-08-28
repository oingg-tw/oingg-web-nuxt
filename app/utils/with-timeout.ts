// Races a promise against a timer so a hung dependency (a stalled Firebase token refresh,
// a request that never settles, etc.) always eventually rejects instead of leaving an
// `await` chain — and anything waiting on it, e.g. a button's loading state reset in a
// `finally` — stuck forever.
export function withTimeout<T>(promise: Promise<T>, ms: number, message = '操作逾時'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
