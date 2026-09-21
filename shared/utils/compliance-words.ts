// The compliance register this site writes in（2.4.3 ／ 刪形容詞測試）: numbers and statistical
// positions only, never an evaluative word about a stock. The scripts under scripts/ scan every
// server-rendered page for these; the page builders in app/utils/stock-*.ts keep their own copy
// constants clean by construction. Backend-owned strings (a screener template's name, a badge's
// detail text) can't be rewritten here — the scanner reports them as warnings under
// BACKEND_OWNED_PHRASES while the rename requests to bff-ts/analysis-ts are pending
// (2026-09-19: 「股利穩健」template name, 「股價偏低」in the 價值型 template description).

export const BANNED_WORDS = ['便宜', '合理', '昂貴', '偏低', '偏高', '穩健', '優於', '勝過', '領先', '贏過', '排名前段', '表現突出', '資料不足', '推薦買進', '目標價']

export const BANNED_WORDS_PATTERN = new RegExp(BANNED_WORDS.join('|'), 'g')

// Substrings that come verbatim from a backend field and are reported, not failed.
export const BACKEND_OWNED_PHRASES = ['股利穩健', '股價偏低']

export function findBannedWords(text: string): string[] {
  const found = new Set<string>()
  for (const match of text.matchAll(BANNED_WORDS_PATTERN)) found.add(match[0])
  return [...found]
}
