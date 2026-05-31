import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@rune-race/shared'
import { getSocket } from '../lib/socket'

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]))
  for (const message of incoming) {
    byId.set(message.id, message)
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  )
}

export function useRoomChat(
  lobbyId: string | undefined,
  playerId: string,
  authToken?: string | null,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const lobbyIdRef = useRef(lobbyId)
  lobbyIdRef.current = lobbyId

  const requestSync = useCallback(() => {
    const id = lobbyIdRef.current
    if (!id || !playerId) return
    getSocket(authToken).emit('chat:sync_request', { playerId, lobbyId: id })
  }, [authToken, playerId])

  useEffect(() => {
    if (!lobbyId || !playerId) {
      setMessages([])
      setReady(false)
      return
    }

    const socket = getSocket(authToken)

    const onConnect = () => {
      requestSync()
    }

    const onHistory = (payload: { lobbyId: string; messages: ChatMessage[] }) => {
      if (payload.lobbyId !== lobbyId) return
      setMessages(payload.messages)
      setReady(true)
    }

    const onMessage = (message: ChatMessage) => {
      if (message.lobbyId !== lobbyId) return
      setMessages((prev) => mergeMessages(prev, [message]))
    }

    const onChatError = (payload: { message: string }) => {
      setSendError(payload.message)
    }

    if (socket.connected) {
      requestSync()
    } else {
      socket.on('connect', onConnect)
    }

    socket.on('chat:history', onHistory)
    socket.on('chat:message', onMessage)
    socket.on('chat:error', onChatError)

    return () => {
      socket.off('connect', onConnect)
      socket.off('chat:history', onHistory)
      socket.off('chat:message', onMessage)
      socket.off('chat:error', onChatError)
    }
  }, [authToken, lobbyId, playerId, requestSync])

  const sendMessage = useCallback(
    (text: string) => {
      if (!lobbyId || !playerId) return
      const trimmed = text.trim()
      if (!trimmed) return
      setSendError(null)
      getSocket(authToken).emit('chat:send', {
        playerId,
        lobbyId,
        text: trimmed,
      })
    },
    [authToken, lobbyId, playerId],
  )

  const clearSendError = useCallback(() => setSendError(null), [])

  return {
    messages,
    sendMessage,
    sendError,
    clearSendError,
    ready,
    requestSync,
  }
}
