// 手機鍵盤蓋住多高（2026-11-07）：鍵盤打開時 iOS 與 Android Chrome 都只縮可視區、版面高度不變，貼底的面板和清單最後幾列就留在鍵盤後面。
// 寫進 --app-keyboard-inset，用的人讀它或 main.css 的 --app-bottom-inset。雙指放大和網址列收合也會讓可視區變小，不算鍵盤：
// 放大中一律 0，差不到 100px 也是 0（最矮的鍵盤都比這高）
const MIN_KEYBOARD_HEIGHT = 100

export default defineNuxtPlugin(() => {
  const viewport = window.visualViewport
  if (!viewport) return
  const update = () => {
    const covered = Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
    const inset = viewport.scale > 1.01 || covered < MIN_KEYBOARD_HEIGHT ? 0 : covered
    document.documentElement.style.setProperty('--app-keyboard-inset', `${inset}px`)
  }
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
})
