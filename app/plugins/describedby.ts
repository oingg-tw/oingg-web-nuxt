import type { DirectiveBinding } from 'vue'

// v-describedby="id"：把 aria-describedby 放到元件裡面的原生 <input> 上。Element Plus 的 el-input-number／el-date-picker 把這個
// 屬性留在外層 div（2026-10-08 實測），朗讀器聚焦欄位時聽不到旁邊的提示句；放在 el-form-item 的 label 裡又會讓欄位名稱變長。
// 值是 undefined 時拿掉屬性（提示句有條件才出現）。
function apply(el: HTMLElement, binding: DirectiveBinding<string | undefined>) {
  const input = el.matches('input') ? el : el.querySelector('input')
  if (!input) return
  if (binding.value) input.setAttribute('aria-describedby', binding.value)
  else input.removeAttribute('aria-describedby')
}

export default defineNuxtPlugin(({ vueApp }) => {
  vueApp.directive<HTMLElement, string | undefined>('describedby', { mounted: apply, updated: apply, getSSRProps: () => ({}) })
})
