import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth'
import { PlayerProfileProvider } from './hooks/usePlayerProfile'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <PlayerProfileProvider>
        <App />
      </PlayerProfileProvider>
    </AuthProvider>
  </React.StrictMode>,
)
