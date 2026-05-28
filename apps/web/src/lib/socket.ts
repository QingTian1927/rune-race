import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@rune-race/shared'
import { API_BASE } from '../config'

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: GameSocket | null = null
let currentToken: string | null = null

export function getSocket(token?: string | null): GameSocket {
  if (!socket) {
    currentToken = token ?? null
    socket = io(API_BASE || undefined, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: currentToken ? { token: currentToken } : undefined,
    })
  } else if ((token ?? null) !== currentToken) {
    currentToken = token ?? null
    socket.auth = currentToken ? { token: currentToken } : {}
    if (socket.connected) socket.disconnect()
    socket.connect()
  }
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
  currentToken = null
}
