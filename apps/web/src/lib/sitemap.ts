/** Marketing routes prerendered for SEO and included in sitemap.xml. */
export const PRERENDER_PATHS = [
  '/',
  '/about',
  '/guide',
  '/leaderboard',
  '/privacy',
  '/privacy/en',
  '/terms',
  '/terms/en',
] as const

type SitemapEntry = {
  path: (typeof PRERENDER_PATHS)[number]
  priority: string
  changefreq: 'weekly' | 'monthly'
}

const SITEMAP_META: Record<(typeof PRERENDER_PATHS)[number], Omit<SitemapEntry, 'path'>> = {
  '/': { priority: '1.0', changefreq: 'weekly' },
  '/guide': { priority: '0.9', changefreq: 'weekly' },
  '/leaderboard': { priority: '0.85', changefreq: 'weekly' },
  '/about': { priority: '0.7', changefreq: 'monthly' },
  '/privacy': { priority: '0.4', changefreq: 'monthly' },
  '/privacy/en': { priority: '0.4', changefreq: 'monthly' },
  '/terms': { priority: '0.4', changefreq: 'monthly' },
  '/terms/en': { priority: '0.4', changefreq: 'monthly' },
}

export const SITEMAP_ENTRIES: SitemapEntry[] = PRERENDER_PATHS.map((path) => ({
  path,
  ...SITEMAP_META[path],
}))

const HREFLANG_PAIRS = [
  { vi: '/privacy', en: '/privacy/en', xDefault: '/privacy' },
  { vi: '/terms', en: '/terms/en', xDefault: '/terms' },
] as const

type HreflangLink = { lang: string; href: string }

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getHreflangAlternates(path: string, siteUrl: string): HreflangLink[] | null {
  for (const pair of HREFLANG_PAIRS) {
    if (path === pair.vi || path === pair.en) {
      return [
        { lang: 'vi', href: `${siteUrl}${pair.vi}` },
        { lang: 'en', href: `${siteUrl}${pair.en}` },
        { lang: 'x-default', href: `${siteUrl}${pair.xDefault}` },
      ]
    }
  }
  return null
}

/** Build sitemap.xml body for public marketing routes. */
export function buildSitemapXml(siteUrl: string, lastmod: string): string {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, '')
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ]

  for (const entry of SITEMAP_ENTRIES) {
    const loc = `${normalizedSiteUrl}${entry.path}`
    lines.push('  <url>')
    lines.push(`    <loc>${escapeXml(loc)}</loc>`)
    lines.push(`    <lastmod>${lastmod}</lastmod>`)
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`)
    lines.push(`    <priority>${entry.priority}</priority>`)

    const alternates = getHreflangAlternates(entry.path, normalizedSiteUrl)
    if (alternates) {
      for (const alt of alternates) {
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${escapeXml(alt.href)}" />`,
        )
      }
    }

    lines.push('  </url>')
  }

  lines.push('</urlset>', '')
  return lines.join('\n')
}

/** Build robots.txt with sitemap URL derived from the public site origin. */
export function buildRobotsTxt(siteUrl: string): string {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, '')
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${normalizedSiteUrl}/sitemap.xml`, ''].join('\n')
}
