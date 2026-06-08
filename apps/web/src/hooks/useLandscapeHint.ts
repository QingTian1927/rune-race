import { useCallback, useEffect, useState } from 'react'
import {
  dismissLandscapeHintPermanent,
  landscapeHintMediaQueries,
  shouldOfferLandscapeHint,
} from '../lib/deviceOrientation'

export function useLandscapeHint() {
  const [visible, setVisible] = useState(false)

  const refresh = useCallback(() => {
    setVisible(shouldOfferLandscapeHint())
  }, [])

  useEffect(() => {
    refresh()

    const queries = landscapeHintMediaQueries()
    const onChange = () => refresh()
    queries.forEach((query) => query.addEventListener('change', onChange))
    window.addEventListener('resize', onChange)

    return () => {
      queries.forEach((query) => query.removeEventListener('change', onChange))
      window.removeEventListener('resize', onChange)
    }
  }, [refresh])

  const dismissForNow = useCallback(() => {
    setVisible(false)
  }, [])

  const dismissForever = useCallback(() => {
    dismissLandscapeHintPermanent()
    setVisible(false)
  }, [])

  return { visible, dismissForNow, dismissForever }
}
