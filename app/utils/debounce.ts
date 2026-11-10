// Coalesces rapid-fire calls (e.g. every keystroke in a number input) into one, delayMs
// after the last call. Exposes `cancel()` so a pending call can be dropped outright —
// e.g. when whatever it was scheduled for (a tab) no longer exists — and `flush()` to run
// a pending call now (nothing pending, nothing runs), e.g. when the editing it waited on ends.
export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Args | undefined

  const debounced = (...args: Args) => {
    clearTimeout(timer)
    pending = args
    timer = setTimeout(() => debounced.flush(), delayMs)
  }
  debounced.cancel = () => {
    clearTimeout(timer)
    pending = undefined
  }
  debounced.flush = () => {
    const args = pending
    debounced.cancel()
    if (args) fn(...args)
  }

  return debounced
}
