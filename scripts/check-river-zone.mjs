// The one runnable check for app/utils/river-zone.ts: which of the 7 river zones a ratio falls in. Pure, no network.
//
// Run: node scripts/check-river-zone.mjs
import { RIVER_ZONE_NAMES, riverZoneIndex } from '../app/utils/river-zone.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const zone = value => RIVER_ZONE_NAMES[riverZoneIndex(value, [7, 9.8, 12.6, 15.4, 18.2, 21])]

assert(zone(6.9) === '破底', '低於最下面那條線是破底')
assert(zone(7) === '底層', '最下面那條線本身算底層')
assert(zone(9.8) === '底層', '剛好在線上算下面那一層')
assert(zone(9.81) === '下層', '過線就是上面那一層')
assert(zone(14) === '中層', '中間那條是中層')
assert(zone(16) === '上層', '第四條是上層')
assert(zone(21) === '頂層', '最上面那條線本身算頂層')
assert(zone(21.01) === '破頂', '高於最上面那條線是破頂')
assert(RIVER_ZONE_NAMES.length === 7, '5 條河道＋河外上下兩塊＝7 個名稱')

console.log(failures ? `\n${failures} 項失敗` : '\n全部通過')
process.exitCode = failures ? 1 : 0
