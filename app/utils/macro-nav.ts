// 總經特區的側邊欄（2026-09-22「可以成立總經特區了，Sidebar 就放不同指標跟大盤比較」）。序列型的頁面從 MACRO_PAGES 推導，頁面與
// 導覽不會脫鉤；前幾項各自有 route file（離散的事件、多算法對照，進不了序列模板），手列在前面。景氣時鐘第一（2026-10-21，使用者：
//「總經特區拿 景氣時鐘 當首頁」「景氣時鐘 移到 sidebar 第一個」）：它就是 /macro，同個股與 ETF 側欄最上面的速覽首頁
export interface MacroNavNode {
  label: string
  to: string
}

export const MACRO_NAV_ITEMS: MacroNavNode[] = [
  { label: '景氣時鐘', to: '/macro' },
  { label: '大事件年表', to: '/macro/market-events' },
  { label: '股票風險溢酬', to: '/macro/equity-risk-premium' },
  ...MACRO_PAGES.map(page => ({ label: page.topic, to: macroPagePath(page.slug) }))
]
