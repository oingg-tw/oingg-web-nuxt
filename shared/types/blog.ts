// 部落格文章（2026-11-20 起在業務中台：管理站寫、業務中台存，網站經 /api/cached 讀 GET /blog-posts 與 /blog-posts/{slug}）。
// 欄名照詞彙表二之十一。只回已發布的文章；草稿、排程中、下架、不存在一律 404
export interface BlogPostSummary {
  slug: string
  title: string
  // financials／dividends／preferred_etf／retirement，已發布的一定有；中文名稱在 app/utils/blog-categories.ts
  category: string | null
  description: string | null
  // null 時用網站的署名
  authorName: string | null
  publishedAt: string
  updatedAt: string
}

export interface BlogPost extends BlogPostSummary {
  // 業務中台從 markdown 轉好、跳脫過的 HTML：只有 h2～h4、段落、清單、粗斜體、http(s) 與站內連結、引言、表格、程式碼、分隔線，可以直接 v-html
  bodyHtml: string
}
