// 減資那一段的文字（app/utils/capital-reductions.ts）：答案、比率與退還金額、表格底下那一句
// Run: node scripts/check-capital-reductions.mjs
import assert from 'node:assert/strict'
import { reductionAnswer, reductionRatioText, reductionRemark, refundText } from '../app/utils/capital-reductions.ts'

const base = { lastTradeDate: null, reductionRecordDate: null, shareExchangeRecordDate: null, haltStartDate: null, haltEndDate: null }
// 3629 的形狀：三次彌補虧損已恢復買賣、一次剛公告
const done = { ...base, firstAnnouncedOn: '2017-10-19', resumeDate: '2018-04-03', newSharesPerThousand: 656.060477, refundPerShare: 0, kind: 'loss_offset', reductionRatioPct: 34.39, reductionRecordDate: '2018-02-05', shareExchangeRecordDate: '2018-04-02', haltStartDate: '2018-03-27', haltEndDate: '2018-04-02' }
const older = { ...done, firstAnnouncedOn: '2014-03-17', resumeDate: '2014-11-07' }
const upcoming = { ...base, firstAnnouncedOn: '2026-09-24', resumeDate: null, newSharesPerThousand: 550, refundPerShare: 0, kind: 'loss_offset', reductionRatioPct: 45 }
assert.equal(reductionAnswer([], '甲'), '查不到甲的減資紀錄。')
assert.equal(reductionAnswer([upcoming, done, older], '甲'), '甲在 2026-09-24 公告彌補虧損減資 45%，還沒恢復買賣；之前減資過 2 次。')
assert.equal(reductionAnswer([older, done], '甲'), '甲減資過 2 次，最近一次是 2017-10-19 公告的彌補虧損減資 34.39%，2018-04-03 恢復買賣。')
// 3526：退還股款，金額到小數四位
const refund = { ...base, firstAnnouncedOn: '2026-10-27', resumeDate: null, newSharesPerThousand: null, refundPerShare: 2.5, kind: 'cash_refund', reductionRatioPct: 25 }
assert.equal(reductionAnswer([refund], '乙'), '乙在 2026-10-27 公告退還股款減資 25%（每股退 2.5 元），還沒恢復買賣。')
assert.equal(refundText({ ...refund, refundPerShare: 2.498557764 }), '2.4986 元')
assert.equal(refundText(done), '－')
assert.equal(reductionRatioText({ ...refund, reductionRatioPct: 24.99 }), '24.99%')
assert.equal(reductionRatioText({ ...refund, reductionRatioPct: null }), '－')
// 不認得的原因不寫
assert.equal(reductionAnswer([{ ...refund, kind: 'other', refundPerShare: 0 }], '乙'), '乙在 2026-10-27 公告減資 25%，還沒恢復買賣。')
// 表格底下那一句：有的才寫
assert.equal(reductionRemark(done), '每千股換發 656.06 股；減資基準日 2018-02-05；換發新股基準日 2018-04-02；停止買賣 2018-03-27～2018-04-02')
assert.equal(reductionRemark(refund), '')
assert.equal(reductionRemark(upcoming), '每千股換發 550 股')
console.log('PASS: capital reductions')
