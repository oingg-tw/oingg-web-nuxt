// 公司 logo — read straight from mops-ts's public GCS bucket, not through bff-ts（2026-09-23）.
//
// WHY WE READ THE MANIFEST OURSELVES rather than having analysis-ts forward it: the file is a
// symbol → {filename, size, luminance} map with no second-order computation in it, so a hop
// through analysis-ts and bff-ts would be pure forwarding. Four hops (mops → analysis → bff → our
// cache) also means four places a stale copy can sit, and this file changes often — mops re-runs
// `--weak-only`, adds overrides for wrong picks, and re-crawls sites that were down. A wrong
// FILENAME does not render a stale logo, it renders a broken image, because the extension is not
// fixed（png / ico / jpg / svg / gif / webp all appear）. analysis-ts agreed and holds no copy.
//
// No CORS is needed and none was asked for: this runs on the server, and the browser only ever
// sees the finished <img src>.
const BUCKET = 'https://storage.googleapis.com/public.mops.oingg.com'

// Revalidate hourly, serve up to a day stale if the bucket is unreachable.
//
// It was a flat 24h until 2026-09-23, when mops shipped a coverage jump（1,533 → 1,681 companies）
// and the reason for the shorter window became concrete: this file changes while the crawl is
// still being improved, and a stale FILENAME is a broken image rather than an old one. An hour
// bounds that; `staleMaxAge` keeps a day's worth as a cushion so an outage upstream costs nobody
// their logos. One 1.5MB fetch an hour is nothing.
//
// mops also caps the file's own HTTP caching at 300s（it was 3600, and they were themselves fooled
// by it — curl kept returning the previous manifest after an upload）. So the real lag is ours plus
// up to five minutes, not either alone.
const TTL_LOGO_MANIFEST = 60 * 60
const TTL_LOGO_STALE = 24 * 60 * 60

interface ManifestImage {
  name: string
  ext?: string
  bytes?: number
  width?: number | null
  height?: number | null
  // Mean Rec.709 luminance over pixels with alpha ≥ 128, 0–255. null when the format could not be
  // decoded — 29 files as of 2026-09-23, down from 206 once mops wrote its own ICO decoder.
  meanLuminance?: number | null
  // Share of pixels that are not transparent, 0–1.
  opaqueRatio?: number | null
  // Content hash — appended to the URL so a replaced file gets a new one. See getCompanyLogo.
  sha256?: string | null
}

interface ManifestEntry {
  name?: string
  sourceRule?: string
  hasViewBox?: boolean | null
  origin: ManifestImage | null
  webp: ManifestImage | null
  outcome?: string
  // Licence metadata, present on the entries mops did not take from the company's own site
  // （2026-09-24）. `nonFree: true` marks a fair-use file — 5 companies as of today（1216, 2002,
  // 2330, 5434, 5876）, all from zh.wikipedia. `attribution` is null on those; the rights holder
  // is the company itself and the file page carries the rationale.
  nonFree?: boolean
  license?: string | null
  attribution?: string | null
  licensePage?: string | null
}

interface LogoManifest {
  generatedAt: string
  basePath: string
  webpBasePath: string
  logos: Record<string, ManifestEntry>
}

export interface CompanyLogo {
  url: string
  // Intrinsic size, so the <img> can reserve exactly the right box and cause no layout shift.
  // null when mops could not measure it (28 files); the card then omits the attributes rather
  // than guessing a square.
  width: number | null
  height: number | null
  // True when the artwork is near-white on transparency — it would be invisible on this app's own
  // light card. Artwork drawn for a site's dark footer, in other words: 4585 達明, 1736 喬山 and
  // 4968 立積 all come back at luminance ≈ 255 with opaqueRatio ≈ 0.2–0.5.
  //
  // BOTH conditions matter, and both thresholds were set by LOOKING at the flagged files on a
  // white background beside a dark one, not by reading the numbers（2026-09-23）:
  //
  //   * the opacity condition: 211 companies are equally bright but nearly fully opaque — they
  //     carry their own light background and are correct as they are. Luminance alone flags all
  //     of them too.
  //   * the luminance cut is 240, not the 200 first written. At 200 a 12-file sample had FOUR
  //     false positives（1449 佳和 203, 6144 得利影 201, 8403 盛弘 207, 6861 睿生光電 229 — all
  //     plainly readable on white, and a dark chip behind them looks like a mistake）, while every
  //     file that genuinely vanished sat at 242 or above. Raising the cut removes all four and
  //     takes the flagged set from 108 companies to 69.
  //
  // One known miss at 240: 2524 京城（206）loses its wordmark on white but keeps its gold seal, so
  // it degrades to partly visible rather than blank. Two numbers cannot separate it from the false
  // positives above — 6144 at 201/0.44 and 8403 at 207/0.45 are nearly the same pair — and a
  // needless dark box on four companies is worse than a faint wordmark on one.
  needsDarkBackdrop: boolean
  // Set only when the file's licence obliges us to credit it — see attributionOf. null means the
  // card renders nothing extra, which is the case for a company's own site and for public domain.
  attribution: { license: string; licensePage: string } | null
}

const getLogoManifest = defineCachedFunction(
  async (): Promise<LogoManifest | null> => {
    try {
      return await $fetch<LogoManifest>(`${BUCKET}/manifest.json`, { timeout: 10_000, retry: 0 })
    } catch {
      // A logo is decoration; the page it decorates must not fail with it.
      return null
    }
  },
  { name: 'company-logo-manifest', getKey: () => 'all', maxAge: TTL_LOGO_MANIFEST, staleMaxAge: TTL_LOGO_STALE, swr: true }
)

// Below this, the artwork renders blurry in the card's own 40px-tall box. Expressed as the RENDERED
// pixel density rather than a raw dimension, because the raw one is the wrong axis: a 400×80
// wordmark has a longest edge of 400 and is still only ~2x once scaled to fit, while a 48×48 favicon
// passes any "longest edge" bar and is unreadable. Seen at real size before the number was picked
// (2026-09-23): the 155 files below 1.5x split cleanly — the ≤32px favicons are genuinely
// unusable, but 4542 科嶠 at 195×54 and 8042 金山電 at 120×58, both ~1.4x, look completely fine.
// So the cut is at 1.0, not the 1.5 first proposed from the numbers alone.
const MIN_RENDERED_DENSITY = 1.0
const BOX_HEIGHT = 40
const BOX_MAX_WIDTH = 160

// SQUARE ENOUGH, at most 5:4（2026-09-24,「未來只採用足夠方的圖做為Logo圖使用」）.
//
// The card was specified with a square logo from the start（the first version was a literal
// 32×32 box）and this file widened it to a 40×160 slot on 2026-09-23 without asking — a wordmark
// four times wider than it is tall is a different object in the layout, not a bigger logo. That
// was my call to make and it was not mine to make.
//
// 4:3, from the manifest's own distribution（1,801 measurable as of 2026-09-24）:
//
//   ≤ 1.0    917 (51%)    ≤ 4:3  1078 (60%)
//   ≤ 1.25  1054 (59%)    ≤ 1.5  1101 (61%)
//
// Half the market is already exactly square and the band just above it is favicons off by a few
// pixels（32×30 and the like）. Between 5:4 and 4:3 the data says nothing — 24 companies, one
// percentage point — so the tie goes to 4:3, the conventional ratio a box can be and still read as
// square. It also stops the gate turning on a rounding error: this was 1.25 for an hour, and when
// mops replaced 台積電's 500×126 wordmark with a 100×79 square version（1.266）the new file missed
// by six thousandths.
//
// The cost is real and stated rather than buried: coverage drops from ~1,834 to ~1,078. A company
// that loses its logo renders no logo at all — this card never substitutes an initial or a
// placeholder mark, which would assert we hold something we do not.
const MAX_ASPECT_RATIO = 4 / 3

function isSquareEnough(image: ManifestImage): boolean {
  // No dimensions means mops could not measure the file; the density gate already lets those
  // through, and guessing a shape would be worse than showing one slightly-off mark.
  if (!image.width || !image.height) return true
  return Math.max(image.width, image.height) / Math.min(image.width, image.height) <= MAX_ASPECT_RATIO
}

function isSharpEnough(image: ManifestImage): boolean {
  // Vector art is sharp at any size, and mops reports no dimensions for it.
  if (image.ext === 'svg') return true
  if (!image.width || !image.height) return true
  const scale = Math.min(BOX_HEIGHT / image.height, BOX_MAX_WIDTH / image.width)
  return 1 / scale >= MIN_RENDERED_DENSITY
}

// Credit is required for a fair-use file and for the CC-BY family; it is not for public domain,
// and not for a logo taken from the company's own site（which carries no licence fields at all）.
// Keyed off the licence string rather than `nonFree` alone so the one CC BY-SA entry in the
// manifest is covered too — mops's own note:「不要寫死假設全部都是 PD」.
function attributionOf(entry: ManifestEntry): { license: string; licensePage: string } | null {
  const license = entry.license
  const page = entry.licensePage
  if (!license || !page) return null
  if (/^public domain$/i.test(license.trim())) return null
  return { license, licensePage: page }
}

export const getCompanyLogo = defineCachedFunction(
  async (symbol: string): Promise<CompanyLogo | null> => {
    const manifest = await getLogoManifest()
    const entry = manifest?.logos?.[symbol]
    if (!manifest || !entry?.origin) return null

    // Prefer the WebP, except never over an SVG original — a raster copy of vector art is a
    // downgrade whatever its dimensions say. The `webp ?? origin` half is the fallback rule mops
    // asked for:「照 manifest 的 webp 是不是 null 決定要不要回退到 /logoOrigins/，不要自己拼檔名」.
    //
    // THE SVG CLAUSE CURRENTLY NEVER FIRES, and that is worth stating rather than leaving the next
    // reader to wonder. It was added 2026-09-23 against a real regression: 210 companies had an SVG
    // original, 208 of those had also been converted to WebP, so a blanket preference downgraded
    // vector art to a raster copy — and then measured that copy against a sharpness gate the vector
    // itself could never fail, dropping 17 companies on that basis alone（2332's SVG had become a
    // 32×32 WebP）. mops then removed the cause at the source the same day: SVG originals no longer
    // get a WebP at all（verified — 210 SVG entries, 0 with a `webp`）, so the general rule is
    // correct on its own now.
    //
    // Kept anyway, because it is not a workaround for that bug — it is a true statement about which
    // file is better, and it happens to cost one ternary. If the upstream pipeline ever produces
    // those copies again, nothing here changes.
    const image = entry.origin.ext === 'svg' ? entry.origin : (entry.webp ?? entry.origin)
    // Shape first: an SVG skips the sharpness gate by definition, but a vector wordmark is still
    // a wordmark — 2330's is 500×126.
    if (!isSquareEnough(image) || !isSharpEnough(image)) return null

    const base = image === entry.webp ? manifest.webpBasePath : manifest.basePath
    // Content-addressed cache buster（2026-09-24）. The bucket serves logo files with
    // `max-age=3600` and mops REUSES the filename when a company's mark changes — so when 台積電's
    // 500×126 wordmark was replaced by a 100×79 square one, Google's edge kept serving the old
    // bytes under the same URL for an hour. Proved it rather than guessing: the plain URL returned
    // `width="500"` while the same URL with a throwaway query returned `viewBox="0 0 100 78.737"`.
    // The consequence was not a stale picture but a broken LAYOUT — the card sizes its grid column
    // from the rendered image, so it reserved 159px for a mark that is 51px wide.
    // sha256 is what mops told us to key off（「以 manifest 的 contentHash / 各項 sha256 為準重抓」）,
    // and it makes the long cache safe rather than dangerous: same bytes, same URL, still cached.
    // The filename comes from the manifest, never assembled from the symbol: extensions vary, and
    // a guessed one is a broken image rather than a missing one.
    const measured = entry.origin
    return {
      url: `${BUCKET}/${base}${image.name}${image.sha256 ? `?v=${image.sha256.slice(0, 12)}` : ''}`,
      width: image.width ?? null,
      height: image.height ?? null,
      needsDarkBackdrop:
        measured.meanLuminance != null &&
        measured.opaqueRatio != null &&
        measured.meanLuminance > 240 &&
        measured.opaqueRatio < 0.9,
      attribution: attributionOf(entry)
    }
  },
  { name: 'company-logo', getKey: symbol => symbol, maxAge: TTL_LOGO_MANIFEST, staleMaxAge: TTL_LOGO_STALE, swr: true }
)
