import { h } from 'vue'
import { ElMessage } from 'element-plus'

// 額度用完時的提示，全站同一句話、同一個去處（2026-10-06「完善付費方案」）。原本每個功能各說各的：持股欄位
// 有說明但「升級方案」是純文字、觀察清單只說「已達上限」、篩選器只顯示「新增分頁失敗」。
//
// 措辭只陳述數量與兩條路（刪掉不需要的、或升級），不催促、不倒數。價格還沒定（使用者決定等定價研究），
// 所以不寫金額；連結去 /profile#plan 看方案與用量。
export function showQuotaReached(what: string) {
  ElMessage({
    type: 'warning',
    duration: 8000,
    showClose: true,
    message: h('span', { class: 'app-undo-toast' }, [
      h('span', `${what}已達目前方案的上限。可以刪掉不需要的，或之後升級專業版。`),
      // 真的 <a>（右鍵、新分頁都能用），點擊時走 SPA 導覽，不整頁重載
      h('a', {
        href: '/profile#plan',
        class: 'app-undo-toast__action',
        onClick: (event: MouseEvent) => {
          event.preventDefault()
          void navigateTo('/profile#plan')
        }
      }, '看方案')
    ])
  })
}
