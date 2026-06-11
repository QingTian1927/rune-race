import { Outlet } from 'react-router-dom'
import '../../styles/marketing-site.css'
import { MarketingFooter } from './MarketingFooter'
import { MarketingHeader } from './MarketingHeader'
import { MarketingScenery } from './MarketingScenery'

export function MarketingLayout() {
  return (
    <div className="marketing-site">
      <MarketingScenery />
      <MarketingHeader />
      <Outlet />
      <MarketingFooter />
    </div>
  )
}
