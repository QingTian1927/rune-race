import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { SiteHead } from './components/SiteHead'
import { useUiSoundEffects } from './hooks/useUiSoundEffects'
import { MarketingLayout } from './components/marketing/MarketingLayout'
import { SkyRouteLayout } from './components/sky/SkyRouteLayout'
import LandingPage from './pages/marketing/LandingPage'
import AboutPage from './pages/marketing/AboutPage'
import GuidePage from './pages/marketing/GuidePage'
import LegalPage from './pages/marketing/LegalPage'
import PlayPage from './pages/PlayPage'
import LobbyPage from './pages/LobbyPage'
import OnlineGamePage from './pages/OnlineGamePage'
import AuthLoginPage from './pages/AuthLogin'
import AuthSignupPage from './pages/AuthSignup'
import ProfileViewPage from './pages/ProfileView'
import ProfileEditPage from './pages/ProfileEdit'
import ShopPage from './pages/ShopPage'
import { AuthProvider } from './hooks/useAuth'
import { FeatureFlagsProvider } from './hooks/useFeatureFlags'
import { PlayerProfileProvider } from './hooks/usePlayerProfile'

function ClientUiEffects() {
  useUiSoundEffects()
  return null
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FeatureFlagsProvider>
        <PlayerProfileProvider>{children}</PlayerProfileProvider>
      </FeatureFlagsProvider>
    </AuthProvider>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" lang="vi" />} />
        <Route path="/privacy/en" element={<LegalPage kind="privacy" lang="en" />} />
        <Route path="/terms" element={<LegalPage kind="terms" lang="vi" />} />
        <Route path="/terms/en" element={<LegalPage kind="terms" lang="en" />} />
      </Route>
      <Route element={<SkyRouteLayout />}>
        <Route path="/play" element={<PlayPage />} />
        <Route path="/auth/login" element={<AuthLoginPage />} />
        <Route path="/auth/signup" element={<AuthSignupPage />} />
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/profile/:profileId" element={<ProfileViewPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
      </Route>
      <Route path="/game/:gameId" element={<OnlineGamePage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <SiteHead />
      <AppProviders>
        <ClientUiEffects />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppRoutes />
        </BrowserRouter>
      </AppProviders>
    </HelmetProvider>
  )
}
