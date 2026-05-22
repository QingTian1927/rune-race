import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LobbyPage from './pages/LobbyPage'
import LocalGamePage from './pages/LocalGamePage'
import OnlineGamePage from './pages/OnlineGamePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
        <Route path="/game/:gameId" element={<OnlineGamePage />} />
        <Route path="/play/local" element={<LocalGamePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
