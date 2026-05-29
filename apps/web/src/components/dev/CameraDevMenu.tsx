import { useCallback, useState } from 'react'
import {
  buildCameraConfigSnippet,
  buildCameraPositionTargetSnippet,
  CAMERA_CONFIG,
  type CameraDebugInfo,
} from '../../config/cameraConfig'

type CameraDevMenuProps = {
  info: CameraDebugInfo | null
  onClose: () => void
}

function formatVec(v: { x: number; y: number; z: number }): string {
  return `[${v.x}, ${v.y}, ${v.z}]`
}

function differs(
  live: { x: number; y: number; z: number },
  saved: readonly [number, number, number],
): boolean {
  return live.x !== saved[0] || live.y !== saved[1] || live.z !== saved[2]
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function Row({
  label,
  value,
  hint,
  changed,
  onCopy,
}: {
  label: string
  value: string
  hint?: string
  changed?: boolean
  onCopy?: () => void
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_auto] items-start gap-x-2 gap-y-0.5 border-b border-gray-700 py-1.5 last:border-0">
      <span className="pt-0.5 text-slate-300">{label}</span>
      <div className="min-w-0">
        <code
          className={`block break-all leading-relaxed ${changed ? 'text-yellow-300' : 'text-white'}`}
        >
          {value}
        </code>
        {hint ? <span className="mt-0.5 block text-[10px] text-slate-400">{hint}</span> : null}
      </div>
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded bg-gray-700 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-gray-600"
        >
          Copy
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}

export default function CameraDevMenu({ info, onClose }: CameraDevMenuProps) {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  const flashCopied = useCallback((label: string) => {
    setCopiedLabel(label)
    window.setTimeout(() => setCopiedLabel(null), 1600)
  }, [])

  const handleCopy = useCallback(
    async (label: string, text: string) => {
      if (await copyText(text)) {
        flashCopied(label)
      }
    },
    [flashCopied],
  )

  return (
    <div className="pointer-events-auto w-[min(100vw-2rem,24rem)] rounded bg-black/95 p-4 font-mono text-xs text-white shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">Camera dev</p>
          <p className="mt-1 text-slate-300">
            Orbit camera — chỉnh view rồi Copy vào <code className="text-white">cameraConfig.ts</code>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-red-600 px-2 py-1 text-[10px] font-semibold hover:bg-red-500"
          aria-label="Đóng dev menu"
        >
          F3
        </button>
      </div>

      {!info ? (
        <p className="rounded bg-black/40 px-3 py-2 text-slate-300">Đang chờ dữ liệu camera…</p>
      ) : (
        <>
          <p className="mb-1.5 font-bold text-slate-200">Live (OrbitControls)</p>
          <div className="mb-3 rounded bg-black/40 px-2">
            <Row
              label="position"
              value={formatVec(info.position)}
              changed={differs(info.position, CAMERA_CONFIG.position)}
              onCopy={() => void handleCopy('position', formatVec(info.position))}
            />
            <Row
              label="target"
              value={formatVec(info.target)}
              changed={differs(info.target, CAMERA_CONFIG.target)}
              onCopy={() => void handleCopy('target', formatVec(info.target))}
            />
            <Row label="distance" value={String(info.distanceToTarget)} hint="Khoảng cách tới target" />
            <Row
              label="fov"
              value={info.fov !== null ? String(info.fov) : '—'}
              changed={info.fov !== null && info.fov !== CAMERA_CONFIG.fov}
            />
            <Row
              label="polar °"
              value={info.polarAngleDeg !== null ? String(info.polarAngleDeg) : '—'}
              hint="Góc ngửa (OrbitControls)"
            />
            <Row
              label="azimuth °"
              value={info.azimuthAngleDeg !== null ? String(info.azimuthAngleDeg) : '—'}
              hint="Góc quay ngang"
            />
            <Row
              label="rotation °"
              value={`x ${info.rotationDeg.x}, y ${info.rotationDeg.y}, z ${info.rotationDeg.z}`}
              hint="Euler camera (độ)"
            />
            <Row label="zoom" value={String(info.zoom)} />
            <Row label="near / far" value={`${info.near} / ${info.far}`} />
            <Row label="dpr" value={String(info.dpr)} hint="Device pixel ratio" />
          </div>

          <p className="mb-1.5 font-bold text-slate-200">Đang lưu trong config</p>
          <div className="mb-3 rounded bg-black/40 px-2 py-1.5 text-slate-300">
            <div>position {formatVec({ x: CAMERA_CONFIG.position[0], y: CAMERA_CONFIG.position[1], z: CAMERA_CONFIG.position[2] })}</div>
            <div>target {formatVec({ x: CAMERA_CONFIG.target[0], y: CAMERA_CONFIG.target[1], z: CAMERA_CONFIG.target[2] })}</div>
            <div>fov {CAMERA_CONFIG.fov} · zoom {CAMERA_CONFIG.minDistance}–{CAMERA_CONFIG.maxDistance}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopy('snippet', buildCameraConfigSnippet(info))}
              className="rounded bg-green-600 px-2 py-1 font-semibold hover:bg-green-500"
            >
              Copy pos + target + fov
            </button>
            <button
              type="button"
              onClick={() => void handleCopy('full', buildCameraPositionTargetSnippet(info))}
              className="rounded bg-blue-600 px-2 py-1 font-semibold hover:bg-blue-500"
            >
              Copy pos & target
            </button>
          </div>
        </>
      )}

      {copiedLabel ? (
        <p className="mt-2 text-center font-semibold text-green-400">Đã copy ({copiedLabel})</p>
      ) : null}

      <p className="mt-3 border-t border-gray-700 pt-2 text-slate-300">
        F4 — board editor · Kéo chuột để orbit / zoom / pan
      </p>
    </div>
  )
}
