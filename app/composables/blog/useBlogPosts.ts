// Hardcoded array, same pattern as index.vue's own FAQS/HIGHLIGHTS — no @nuxt/content module
// or other content pipeline added for this. A handful of static, hand-written articles doesn't
// need a markdown/CMS layer, and this keeps the blog on the exact same "plain TS data" model
// the rest of this page's content already uses.
//
// All copy here is general financial-literacy explanation, not stock-specific commentary — no
// stock is named, no return figure is implied, no allocation percentage is prescribed. That's
// deliberate: this app's retirement-investor audience gets neutral, non-advisory content only
// (see the project's own core-audience principle), and a blog is exactly the kind of surface
// where it would be easy to drift into looking like investment advice without meaning to.
export interface BlogPostSection {
  heading: string
  paragraphs: string[]
}

export interface BlogPost {
  slug: string
  title: string
  description: string
  publishedAt: string
  sections: BlogPostSection[]
}

// Exported (not module-private) so nuxt.config.ts's sitemap.urls() can import the plain data
// directly — that runs in a Node/Nitro build-time context, not a Vue component context, so it
// needs the raw array rather than going through the useBlogPosts() composable (which wraps it
// in computed(), unnecessary overhead/risk outside an actual reactivity scope for a one-off
// build-time read).
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'dividend-yield-explained',
    title: '股息殖利率是什麼？高殖利率一定比較好嗎？',
    description: '股息殖利率的計算方式、常見的「高股息陷阱」，以及為什麼殖利率不該是唯一的選股依據。',
    publishedAt: '2026-08-20',
    sections: [
      {
        heading: '股息殖利率怎麼算？',
        paragraphs: [
          '股息殖利率＝每股現金股利 ÷ 股價 × 100%。舉例來說，如果一家公司股價 50 元，過去一年配發 2.5 元現金股利，殖利率就是 5%。',
          '要注意的是，這個數字用的是「過去」發放的股利，並不保證公司未來會維持相同的配息水準——公司每年配多少股利，是董事會依照當年度的獲利與現金狀況決定的，不是一個承諾。'
        ]
      },
      {
        heading: '為什麼殖利率變高，不一定是好事？',
        paragraphs: [
          '殖利率是「股利 ÷ 股價」，所以有兩種情況會讓殖利率上升：公司股利調高，或者股價下跌。前者通常是好消息，後者則可能反映市場對公司前景的疑慮。',
          '這就是常說的「高股息陷阱」：一家公司股價因為基本面惡化而重挫，帳面殖利率反而因此被墊高，看起來很誘人，但隔年股利可能就跟著大幅縮水，甚至不再配息。'
        ]
      },
      {
        heading: '除了殖利率，還可以看什麼？',
        paragraphs: [
          '殖利率只反映「配了多少」，沒有反映「配得健不健康」。同時檢視公司的獲利穩定度、現金流狀況與配息的歷史紀錄，會比單看一年的殖利率數字更完整。',
          '本站的篩選工具可以同時設定多項財報指標的條件，而不是只依賴單一數字排序，出發點也是這裡——避免只看殖利率就下判斷。'
        ]
      }
    ]
  },
  {
    slug: 'what-is-roe',
    title: 'ROE 是什麼？存股族為什麼要看這個指標？',
    description: '股東權益報酬率（ROE）的定義、計算方式，以及它跟公司經營效率的關係。',
    publishedAt: '2026-08-27',
    sections: [
      {
        heading: 'ROE 的定義',
        paragraphs: [
          'ROE（Return on Equity，股東權益報酬率）＝稅後淨利 ÷ 股東權益 × 100%，衡量的是公司用股東投入的每一塊錢資本，賺回了多少獲利。',
          '同樣是賺 10 億元，一家用 50 億股東權益賺到的公司，ROE 是 20%；另一家用 200 億股東權益才賺到的公司，ROE 只有 5%——前者用資本的效率明顯比較高。'
        ]
      },
      {
        heading: 'ROE 高就等於好公司嗎？',
        paragraphs: [
          '不一定。ROE 也可能因為公司大量舉債、股東權益基期較低而被墊高，這種情況下財務槓桿風險也會比較高。單看一年的 ROE 容易被特殊狀況影響。',
          '比較穩健的做法，是觀察公司近幾年 ROE 的趨勢是否穩定、是否伴隨著合理的負債水準，而不是只看單一年度的高低。'
        ]
      }
    ]
  },
  {
    slug: 'retirement-diversification-basics',
    title: '退休族群的資產配置基本概念：為什麼不該把雞蛋放在同一個籃子',
    description: '分散投資的基本邏輯，以及為什麼集中持有單一個股或單一產業對退休資金來說風險較高。',
    publishedAt: '2026-09-03',
    sections: [
      {
        heading: '集中持股的風險在哪裡？',
        paragraphs: [
          '如果退休資金高度集中在少數幾檔個股或單一產業，一旦該公司或該產業遇到系統性的逆風（例如景氣循環、法規變化、技術替代），資產價值可能同時大幅波動，而退休族群通常沒有太多時間等待資產回補。',
          '分散到不同產業、不同類型的資產，可以降低單一事件對整體資產造成的衝擊——這是分散投資最基本的邏輯，而不是要保證分散後就一定能提高報酬。'
        ]
      },
      {
        heading: '分散不代表隨便買很多檔',
        paragraphs: [
          '單純持有很多檔個股，如果它們高度集中在同一個產業或連動性很高，實際上分散效果有限。真正的分散，考慮的是產業、公司規模、營運模式等面向是否有差異。',
          '本站沒有提供資產配置比例的具體建議——每個人的財務狀況、風險承受度與退休時程都不同，這類決策建議與專業的財務規劃顧問討論，本站的篩選與比較工具，目的是協助你更有系統地檢視個股本身的財務體質。'
        ]
      }
    ]
  }
]

export function useBlogPosts() {
  const posts = computed(() =>
    [...BLOG_POSTS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  )

  function getPostBySlug(slug: string) {
    return BLOG_POSTS.find(post => post.slug === slug)
  }

  return { posts, getPostBySlug }
}
