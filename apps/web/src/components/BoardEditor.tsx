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
  editorMouseMode?: 'draw' | 'camera'
  setEditorMouseMode?: (v: 'draw' | 'camera') => void
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
  editorMouseMode = 'draw',
  setEditorMouseMode,
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
        <button
          onClick={() => onModeChange('stable')}
          className={`px-2 py-1 ${
            mode === 'stable' ? 'bg-indigo-600' : 'bg-gray-600'
          } rounded`}
        >
          Stable
        </button>
        <button
          onClick={() => onModeChange('home')}
          className={`px-2 py-1 ${
            mode === 'home' ? 'bg-pink-600' : 'bg-gray-600'
          } rounded`}
        >
          Home
        </button>
      </div>

      {(mode === 'home-lane' || mode === 'stable' || mode === 'home') && (
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
        <div>Stable Box (P{selectedPlayer}): {data.players[selectedPlayer].stable ? 'Saved' : 'None'}</div>
        <div>Home Box (P{selectedPlayer}): {data.players[selectedPlayer].home ? 'Saved' : 'None'}</div>
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
      <div className="mt-2 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 bg-black/30 rounded">Mouse: {editorMouseMode === 'draw' ? 'Draw' : 'Camera'}</div>
          <div className="text-slate-400">Use Toggle button to switch modes</div>
          {setEditorMouseMode && (
            <button
              onClick={() => setEditorMouseMode(editorMouseMode === 'draw' ? 'camera' : 'draw')}
              className="ml-2 px-2 py-1 bg-gray-700 rounded text-xs"
            >
              Toggle
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
