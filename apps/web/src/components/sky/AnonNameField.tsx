import { useEffect, useRef, useState } from 'react'

type AnonNameFieldProps = {
  name: string
  onNameChange: (value: string) => void
  onNameBlur: () => void
}

/** Display name editor for Supabase anonymous users (click pencil to edit). */
export function AnonNameField({ name, onNameChange, onNameBlur }: AnonNameFieldProps) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    onNameBlur()
  }

  if (!editing) {
    return (
      <>
        <span className="player-chip-name">{name.trim() || 'Player'}</span>
        <button
          type="button"
          className="player-chip-edit-btn"
          onClick={() => setEditing(true)}
          aria-label="Sửa tên hiển thị"
          title="Sửa tên"
        >
          <i className="bi bi-pencil-square" aria-hidden="true" />
        </button>
      </>
    )
  }

  return (
    <input
      ref={inputRef}
      className="player-chip-input player-chip-input--editing"
      value={name}
      onChange={(e) => onNameChange(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setEditing(false)
        }
      }}
      placeholder="Player"
      maxLength={50}
      aria-label="Tên hiển thị"
    />
  )
}
