// 總經特區的側邊欄（2026-09-22「可以成立總經特區了，Sidebar 就放不同指標跟大盤比較」）。序列型的頁面從 MACRO_PAGES 推導，頁面與
// 導覽不會脫鉤；前五項各自有 route file（離散的決議事件、多算法對照，進不了序列模板），手列在前面：大事件年表最前（不需要先懂任何
// 指標）、三個政策利率頁欄位不對應所以沒合併成註冊表（gov-ts 建議）、股票風險溢酬連時間軸都沒有。原本每一項還帶一句說明給 /macro
// 索引頁的表用；2026-10-21 那一頁改成各項的最新數值（那張表跟側欄是重複資訊），說明一起拿掉
export interface MacroNavNode {
  label: string
  to: string
}

export const MACRO_NAV_ITEMS: MacroNavNode[] = [
  { label: '大事件年表', to: '/macro/market-events' },
  { label: '景氣時鐘', to: '/macro/business-cycle-clock' },
  { label: '股票風險溢酬', to: '/macro/equity-risk-premium' },
  ...MACRO_PAGES.map(page => ({ label: page.topic, to: macroPagePath(page.slug) }))
]
