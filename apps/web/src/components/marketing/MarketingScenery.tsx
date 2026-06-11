export function MarketingScenery() {
  return (
    <>
      <div className="cloud-layer" aria-hidden="true">
        <span className="cloud" style={{ ['--w' as string]: '130px', ['--top' as string]: '12%', ['--duration' as string]: '49s', ['--delay' as string]: '-22s' }} />
        <span className="cloud" style={{ ['--w' as string]: '180px', ['--top' as string]: '24%', ['--duration' as string]: '63s', ['--delay' as string]: '-44s' }} />
        <span className="cloud" style={{ ['--w' as string]: '95px', ['--top' as string]: '38%', ['--duration' as string]: '42s', ['--delay' as string]: '-8s' }} />
        <span className="cloud" style={{ ['--w' as string]: '145px', ['--top' as string]: '54%', ['--duration' as string]: '58s', ['--delay' as string]: '-30s' }} />
      </div>
      <div className="hill-layer" aria-hidden="true">
        <span className="hill" />
        <span className="hill" />
        <span className="hill" />
        <span className="hill" />
      </div>
    </>
  )
}
