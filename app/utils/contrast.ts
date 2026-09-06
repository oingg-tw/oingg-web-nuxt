// WCAG 2.x relative-luminance contrast — the exact formula this app has been manually
// re-implementing in throwaway Playwright scripts all session to verify every color change
// (theme accents, button/radio-button text-on-primary fixes, light-mode background retunes,
// etc.). Formalized here so app/pages/design.vue can compute it live in the browser against
// real rendered elements instead of a one-off script that gets deleted after each check.
function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (c: number) => {
    const normalized = c / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

// Accepts whatever getComputedStyle(...).color/backgroundColor actually returns — always a
// resolved rgb()/rgba() string in every browser, regardless of how the color was declared
// (color-mix(), var(), a plain hex) — never a raw CSS custom-property string. That's why this
// only ever reads FROM rendered DOM elements, not raw --el-* custom-property values directly:
// a var() reference or color-mix() expression read as a string can't be parsed as a color.
function parseRgb(value: string): [number, number, number] {
  const match = value.match(/\d+(\.\d+)?/g)
  if (!match || match.length < 3) return [0, 0, 0]
  return [Number(match[0]), Number(match[1]), Number(match[2])]
}

export function contrastRatio(foreground: string, background: string): number {
  const [fr, fg, fb] = parseRgb(foreground)
  const [br, bg, bb] = parseRgb(background)
  const l1 = relativeLuminance(fr, fg, fb)
  const l2 = relativeLuminance(br, bg, bb)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export interface WcagVerdict {
  ratio: number
  aaNormal: boolean // >= 4.5:1
  aaLarge: boolean // >= 3:1 (also the UI-component-level floor)
  aaa: boolean // >= 7:1
}

export function evaluateContrast(foreground: string, background: string): WcagVerdict {
  const ratio = contrastRatio(foreground, background)
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaa: ratio >= 7
  }
}
