import { renderToString } from 'react-dom/server'
import { HelmetProvider } from 'react-helmet-async'
import { StaticRouter } from 'react-router-dom/server'
import { AppProviders, AppRoutes } from './App'
import { buildOgHeadElements, formatDocumentTitle, PRERENDER_PATHS, resolvePageSeo } from './lib/pageSeo'

const PRERENDER_SET = new Set<string>(PRERENDER_PATHS)

export async function prerender(data: { url: string }) {
  const path = data.url.split('?')[0] || '/'

  const html = renderToString(
    <HelmetProvider>
      <AppProviders>
        <StaticRouter location={path}>
          <AppRoutes />
        </StaticRouter>
      </AppProviders>
    </HelmetProvider>,
  )

  const seo = resolvePageSeo(path)
  const lang = path.endsWith('/en') ? 'en' : 'vi'
  const { parseLinks } = await import('vite-prerender-plugin/parse')
  const discovered = parseLinks(html).filter((link) => PRERENDER_SET.has(link))

  return {
    html,
    links: new Set(discovered.length > 0 ? discovered : [path]),
    head: {
      lang,
      title: formatDocumentTitle(seo),
      elements: buildOgHeadElements(seo, lang),
    },
  }
}
