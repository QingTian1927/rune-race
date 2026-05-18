import React, { useState } from 'react'
import {
  BoardLayoutData,
  EditorMode,
  validateLayout,
  exportLayoutJSON,
} from '../utils/boardEditorState'

interface BoardEditorControlsProps {
  isActive: boolean
  data: BoardLayoutData
  mode: EditorMode
  selectedPlayer: number
  onModeChange: (mode: EditorMode) => void
  onPlayerChange: (player: number) => void
  onDataChange: (data: BoardLayoutData) => void
  onExport: (json: string) => void
  onClose: () => void
}

export const BoardEditorControls: React.FC<BoardEditorControlsProps> = ({
  isActive,
  data,
  mode,
  selectedPlayer,
  onModeChange,
  onPlayerChange,
  onExport,
  onClose,
}) => {
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  if (!isActive) return null

  return (
    <div className="fixed bottom-4 left-4 bg-black bg-opacity-80 text-white p-4 rounded font-mono text-xs max-w-96 z-40">
      <div className="mb-2 font-bold">Board Editor</div>
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          onClick={() => onModeChange('main-track')}
          className={`px-2 py-1 ${
            mode === 'main-track' ? 'bg-blue-600' : 'bg-gray-600'
          } rounded`}
        >
          Main Track
        </button>
        <button
          onClick={() => onModeChange('home-lane')}
          className={`px-2 py-1 ${
            mode === 'home-lane' ? 'bg-green-600' : 'bg-gray-600'
          } rounded`}
        >
          Home Lane
        </button>
      </div>

      {mode === 'home-lane' && (
        <div className="mb-2 flex flex-wrap gap-2">
          <span>Player:</span>
          {[0, 1, 2, 3].map((p) => (
            <button
              key={p}
              onClick={() => onPlayerChange(p)}
              className={`px-2 py-1 ${
                selectedPlayer === p ? 'bg-yellow-600' : 'bg-gray-600'
              } rounded`}
            >
              P{p}
            </button>
          ))}
        </div>
      )}

      <div className="mb-2 space-y-1">
        <div>Main Track: {data.mainTrack.length}/44</div>
        <div>Home Lane (P{selectedPlayer}): {data.players[selectedPlayer].homeLane.length}/5</div>
      </div>

      {validationErrors.length > 0 && (
        <div className="mb-2 text-red-400 space-y-1">
          {validationErrors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => {
            const errors = validateLayout(data)
            setValidationErrors(errors)
          }}
          className="px-2 py-1 bg-blue-600 rounded"
        >
          Validate
        </button>
        <button
          onClick={() => onExport(exportLayoutJSON(data))}
          className="px-2 py-1 bg-green-600 rounded"
        >
          Export
        </button>
        <button onClick={onClose} className="px-2 py-1 bg-red-600 rounded">
          Close
        </button>
      </div>
    </div>
  )
}
