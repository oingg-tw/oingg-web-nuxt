// 特別股個別頁的舊網址 301 到特別股專區（2026-10-18，/screener/preferred/{代號} → /preferred/{代號}）。只轉特別股代號的格式
//（四碼數字＋一個字母，2887Z1 這種再多一個字元）：/screener/preferred 篩選頁本身照舊。不用 routeRules 的 /** ——那會連篩選頁一起轉走
export default defineEventHandler((event) => {
  const match = /^\/screener\/preferred\/(\d{4}[a-z][a-z0-9]?)\/?$/i.exec(getRequestURL(event).pathname)
  if (match) return sendRedirect(event, `/preferred/${match[1]!.toLowerCase()}`, 301)
})
