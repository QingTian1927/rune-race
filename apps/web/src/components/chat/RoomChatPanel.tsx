import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@rune-race/shared'
import { CHAT_MAX_TEXT_LENGTH } from '@rune-race/shared'
import { PanelCollapseButton } from '../hud/PanelCollapseButton'
import { HUD_PANEL_LABEL_CLASS, HUD_PLAYER_NAME_CLASS, PLAYER_COLOR_MAP } from '../hud/playerColorStyles'

type RoomChatPanelProps = {
  messages: ChatMessage[]
  localPlayerId: string
  onSend: (text: string) => void
  sendError: string | null
  onClearSendError?: () => void
  placement: 'lobby' | 'game'
}

function formatTime(sentAt: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(sentAt))
  } catch {
    return ''
  }
}

export function RoomChatPanel({
  messages,
  localPlayerId,
  onSend,
  sendError,
  onClearSendError,
  placement,
}: RoomChatPanelProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [draft, setDraft] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const seenLastIdRef = useRef<string | null>(null)
  const chatInitializedRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (!collapsed) {
      scrollToBottom()
    }
  }, [collapsed, messages, scrollToBottom])

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last) return

    if (!chatInitializedRef.current) {
      chatInitializedRef.current = true
      seenLastIdRef.current = last.id
      return
    }

    if (last.id === seenLastIdRef.current) return
    seenLastIdRef.current = last.id

    if (collapsed && last.playerId !== localPlayerId) {
      setUnreadCount((n) => n + 1)
    }
  }, [collapsed, localPlayerId, messages])

  const handleExpand = () => {
    setCollapsed(false)
    setUnreadCount(0)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
    onClearSendError?.()
    if (!collapsed) {
      requestAnimationFrame(() => scrollToBottom())
    }
  }

  const slotClass =
    placement === 'game' ? 'game-hud-slot game-hud-slot--chat' : 'room-chat-slot room-chat-slot--lobby'

  if (collapsed) {
    return (
      <div className={slotClass}>
        <div className="game-hud-panel game-hud-panel--collapsed room-chat-panel room-chat-panel--collapsed">
          <button
            type="button"
            className="room-chat-collapsed-hit"
            onClick={handleExpand}
            aria-label="Mở chat phòng"
          >
            <i className="bi bi-chat-dots-fill room-chat-collapsed-icon" aria-hidden />
            {unreadCount > 0 ? (
              <span className="room-chat-unread" aria-live="polite">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </button>
          <PanelCollapseButton
            collapsed={collapsed}
            expandDirection="right"
            onClick={handleExpand}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={slotClass}>
      <div className="game-hud-panel room-chat-panel">
        <div className="room-chat-head">
          <div>
            <p className={HUD_PANEL_LABEL_CLASS}>Chat phòng</p>
            <p className="room-chat-subtitle">UTF-8 · mọi ngôn ngữ</p>
          </div>
          <PanelCollapseButton
            collapsed={collapsed}
            expandDirection="right"
            onClick={() => setCollapsed(true)}
            className="game-hud-collapse-end"
          />
        </div>

        <div ref={listRef} className="room-chat-messages" role="log" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 ? (
            <p className="room-chat-empty">Chưa có tin nhắn. Chào mọi người!</p>
          ) : (
            messages.map((message) => {
              const isSelf = message.playerId === localPlayerId
              const colorStyles = message.playerColor
                ? PLAYER_COLOR_MAP[message.playerColor]
                : null
              return (
                <div
                  key={message.id}
                  className={['room-chat-bubble', isSelf ? 'room-chat-bubble--self' : ''].join(' ')}
                >
                  <div className="room-chat-bubble-meta">
                    <span
                      className={[
                        HUD_PLAYER_NAME_CLASS,
                        'room-chat-author',
                        colorStyles?.nameClass ?? '',
                      ].join(' ')}
                    >
                      {message.playerName}
                    </span>
                    <time className="room-chat-time" dateTime={message.sentAt}>
                      {formatTime(message.sentAt)}
                    </time>
                  </div>
                  <p className="room-chat-text">{message.text}</p>
                </div>
              )
            })
          )}
        </div>

        {sendError ? <p className="room-chat-error">{sendError}</p> : null}

        <form className="room-chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="room-chat-input"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (sendError) onClearSendError?.()
            }}
            maxLength={CHAT_MAX_TEXT_LENGTH}
            placeholder="Nhập tin nhắn…"
            autoComplete="off"
            enterKeyHint="send"
            lang="und"
          />
          <button
            type="submit"
            className="room-chat-send"
            disabled={!draft.trim()}
            aria-label="Gửi tin nhắn"
          >
            Gửi
          </button>
        </form>
      </div>
    </div>
  )
}
