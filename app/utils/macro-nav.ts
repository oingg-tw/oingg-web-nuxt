// 總經特區的側邊欄（2026-09-22「可以成立總經特區了，Sidebar 就放不同指標跟大盤比較」）。序列型的頁面從 MACRO_PAGES 推導，頁面與
// 導覽不會脫鉤；前五項各自有 route file（離散的決議事件、多算法對照，進不了序列模板），手列在前面：大事件年表最前（不需要先懂任何
// 指標）、三個政策利率頁欄位不對應所以沒合併成註冊表（gov-ts 建議）、股票風險溢酬連時間軸都沒有。description 是 /macro 索引頁每列的
// 一句話——有它索引頁才值得被索引，不是導覽的複本（2026-10-08 從 macro/index.vue 搬來）。
export interface MacroNavNode {
  label: string
  to: string
  description: string
}

export const MACRO_NAV_ITEMS: MacroNavNode[] = [
  { label: '大事件年表', to: '/macro/market-events', description: '1987 年以來的重大事件，對照大盤自己算出的每一段下跌：高點、低點、跌幅、回到前高的時間，以及當時發生了什麼。' },
  { label: '政策利率', to: '/macro/policy-rate', description: '中央銀行歷次升降息的生效日與重貼現率，對照加權股價指數的月收盤。' },
  { label: '聯準會升降息', to: '/macro/us-policy-rate', description: '美國聯準會歷次升降息的生效日與聯邦資金利率目標區間，對照加權股價指數的月收盤。' },
  { label: '歐洲央行升降息', to: '/macro/ecb-policy-rate', description: '歐洲央行歷次升降息的生效日與三支政策利率（存款機制、主要再融資、邊際貸款），對照加權股價指數的月收盤。' },
  { label: '股票風險溢酬', to: '/macro/equity-risk-premium', description: '股票比公債多賺多少：歷史法與供給面模型兩種算法，四個窗口長度並排。' },
  ...MACRO_PAGES.map(page => ({ label: page.topic, to: macroPagePath(page.slug), description: page.description }))
]
