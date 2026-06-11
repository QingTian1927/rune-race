type MarkerPreviewProps = {
  secondHorseGradient?: string
}

export function MarkerPreview({
  secondHorseGradient = 'linear-gradient(135deg,#ff6b60,#d93025)',
}: MarkerPreviewProps) {
  return (
    <div className="marker-preview" aria-label="Minh họa marker bí mật trên đường đi">
      <span className="path-tile">
        <span className="horse-dot" />
      </span>
      <span className="path-tile">
        <span className="secret-marker">
          <span>?</span>
        </span>
      </span>
      <span className="path-tile">
        <span className="horse-dot" style={{ background: secondHorseGradient }} />
      </span>
    </div>
  )
}
