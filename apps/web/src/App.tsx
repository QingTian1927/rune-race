import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LobbyPage from './pages/LobbyPage'
import LocalGamePage from './pages/LocalGamePage'
import OnlineGamePage from './pages/OnlineGamePage'
import AuthLoginPage from './pages/AuthLogin'
import AuthSignupPage from './pages/AuthSignup'
import ProfileViewPage from './pages/ProfileView'
import ProfileEditPage from './pages/ProfileEdit'

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/login" element={<AuthLoginPage />} />
        <Route path="/auth/signup" element={<AuthSignupPage />} />
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/profile/:profileId" element={<ProfileViewPage />} />
        <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
        <Route path="/game/:gameId" element={<OnlineGamePage />} />
        <Route path="/play/local" element={<LocalGamePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
