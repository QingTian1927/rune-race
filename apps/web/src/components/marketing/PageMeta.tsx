import { Helmet } from 'react-helmet-async'
import { formatDocumentTitle, resolvePageSeo } from '../../lib/pageSeo'
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_TYPE,
  DEFAULT_OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_URL,
} from '../../lib/siteConfig'

type PageMetaProps = {
  path: string
}

export function PageMeta({ path }: PageMetaProps) {
  // Marketing SEO head tags are injected during static prerender (see prerender.tsx).
  if (typeof window === 'undefined') {
    return null
  }

  const seo = resolvePageSeo(path)
  const fullTitle = formatDocumentTitle(seo)
  const canonical = `${SITE_URL}${seo.path}`

  return (
    <Helmet>
      <html lang="vi" />
      <title>{fullTitle}</title>
      <meta name="description" content={seo.description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="vi_VN" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={DEFAULT_OG_IMAGE} />
      <meta property="og:image:secure_url" content={DEFAULT_OG_IMAGE} />
      <meta property="og:image:type" content={DEFAULT_OG_IMAGE_TYPE} />
      <meta property="og:image:width" content={String(DEFAULT_OG_IMAGE_WIDTH)} />
      <meta property="og:image:height" content={String(DEFAULT_OG_IMAGE_HEIGHT)} />
      <meta property="og:image:alt" content={`${SITE_NAME} — Cá ngựa online có Rune`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
    </Helmet>
  )
}
