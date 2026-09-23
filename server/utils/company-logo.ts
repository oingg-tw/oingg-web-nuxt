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

// 24h. The manifest is ~1.3MB and mops regenerates it a few times a day at most; `contentHash`
// exists for「did anything actually change」but is not useful here, since finding out costs the
// same fetch as just taking the new copy.
const TTL_LOGO_MANIFEST = 24 * 60 * 60

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
}

interface ManifestEntry {
  name?: string
  sourceRule?: string
  hasViewBox?: boolean | null
  origin: ManifestImage | null
  webp: ManifestImage | null
  outcome?: string
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
  { name: 'company-logo-manifest', getKey: () => 'all', maxAge: TTL_LOGO_MANIFEST, staleMaxAge: TTL_LOGO_MANIFEST, swr: true }
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

function isSharpEnough(image: ManifestImage): boolean {
  // Vector art is sharp at any size, and mops reports no dimensions for it.
  if (image.ext === 'svg') return true
  if (!image.width || !image.height) return true
  const scale = Math.min(BOX_HEIGHT / image.height, BOX_MAX_WIDTH / image.width)
  return 1 / scale >= MIN_RENDERED_DENSITY
}

export const getCompanyLogo = defineCachedFunction(
  async (symbol: string): Promise<CompanyLogo | null> => {
    const manifest = await getLogoManifest()
    const entry = manifest?.logos?.[symbol]
    if (!manifest || !entry?.origin) return null

    // WebP when it exists, the original otherwise — `webp` being null is the documented signal to
    // fall back, and mops asked for it explicitly:「照 manifest 的 webp 是不是 null 決定要不要回退
    // 到 /logoOrigins/，不要自己拼檔名」. 28 companies are in that state（a broken ICO directory,
    // or a server that answered an image request with an error page）.
    const image = entry.webp ?? entry.origin
    if (!isSharpEnough(image)) return null

    const base = entry.webp ? manifest.webpBasePath : manifest.basePath
    // The filename comes from the manifest, never assembled from the symbol: extensions vary, and
    // a guessed one is a broken image rather than a missing one.
    const measured = entry.origin
    return {
      url: `${BUCKET}/${base}${image.name}`,
      width: image.width ?? null,
      height: image.height ?? null,
      needsDarkBackdrop:
        measured.meanLuminance != null &&
        measured.opaqueRatio != null &&
        measured.meanLuminance > 240 &&
        measured.opaqueRatio < 0.9
    }
  },
  { name: 'company-logo', getKey: symbol => symbol, maxAge: TTL_LOGO_MANIFEST, staleMaxAge: TTL_LOGO_MANIFEST, swr: true }
)
