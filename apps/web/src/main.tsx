import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth'
import { FeatureFlagsProvider } from './hooks/useFeatureFlags'
import { PlayerProfileProvider } from './hooks/usePlayerProfile'
import './index.css'
import './styles/rune-race-sky.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <FeatureFlagsProvider>
        <PlayerProfileProvider>
          <App />
        </PlayerProfileProvider>
      </FeatureFlagsProvider>
    </AuthProvider>
  </React.StrictMode>,
)
