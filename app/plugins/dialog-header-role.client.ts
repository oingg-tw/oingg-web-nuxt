// el-dialog／el-drawer 的標題列是 Element Plus 寫死的 <header>。append-to-body 的對話框會落在 <body> 底下、不在任何
// 分段元素裡，於是被當成第二個 banner 地標，跟網站頁首重複（axe landmark-no-duplicate-banner，2026-10-08 登入輪量到
// 「新增分頁」對話框；全站 8 個 append-to-body 的對話框都是同一個原因）。
//
// 標題列沒有插槽能換掉這個元素，所以在這裡統一把它標成 role="none"（ARIA in HTML 允許 header 用 none），對話框本身仍是
// role="dialog"、標題仍由 aria-labelledby 指到。只看新加進來的節點，不在每次 DOM 變動時掃整頁。
// 不改成 append-to 自訂容器：伺服器渲染時 Nuxt 只處理固定的傳送目標，換目標有渲染不出來的風險（2026-10-11 評估）。
const SELECTOR = 'header.el-dialog__header, header.el-drawer__header'

function mark(root: Element) {
  if (root.matches(SELECTOR)) root.setAttribute('role', 'none')
  root.querySelectorAll(SELECTOR).forEach(header => header.setAttribute('role', 'none'))
}

export default defineNuxtPlugin(() => {
  mark(document.body)
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) mark(node)
      })
    }
  }).observe(document.body, { childList: true, subtree: true })
})
