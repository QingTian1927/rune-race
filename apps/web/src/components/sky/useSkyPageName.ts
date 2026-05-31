import { useEffect, useState } from 'react'
import { getPlayerName, setPlayerName } from '../../lib/playerSession'
import { usePlayerIdentity } from '../../hooks/usePlayerIdentity'

export function useSkyPageName() {
  const { playerName } = usePlayerIdentity()
  const [name, setName] = useState(playerName || getPlayerName())

  useEffect(() => {
    if (playerName) setName(playerName)
  }, [playerName])

  const onNameBlur = () => setPlayerName(name)

  return { name, setName, onNameBlur }
}
