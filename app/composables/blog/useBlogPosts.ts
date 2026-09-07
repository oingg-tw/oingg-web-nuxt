// Hardcoded array, same pattern as index.vue's own FAQS/HIGHLIGHTS — no @nuxt/content module
// or other content pipeline added for this. A handful of static, hand-written articles doesn't
// need a markdown/CMS layer, and this keeps the blog on the exact same "plain TS data" model
// the rest of this page's content already uses.
//
// Most copy here is general financial-literacy explanation, not stock-specific commentary — no
// return figure is implied, no allocation percentage is prescribed. That's deliberate: this
// app's retirement-investor audience gets neutral, non-advisory content only (see the
// project's own core-audience principle), and a blog is exactly the kind of surface where it
// would be easy to drift into looking like investment advice without meaning to.
//
// 'mops-redemption-field-trap' (added 2026-09-07) is the one exception that names a specific
// security (中鋼特別股/2002A) — it's a data-verification case study, not a stock pick or
// return claim: the company name IS the substance being cited (a real, phone-verified MOPS
// data-quality anomaly), not praise or promotion of the security. Anonymizing it would gut the
// article's own credibility without actually reducing any advisory-tone risk.
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
  },
  {
    slug: 'mops-redemption-field-trap',
    title: 'MOPS買回欄位陷阱：中鋼特別股（2002A）教我的一堂資料查證課',
    description: '同一個「發行人買回」欄位，不同公司填寫時可能代表不同意思。從中鋼特別股（2002A）的實際案例，看懂查證特別股贖回權時該多做的一道查證步驟。',
    publishedAt: '2026-09-07',
    sections: [
      {
        heading: '「買回欄位」到底在講什麼？多數人以為的意思',
        paragraphs: [
          '你打開公開資訊觀測站，想確認手上這檔特別股會不會被公司提前贖回。畫面上「發行人買回」欄位清清楚楚寫著「否」。你鬆了一口氣，心想這下安心了——不會有贖回風險，可以放心長期領息。問題是，這個「否」不一定代表你以為的意思。',
          '在多數上市公司的特別股申報資料裡，「發行人買回」欄位一般被當成一句宣告：這檔特別股的合約條款，賦不賦予公司提前贖回的權利。填「是」，代表公司在章程或發行條件裡明訂了買回權；填「否」，直覺上就是「這張特別股沒有這項條款，公司不能主動收回」。多數散戶就是照這個邏輯讀欄位的，畢竟公開資訊觀測站是官方平台，欄位名稱看起來也直白。'
        ]
      },
      {
        heading: '中鋼特別股（2002A）的欄位寫「否」，但章程另有規定',
        paragraphs: [
          '在核對中鋼特別股（2002A）的條款時，發現一件不對勁的事：MOPS申報頁面上的「買回」欄位顯示「否」，但翻查該檔特別股的發行章程，裡面明明白白載有公司買回權的條款。欄位說「沒有」，章程卻說「有」——兩份同樣掛在官方系統底下的資料，講的是兩件事。',
          '這不是憑空猜測的落差。後來直接打電話向相關窗口查證，得到的答案確認了：中鋼這檔特別股是有買回權的，只是MOPS申報頁面上的「否」，指的並非「條款上沒有買回權」，而是某種其他語意——可能是「目前尚未行使贖回」或申報邏輯上的另一種認定方式，實際填寫依據與其他公司並不相同。'
        ]
      },
      {
        heading: '為什麼這個落差值得你在意',
        paragraphs: [
          '換一家公司再看一次同一個欄位，情況又不一樣：多數其他上市公司填寫「買回」欄位時，遵循的正是前面說的直覺邏輯——欄位內容忠實對應章程是否賦予買回權。這代表同一個欄位名稱、同一個系統介面，在不同公司手上，可能承載著不同的填寫規則。你若把從A公司學到的判讀方式，原封不動套用到中鋼身上，得出的結論會是錯的。',
          '想想一份公司章程要怎麼出現在公開資訊觀測站上：得橫跨法務、股務代理、財會等多個部門，手動登錄到不同的申報子系統，每個系統的格式、時限、介面都不一樣，過程高度仰賴人工轉檔與校對。同一份公司章程這個法律上唯一的文件，就這樣被拆成好幾份文字獨立的電子檔案，只要部門之間溝通有落差，資訊落差就有機會悄悄埋進公開揭露的那一端。',
          '而這種落差影響的不只是「知不知道」這種抽象層次的問題。特別股的贖回權，直接決定這張股票該用哪一套模型估價：有沒有贖回權，關係到你該用永續殖利率、還是要另外算一次「假設公司提前贖回」情境下的殖利率，兩者算出來的合理價位可能天差地遠。欄位讀錯，等於從一開始就用錯了估價的基本假設。'
        ]
      },
      {
        heading: '那要怎麼辦——多一道查證步驟',
        paragraphs: [
          '只看MOPS申報頁面上的單一欄位，不足以確認一檔特別股真正有沒有買回權。這不是說公開資訊觀測站不可信，而是它的申報作業本質上是由人工填寫、跨部門接力完成的，過程中每一個環節都可能出錯，而系統本身目前沒有自動比對章程原文與申報欄位是否一致的機制。比較保險的作法，是把MOPS申報頁面的欄位當成「起點」而不是「終點」。',
          '第一步：回頭查該公司的章程原文，特別股條款通常會單獨列一段講清楚有沒有買回權、買回年限與價格，這份文件的法律效力比申報摘要欄位更直接。',
          '第二步：章程與欄位對不上時，直接向公司股務或投資人關係窗口查證——這一步花不了太多時間，卻是唯一能徹底排除誤讀風險的方式。',
          '第三步：不要只信任單一資料來源，尤其是涉及會直接影響估價假設的關鍵條款（贖回權、累積或非累積、參與分配權），多一個來源交叉核對，永遠比省下這道手續划算。',
          '會不會被提前贖回，關係到你手上這張特別股接下來還能領幾年息、合約到期後拿到的又是多少錢——這種等級的問題，值得你多花那通電話的時間。本站的特別股專區會標示無法從單一欄位確認的贖回條款，提醒你自行查證，而不是逕自假設數值。'
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
