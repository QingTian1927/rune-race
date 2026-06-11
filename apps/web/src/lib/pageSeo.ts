import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_TYPE,
  DEFAULT_OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_URL,
} from './siteConfig'

export type PageSeo = {
  title: string
  description: string
  path: string
}

export const PAGE_SEO: Record<string, PageSeo> = {
  '/': {
    path: '/',
    title: 'Rune Race | Cá ngựa online · chơi ẩn danh',
    description:
      'Rune Race là game Cá ngựa online có Rune, marker bí mật và cơ chế giả danh. Vào phòng nhanh, chơi cùng bạn bè ngay trên trình duyệt.',
  },
  '/about': {
    path: '/about',
    title: 'Về chúng tôi',
    description:
      'Tìm hiểu mục tiêu, đội ngũ phát triển và những supporter đã đóng góp phản hồi cho Rune Race.',
  },
  '/guide': {
    path: '/guide',
    title: 'Hướng dẫn chơi',
    description:
      'Hướng dẫn chơi Rune Race: mục tiêu, lượt chơi, Rune, marker bí mật, giả danh, cơ chế thưởng trung thực và luật chi tiết.',
  },
}

export function resolvePageSeo(path: string): PageSeo {
  return PAGE_SEO[path] ?? PAGE_SEO['/']!
}

export function formatDocumentTitle(seo: PageSeo): string {
  return seo.path === '/' ? seo.title : `${seo.title} | ${SITE_NAME}`
}

type HeadElement = {
  type: string
  props: Record<string, string | undefined>
}

export function buildOgHeadElements(seo: PageSeo): Set<HeadElement> {
  const canonical = `${SITE_URL}${seo.path}`
  const fullTitle = formatDocumentTitle(seo)

  return new Set([
    { type: 'meta', props: { name: 'description', content: seo.description } },
    { type: 'link', props: { rel: 'canonical', href: canonical } },
    { type: 'meta', props: { property: 'og:site_name', content: SITE_NAME } },
    { type: 'meta', props: { property: 'og:locale', content: 'vi_VN' } },
    { type: 'meta', props: { property: 'og:type', content: 'website' } },
    { type: 'meta', props: { property: 'og:title', content: fullTitle } },
    { type: 'meta', props: { property: 'og:description', content: seo.description } },
    { type: 'meta', props: { property: 'og:url', content: canonical } },
    { type: 'meta', props: { property: 'og:image', content: DEFAULT_OG_IMAGE } },
    { type: 'meta', props: { property: 'og:image:secure_url', content: DEFAULT_OG_IMAGE } },
    { type: 'meta', props: { property: 'og:image:type', content: DEFAULT_OG_IMAGE_TYPE } },
    { type: 'meta', props: { property: 'og:image:width', content: String(DEFAULT_OG_IMAGE_WIDTH) } },
    { type: 'meta', props: { property: 'og:image:height', content: String(DEFAULT_OG_IMAGE_HEIGHT) } },
    {
      type: 'meta',
      props: { property: 'og:image:alt', content: `${SITE_NAME} — Cá ngựa online có Rune` },
    },
    { type: 'meta', props: { name: 'twitter:card', content: 'summary_large_image' } },
    { type: 'meta', props: { name: 'twitter:title', content: fullTitle } },
    { type: 'meta', props: { name: 'twitter:description', content: seo.description } },
    { type: 'meta', props: { name: 'twitter:image', content: DEFAULT_OG_IMAGE } },
  ])
}

/** Marketing routes included in static prerender for SEO / Open Graph. */
export const PRERENDER_PATHS = ['/', '/about', '/guide'] as const
