// 更新紀錄的分組、篩選、站內連結與台灣時間（app/utils/release-notes.ts）。Run: node scripts/check-release-notes.mjs
import assert from 'node:assert/strict'
import { activeBanner, inboxNotes, releaseKindOf, sitePath, splitReleaseNotes, taipeiDate, taipeiDateTime } from '../app/utils/release-notes.ts'

// 站內信與全站橫幅（2026-11-16）
{
  const now = Date.parse('2026-11-16T12:00:00Z')
  const at = (id, channel, publishedAt, bannerEndsAt = null) => ({ id, kind: 'site', publishedAt, title: id, changes: [], channel, bannerEndsAt })
  const notes = [
    at('old-inbox', 'inbox', '2025-10-01T00:00:00Z'),
    at('inbox-a', 'inbox', '2026-11-10T00:00:00Z'),
    at('inbox-b', 'inbox', '2026-11-15T00:00:00Z'),
    at('plain', null, '2026-11-16T00:00:00Z'),
    at('banner-ended', 'banner', '2026-11-14T00:00:00Z', '2026-11-15T00:00:00Z'),
    at('banner-open', 'banner', '2026-11-15T00:00:00Z'),
    at('banner-new', 'banner', '2026-11-16T06:00:00Z', '2026-11-20T00:00:00Z'),
    at('banner-future', 'banner', '2026-11-17T00:00:00Z')
  ]
  assert.deepEqual(inboxNotes(notes, now).map(note => note.id), ['inbox-b', 'inbox-a'], '站內信：近 12 個月、新的在上，一般更新不算')
  assert.equal(activeBanner(notes, now, [])?.id, 'banner-new', '橫幅：同時有好幾則掛最新的；過期、還沒發布的不掛')
  assert.equal(activeBanner(notes, now, ['banner-new'])?.id, 'banner-open', '關掉的不再掛，換下一則；沒有結束時刻的一直掛')
  assert.equal(activeBanner(notes, now, ['banner-new', 'banner-open']), null)
}

const note = (id, kind, extra = {}) => ({ id, kind, publishedAt: '2026-10-29T06:00:00Z', title: id, changes: [], ...extra })
const items = [
  note('outage', 'maintenance', { startedAt: '2026-10-29T05:00:00Z', endedAt: null }),
  note('share', 'site'),
  note('metric', 'data'),
  note('fixed-outage', 'maintenance', { startedAt: '2026-10-28T05:00:00Z', endedAt: '2026-10-28T06:30:00Z' }),
  note('future-kind', 'promo')
]
const ids = list => list.map(item => item.id)

// 進行中的維護公告不管篩選都在上面，時間軸不重複；沒見過的種類只在「全部」
assert.deepEqual(ids(splitReleaseNotes(items, null).ongoing), ['outage'])
assert.deepEqual(ids(splitReleaseNotes(items, null).timeline), ['share', 'metric', 'fixed-outage', 'future-kind'])
assert.deepEqual(ids(splitReleaseNotes(items, 'maintenance').timeline), ['fixed-outage'])
assert.deepEqual(ids(splitReleaseNotes(items, 'data').ongoing), ['outage'])
// endedAt 沒給（undefined）也算進行中
assert.deepEqual(ids(splitReleaseNotes([note('no-end', 'maintenance')], null).ongoing), ['no-end'])

// ?kind= 不認得的當全部
assert.equal(releaseKindOf('site'), 'site')
assert.equal(releaseKindOf('promo'), null)
assert.equal(releaseKindOf('toString'), null)
assert.equal(releaseKindOf(['site']), null)
assert.equal(releaseKindOf(undefined), null)

// 只有站內路徑給連結
assert.equal(sitePath('/watchlist?list=1'), '/watchlist?list=1')
assert.equal(sitePath('/'), '/')
for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', '/a\\b', 'javascript:alert(1)', 'watchlist', '', null, undefined]) {
  assert.equal(sitePath(bad), null, String(bad))
}

// 台灣時間：UTC 16:30 是隔天 00:30；壞的字串回空字串
assert.equal(taipeiDate('2026-10-28T16:30:00Z'), '2026-10-29')
assert.equal(taipeiDateTime('2026-10-28T16:30:00Z'), '2026-10-29 00:30')
assert.equal(taipeiDateTime('2026-10-29T06:05:00Z'), '2026-10-29 14:05')
assert.equal(taipeiDate('not a date'), '')
assert.equal(taipeiDate(null), '')

console.log('PASS: release notes')
