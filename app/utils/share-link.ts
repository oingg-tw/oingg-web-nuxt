import { ElMessage } from 'element-plus'

// 分享一個網址（2026-10-19 從 StockSummaryCard 的 shareStock 抽出來，個股頁的分享鈕與分享連結對話框共用）。
// copyLink：寫進剪貼簿，提示「連結已複製」。shareLink：先開系統的分享選單（navigator.share，手機上可以直接傳到 LINE 等），
// 沒有這個功能的瀏覽器（2026-09 桌機 Chrome／Firefox 都還沒有）退回複製。使用者自己關掉分享選單（AbortError）不是失敗，不提示。
export async function copyLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('連結已複製')
  } catch {
    showErrorMessage('複製連結失敗')
  }
}

export async function shareLink(title: string, url: string): Promise<void> {
  if (!navigator.share) return copyLink(url)
  try {
    await navigator.share({ title, url })
  } catch (error) {
    if ((error as Error).name !== 'AbortError') showErrorMessage('分享失敗，請稍後再試')
  }
}
