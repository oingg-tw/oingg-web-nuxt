// 新手專區的關係主題（2026-10-12，使用者：「把教學、說明與指標頁面分開」）。這三個主題不是型錄裡的單一指標，沒有
// /learn/{指標} 那一頁可以放，所以登記在這裡：/learn/[slug].vue 渲染完整版，個股頁（/stock/:code/dupont 等）只留 summary 一句、
// 頁尾連過來。三率三升是型錄裡的一支指標（threeMarginsRising），走指標模板，不在這裡。
// 文字原本寫在各個股頁上（2026-10-12 搬家前），`**粗體**` 由 StockMetricGuide 轉成 <strong>。

export interface LearnTopic {
  slug: string
  topic: string
  // 所屬的組（LEARN_GROUPS 的 slug）：麵包屑與側欄的目前位置
  group: string
  // 個股頁上留的一句
  summary: string
  definitionQuestion?: string
  definitionAnswer?: string
  definition: string[]
  limitations: string[]
}

export const LEARN_TOPICS: LearnTopic[] = [
  {
    slug: 'dupont',
    group: 'earnings',
    topic: '杜邦分析',
    summary: '把 ROE 拆成稅後淨利率 × 資產週轉率 × 權益乘數，看同樣的 ROE 從哪裡來。',
    definition: ['把 ROE 拆成稅後淨利率 × 資產週轉率 × 權益乘數，看同樣的 ROE 從哪裡來。名稱來自杜邦公司 1920 年代的管理方法。'],
    limitations: ['金融業不適用：資產是放款與保單，資產週轉率沒有意義。']
  },
  {
    slug: 'cash-cycle',
    group: 'cash-quality',
    topic: '現金轉換循環',
    summary: '公司從付錢進貨到把貨款收回來要幾天，扣掉供應商給的帳期，剩下的就是現金轉換循環。',
    definition: [
      '一門生意的錢是繞著跑的：拿錢去進貨、貨變成存貨、存貨賣出去變成應收帳款、應收帳款收回來又變成錢。繞完一圈要幾天，就是現金轉換循環在講的事。同樣賺一塊錢，繞得快的公司可以再拿去進下一批貨，繞得慢的就得自己準備更多錢墊著。',
      '這一圈分成兩段看。**營運週期**是「貨放多久 ＋ 錢等多久」，講的是這門生意本身的節奏。但公司進貨時通常不必馬上付錢，供應商給的帳期就是**應付帳款付現天數**——那幾天的資金是供應商墊的。營運週期扣掉那幾天，剩下的才是公司自己要掏錢出來的日子，這個數字叫**現金轉換循環**。',
      '所以它可以是**負的**。先收到客戶的錢、隔很久才付給供應商的生意（超商、部分航運）會出現負數，代表這門生意不但不需要自己墊錢，還能拿還沒付出去的貨款去做別的事。負數不是錯誤，是一種商業模式。',
      '三個子項可以互相驗算：存貨天數加收現天數等於營運週期，再減掉付現天數就是現金轉換循環。個股的現金循環頁會把每一期的算式寫出來；哪一期對不起來，那一列會標明是財報申報值。',
      '三個子項都用近四季的平均數計算。應付帳款只算欠一般供應商的部分，不含欠關係企業的，而且分母的營業成本裡還有人工與折舊，所以付現天數會比實際談定的帳期短一些。'
    ],
    limitations: [
      '**金融、保險、租賃業沒有這組數字。**它們的資產是放款與保單，不是進來再賣出去的貨，存貨與應收帳款在這個意義下不存在，所以這幾個天數算不出來也沒有意義——跟資產週轉率不適用於金融業是同一個原因。',
      '**剛上市不到一年的公司也還算不出來。**三個子項都用近四季的平均數，湊不滿四季就沒有值。'
    ]
  },
  {
    slug: 'dividend-fill',
    group: 'dividends',
    topic: '填息',
    summary: '除息當天，股價會扣掉當次配發的現金；股價回到除息前的水準，配到的現金才成為真正的報酬，這叫填息。',
    definitionQuestion: '為什麼填息重要？',
    definitionAnswer: '除息當天，股價會扣掉當次配發的現金——這是除權息參考價的算法，不是市場反應。',
    definition: [
      '配息本身不會讓持有人的資產變多：除息當天股價按配發金額調整，帳面上左手換右手。配到的現金要成為真正的報酬，必須靠股價回到除息前的水準，這件事就叫**填息**（配發股票股利時對應的是填權）。',
      '這也是「高殖利率不等於高報酬」的算術基礎：殖利率是配發金額除以股價，分母變小同樣會把這個比率推高，而一家股價已經下跌的公司，可能同時有很高的殖利率與很長的貼息期間。',
      '個股的填息頁記錄每一次配息之後，收盤價實際花了多少個交易日回到除息前一個交易日的價位。過去花了多久，不代表之後的配息會如何。'
    ],
    limitations: [
      '**同次配發股票股利**：除權參考價還要按配股比例調整股數，拿除息前的收盤價直接比對會算出一個持有人實際上沒有拿到的結果，所以這幾次標為不適用，而不是硬算一個數字。',
      '**年代較早的配息**：填息要逐日比對收盤價，太早的除息事件沒有逐日價格可比對。這幾列留空並標明原因，不做推估。',
      '天數一律以**交易日**計算，除息日當天為第 0 天。用日曆天會因為年節落點不同而代表不一樣的交易次數。'
    ]
  }
]

export function findLearnTopic(slug: string): LearnTopic | null {
  return LEARN_TOPICS.find(topic => topic.slug === slug) ?? null
}

export function learnTopicPath(slug: string): string {
  return `/learn/${slug}`
}

// 新手專區的六組（2026-10-12 重做，使用者：「learn 新手專區的設計簡直失敗透頂 毫無結構可言」；選了「依投資人的問題分 6 組」
// 「先看這幾個＋完整清單」「首頁是學習順序 1→6」）。結構照 conductor 知識庫的凹型導覽樹（07/導航樹扇出度與凹型層級拓撲）：
// 第一層 7 項（首頁＋六組）、中間層是組頁、末層是指標與主題頁，深度 4（首頁 › 新手專區 › 組 › 指標）。
// 指標歸哪一組照型錄的 category（營運效率併進「賺的是不是真錢」），主題自己指定 group。
// core 是編輯挑的「從這裡開始」，順序就是建議閱讀順序；一句話一律取定義的第一句，不寫評價（知識庫指標說明頁規則）。
export type LearnCoreItem = { metric: string } | { topic: string }

export interface LearnGroup {
  slug: string
  label: string
  question: string
  // 這一組在回答什麼（組頁的短答、首頁的一句話）
  answer: string
  categories: string[]
  core: LearnCoreItem[]
}

export const LEARN_GROUPS: LearnGroup[] = [
  {
    slug: 'earnings',
    label: '賺不賺錢',
    question: '賺不賺錢？',
    answer: '從損益表看公司每賣一塊錢留下多少、每股賺多少，以及股東投入的錢賺回多少。',
    categories: ['profitability'],
    core: [{ metric: 'eps' }, { metric: 'grossMargin' }, { metric: 'operatingMargin' }, { metric: 'netProfitMargin' }, { metric: 'roe' }, { topic: 'dupont' }]
  },
  {
    slug: 'cash-quality',
    label: '賺的是不是真錢',
    question: '賺的是不是真錢？',
    answer: '帳上的獲利有沒有真的收成現金，以及錢在存貨與應收帳款裡卡多久。',
    categories: ['quality', 'efficiency'],
    core: [{ metric: 'ocfToNetIncome' }, { metric: 'fcfPerShare' }, { metric: 'accrualsRatio' }, { metric: 'inventoryDays' }, { topic: 'cash-cycle' }]
  },
  {
    slug: 'safety',
    label: '會不會倒',
    question: '會不會倒？',
    answer: '負債有多重、短期內要付的錢付不付得出來、利息壓力有多大。',
    categories: ['resilience'],
    core: [{ metric: 'debtRatio' }, { metric: 'currentRatio' }, { metric: 'quickRatio' }, { metric: 'interestCoverage' }, { metric: 'altmanZScore' }]
  },
  {
    slug: 'dividends',
    label: '配給股東多少',
    question: '配給股東多少？',
    answer: '每年配多少、配的錢佔獲利多少、配得穩不穩，以及除息之後股價回不回得來。',
    categories: ['dividend'],
    core: [{ metric: 'cashDividendYield' }, { metric: 'dividendPayoutRatio' }, { metric: 'consecutiveDividendYears' }, { metric: 'dividendCoverageRatio' }, { topic: 'dividend-fill' }]
  },
  {
    slug: 'valuation',
    label: '現在貴不貴',
    question: '現在貴不貴？',
    answer: '用股價跟獲利、淨值、營收相比，看市場現在替這家公司付多少錢。',
    categories: ['valuation'],
    core: [{ metric: 'peRatio' }, { metric: 'pbRatio' }, { metric: 'psr' }, { metric: 'pegRatio' }]
  },
  {
    slug: 'growth',
    label: '還會不會成長',
    question: '還會不會成長？',
    answer: '營收、獲利與淨值跟去年比是變多還是變少，以及三種利潤率是不是一起往上。',
    categories: ['growth'],
    core: [{ metric: 'revenueGrowthRate' }, { metric: 'revenueYoy3m' }, { metric: 'epsGrowthRate' }, { metric: 'equityGrowthRate' }, { metric: 'threeMarginsRising' }]
  }
]

export function findLearnGroup(slug: string): LearnGroup | null {
  return LEARN_GROUPS.find(group => group.slug === slug) ?? null
}

export function learnGroupOfCategory(categoryKey: string): LearnGroup | null {
  return LEARN_GROUPS.find(group => group.categories.includes(categoryKey)) ?? null
}

// 側欄：從哪裡開始＋六組（第一層 7 項）
export const LEARN_NAV_ITEMS: { label: string; to: string }[] = [
  { label: '從哪裡開始', to: '/learn' },
  ...LEARN_GROUPS.map((group, index) => ({ label: `${index + 1} ${group.label}`, to: learnTopicPath(group.slug) }))
]
