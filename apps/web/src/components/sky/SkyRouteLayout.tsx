import { Outlet } from 'react-router-dom'
import { SkyBackground } from './SkyBackground'
import { useDayNightCycle } from './useDayNightCycle'

/**
 * Persists sky background + day/night cycle across sky-themed routes
 * so cloud animations do not restart on navigation.
 */
export function SkyRouteLayout() {
  useDayNightCycle(true)

  return (
    <>
      <SkyBackground />
      <Outlet />
    </>
  )
}
