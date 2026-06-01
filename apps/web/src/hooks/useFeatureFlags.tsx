import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchFeatureFlags } from '../lib/api'

type FeatureFlagsContextValue = {
  accountNudgeEnabled: boolean
  loading: boolean
  refresh: () => Promise<void>
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null)

const envForceOff = import.meta.env.VITE_ACCOUNT_NUDGE_ENABLED === 'false'

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [accountNudgeEnabled, setAccountNudgeEnabled] = useState(!envForceOff)
  const [loading, setLoading] = useState(!envForceOff)

  const refresh = useCallback(async () => {
    if (envForceOff) {
      setAccountNudgeEnabled(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const flags = await fetchFeatureFlags()
      setAccountNudgeEnabled(flags.accountNudgeEnabled)
    } catch {
      setAccountNudgeEnabled(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      accountNudgeEnabled: envForceOff ? false : accountNudgeEnabled,
      loading: envForceOff ? false : loading,
      refresh,
    }),
    [accountNudgeEnabled, loading, refresh],
  )

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider')
  return ctx
}
