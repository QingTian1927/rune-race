import { Helmet } from 'react-helmet-async'
import { SITE_FAVICON } from '../lib/siteConfig'

/** Global document head tags shared by marketing and play routes. */
export function SiteHead() {
  return (
    <Helmet>
      <link rel="icon" type="image/svg+xml" href={SITE_FAVICON} />
      <link rel="shortcut icon" type="image/svg+xml" href={SITE_FAVICON} />
      <link rel="apple-touch-icon" href={SITE_FAVICON} />
    </Helmet>
  )
}
