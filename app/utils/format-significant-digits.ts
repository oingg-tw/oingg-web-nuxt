// Extracted from StockGuruBadgeCategoryCard.vue 2026-09-11 once OrganismResultTable.vue's
// screener 市值 column needed the exact same "large statement figure blowing out a small
// chip/cell" formatting — a single shared util instead of two independent copies of the same
// recursive 億/兆 abbreviation logic. Nuxt auto-imports this from app/utils/, so call sites never
// need an explicit import line.

// Groups only the integer part with thousand separators, leaving any decimal digits untouched —
// same reasoning as OrganismResultTable.vue's own addThousandSeparators: round-tripping through
// Number.toLocaleString would silently trim a meaningful trailing zero. Used here so the final,
// non-abbreviated numeric leaf (the part left after every 億/兆 division has already happened)
// also reads with separators when it's still ≥1,000 on its own (e.g. "4,695億" not "4695億").
function groupThousands(raw: string): string {
  const negative = raw.startsWith('-')
  const unsigned = negative ? raw.slice(1) : raw
  const [integerPart, decimalPart] = unsigned.split('.')
  const grouped = integerPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (negative ? '-' : '') + grouped + (decimalPart !== undefined ? `.${decimalPart}` : '')
}

// Real bug fixed 2026-09-10 (reported live: "淨流動資產價值 數字要format不讓他跑版") — badges that
// go through formatRawValue used to interpolate the API's raw floating-point value with zero
// formatting (`${value}`), so a value like 64.19384729103647 rendered in full and blew out the
// chip's layout. 3 significant figures per direct request (toPrecision, not toFixed — significant
// figures, not decimal places, so a three-digit whole number like Graham Number's 693.89 → "694"
// stays 3 digits instead of gaining two more after a decimal point).
//
// Second real bug caught live while verifying the first fix: NCAV is a total balance-sheet figure
// (流動資產－總負債), not a per-share one — a large-cap stock's own value came back as
// 1660000000000 (NT$1.66 trillion). toPrecision(3) alone is technically still "3 significant
// figures" on a number like that (the trailing zeros are just place value, not extra precision),
// but the round-tripped Number().toString() output is still a 13-digit string that blows out the
// exact same chip layout the first fix was meant to protect. Abbreviates with 億/兆 (the units
// Taiwanese financial reporting actually uses for numbers this size, not a frontend invention)
// once the magnitude crosses those thresholds — the recursive call re-applies the same
// significant-figure rounding to the now-scaled-down number (e.g. 1.66) rather than trying to
// divide an already-rounded integer and hope the result is still clean.
export function formatSignificantDigits(value: number, digits: number): string {
  const rounded = Number(value.toPrecision(digits))
  const magnitude = Math.abs(rounded)
  if (magnitude >= 1e12) return `${formatSignificantDigits(rounded / 1e12, digits)}兆`
  if (magnitude >= 1e8) return `${formatSignificantDigits(rounded / 1e8, digits)}億`
  return groupThousands(rounded.toString())
}
