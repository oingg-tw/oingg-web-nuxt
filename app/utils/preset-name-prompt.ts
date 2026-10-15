import { ElMessageBox } from 'element-plus'

// 「我的篩選」「欄位組合」取名的對話框（2026-10-15 三組篩選共用）：改名、存成我的篩選、存成我的欄位組合都用這一個，名稱規則只寫一次。
// 取消回 null。1 到 20 個字（業務中台 不限長度，這是畫面上選單放得下的長度）。
export async function promptPresetName(title: string, initial: string, confirmText = '儲存'): Promise<string | null> {
  try {
    const { value } = await ElMessageBox.prompt('名稱', title, {
      inputValue: initial,
      confirmButtonText: confirmText,
      cancelButtonText: '取消',
      inputValidator: (input: string) => (input.trim().length > 0 && input.trim().length <= 20) || '名稱要 1 到 20 個字'
    })
    return String(value).trim()
  } catch {
    return null
  }
}
