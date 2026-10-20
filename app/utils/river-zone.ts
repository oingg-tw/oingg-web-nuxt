// 河流圖的區間名稱（2026-10-21，使用者：「河流圖希望可以用中文表示 因為我們有區間 幫想中文…比如 破頂 破底」，選了「層」這一組）。
// 只說在河道的哪一層，不帶評價（偏高、偏低在 compliance-words 的禁用詞裡）。篩選器的同名欄位上線後，中文以型錄的 options 為準，
// 兩邊要一致。scripts/check-river-zone.mjs
export const RIVER_ZONE_NAMES = ['破底', '底層', '下層', '中層', '上層', '頂層', '破頂'] as const

// multiples：河道線的倍數，由低到高（6 條線＝5 條河道）。回傳 RIVER_ZONE_NAMES 的位置：0＝低於最下面那條線、1～5＝由下往上
// 第幾條河道、6＝高於最上面那條線。剛好在線上算下面那一層，最下面那條線本身算底層。比值與倍數都先四捨五入到 2 位再比——
// 這幾條跟篩選器的河道位置欄位（analysis-ts 的 *RiverBand.EOD，值就是這個 0～6）是同一份契約，2026-10-21 兩邊對齊過
export function riverZoneIndex(value: number, multiples: readonly number[]): number {
  const round = (n: number) => Math.round(n * 100) / 100
  const ratio = round(value)
  if (ratio < round(multiples[0]!)) return 0
  for (let k = 1; k < multiples.length; k++) if (ratio <= round(multiples[k]!)) return k
  return multiples.length
}
