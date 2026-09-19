import type { MaybeRefOrGetter } from 'vue'
import type { StockBreadcrumbItem } from '~/composables/stock/useStockPageSeo'

// <head> for the hub pages（/stock, /industry/…, /rank/…, /screener/{slug}, /metrics/…）—
// 2026-09-19, the SEO build. The generalised twin of useStockPageSeo: title/description/og/
// twitter, a self canonical WITHOUT the query string（view state never becomes a separate URL）,
// optional `noindex, follow`, and a BreadcrumbList built from the same array the visible
// StockBreadcrumb renders, so the trail search engines are told about is the one people see.
//
// Titles are written per page in the「[核心關鍵字]+[核心利益]」form（the brand suffix comes from
// app.vue's global titleTemplate）and kept ≤ 32 CJK-equivalent characters; descriptions aim for
// 60–80 with the page's own numbers first — scripts/check-hub-pages.mjs measures both.
export interface HubPageSeoOptions {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  // The canonical path（no query）.
  path: MaybeRefOrGetter<string>
  breadcrumbs: MaybeRefOrGetter<StockBreadcrumbItem[]>
  noindex?: MaybeRefOrGetter<boolean>
}

export function useHubPageSeo(options: HubPageSeoOptions) {
  const origin = useRequestURL().origin
  const title = computed(() => toValue(options.title))
  const description = computed(() => toValue(options.description))
  const pageUrl = computed(() => `${origin}${toValue(options.path)}`)
  const breadcrumbs = computed(() => toValue(options.breadcrumbs))
  const robots = computed<string | undefined>(() => (toValue(options.noindex) ? 'noindex, follow' : undefined))

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogType: 'website',
    ogUrl: pageUrl,
    ogSiteName: '安盈選股',
    ogLocale: 'zh_TW',
    twitterCard: 'summary',
    robots
  })

  useHead({
    link: [{ rel: 'canonical', href: pageUrl }],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: computed(() =>
          JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbs.value.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.label,
              item: `${origin}${item.to}`
            }))
          })
        )
      }
    ]
  })

  return { title, description, breadcrumbs }
}
