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
    slug: 'what-is-preferred-stock',
    title: '特別股是什麼？股票與債券之間的第三種資產，以及它不告訴你的風險',
    description: '特別股常被稱為「類定存股票」，股息穩定、價格波動小。本文說明五大契約條款與 YTW 最差殖利率的定價邏輯，以及 2020 年市場壓力測試下顯露出的風險邊界。',
    publishedAt: '2026-09-06',
    sections: [
      {
        heading: '特別股是介於股票和債券之間的混合商品',
        paragraphs: [
          '常聽到「甲特股」「乙特股」這類特別股，殖利率通常落在 4% 上下，價格波動又比普通股小，看起來像是為退休族量身打造的商品。但特別股到底是什麼？它跟平常買的普通股，差別在哪裡？',
          '特別股的英文是 Preferred Stock，中文有時也叫優先股。名字裡有個「股」字，法律形式上確實是股票，但它的行為模式更接近債券：發行公司會約定一個固定的股息率，每年照發，價格也不太會像普通股一樣大起大落。',
          '財務學上把這種東西叫「夾層資本」，意思是它卡在債務和股權之間。公司如果倒閉清算，特別股股東的求償順位排在銀行貸款、公司債之後，但排在普通股股東之前。這個「夾在中間」的位置，決定了它平常表現得像債券，但骨子裡終究是一種股票。'
        ]
      },
      {
        heading: '買特別股之前，你至少要看懂五件事',
        paragraphs: [
          '特別股不是一個統一規格的商品，每一檔的契約條款都不一樣。看到殖利率就下單，等於沒看合約就簽字。以下五個條款，是判斷一檔特別股體質的基本功課。',
          '股息會不會補發：特別股分成「累積型」和「非累積型」。累積型的意思是，公司如果某年獲利不好、暫停配息，欠你的股息會累積起來，等公司恢復獲利、要發普通股股利之前，得先把欠的特別股股息全部補上。非累積型就沒有這個保障，當年沒發就是沒發，未來也不會補。',
          '能不能分到額外的獲利：大部分特別股是「非參與型」，意思是只能領到約定的固定股息，公司當年賺再多，超額的獲利也不會分給你，全部留給普通股股東。少數「完全參與型」特別股在領完固定股息後，還能按比例參與超額分配，但這種設計在台股很少見。',
          '清算的時候排第幾順位：這叫清算優先權，決定公司倒閉時誰先拿錢。特別股通常排在債券之後、普通股之前，但也有些條款會約定「優先倍數」，也就是清算時能拿回超過一倍本金的保障，這點在買進前值得確認清楚。',
          '公司什麼時候可以強制買回你的股票：這叫發行人贖回權，是特別股最容易被忽略的一條。台股金控特別股通常約定發行滿 5 到 7 年後，公司有權按票面價（常見是每股 50 或 60 元）強制買回。如果當初用高於票面價的價格買進，一旦被贖回，等於直接吃下價差損失。這個現象叫「負凸性」，市場利率下跌照理說該讓債券型資產漲價，但特別股的漲幅會被這個強制買回價卡死，享受不到降息帶來的資本利得。',
          '能不能要求公司買回：這叫投資人賣回權，跟贖回權是相反的方向——如果持有人有權要求公司按約定價格買回股票，代表多了一層保障。但台股金控特別股大多沒有賦予投資人這項權利，會計上也因此比較容易被歸類為股東權益，而不是負債。'
        ]
      },
      {
        heading: 'YTW：判斷特別股划不划算的核心指標',
        paragraphs: [
          '如果只看殖利率，很容易被誤導。假設一檔特別股票面股息率是 4.1%，但現在市價已經漲到高於發行人贖回價，一旦公司真的行使贖回權，實際報酬會被大幅壓縮。',
          '固定收益的世界裡，比較嚴謹的做法是算「最差殖利率」（Yield to Worst，簡稱 YTW）：同時計算「持有到期」和「被提前贖回」兩種情境下的年化報酬，取比較低的那一個當作保守估計。這個數字比單純的票面殖利率更誠實，因為它已經把「公司可能強制買回」這個風險算進去了。'
        ]
      },
      {
        heading: '2020 年疫情股災，戳破了「特別股永遠抗跌」的迷思',
        paragraphs: [
          '特別股常被包裝成「類定存」的穩健資產，但這個印象在 2020 年新冠疫情期間，遇到了一次嚴格的壓力測試。',
          '美國市場的特別股 ETF，在 2020 年 2 月到 3 月那波全球股災中，最大跌幅一度逼近 32%，跟美股大盤的相關係數，從平常的 0.45 一口氣衝到 0.96，等於在那段期間，特別股跟普通股幾乎是同步暴跌，完全沒有發揮防禦效果。',
          '同一段時間，台灣掛牌的金融特別股卻表現得相當平穩，跌幅大多控制在 5% 以內，幾週內就收復失地。',
          '差別在哪裡？學術文獻歸納出兩個關鍵原因。第一，投資人結構不同：台股金融特別股的主要買盤是本國壽險公司、退休基金這類長期機構，抱著領股息的心態長期持有，很少在市場恐慌時追殺出場；美國特別股市場則由被動指數基金和對沖基金主導，這些機構受到嚴格的風險控管規則約束，市場一恐慌就會被迫集體停損拋售。第二，台股金控特別股多半約定固定發行價（如每股 60 元），一旦市價跌到接近這個價位，隱含殖利率就會變得很有吸引力，立刻吸引資金進場承接，形成一條天然的價格防線。',
          '這個對照告訴我們一件事：特別股的穩定表現，不是這個商品本身天生的性質，而是特定市場結構下才會出現的結果。遇到系統性的流動性危機時，這層防禦力有可能整個失效。'
        ]
      },
      {
        heading: '給存股族的實用結論',
        paragraphs: [
          '特別股確實是一個值得認識的固定收益工具，殖利率、股息穩定度都優於銀行定存，也比普通股波動小。但幾件事值得記在心裡。',
          '它不是無風險資產：平常的市場修正它確實抗跌，但遇到全球性的系統風暴，它的表現可能跟股票沒兩樣。',
          '殖利率不是唯一該看的數字：發行人的贖回權、股息累積性、清算順位，每一項都可能實質影響最終報酬，光比殖利率高低是不夠的。',
          '它適合放進中期資產配置，而不是取代救命現金：特別股比較適合扮演退休資產配置裡「中期收益」的角色，而不是應該完全信賴、不能有任何波動的救急資金。',
          '本站的特別股專區會把每一檔特別股的契約條款、殖利率與贖回相關資訊整理列出，讓你在看到殖利率數字之前，先看懂條款本身在說什麼。'
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
