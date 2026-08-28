// Coalesces rapid-fire calls (e.g. every keystroke in a number input) into one, delayMs
// after the last call. Exposes `cancel()` so a pending call can be dropped outright —
// e.g. when whatever it was scheduled for (a tab) no longer exists.
export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const debounced = (...args: Args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delayMs)
  }
  debounced.cancel = () => clearTimeout(timer)

  return debounced
}
