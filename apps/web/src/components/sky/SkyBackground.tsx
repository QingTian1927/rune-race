const CLOUD_CLASSES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] as const

export function SkyBackground() {
  return (
    <>
      <div className="sky-gradient-stack" aria-hidden="true">
        <div className="sky-layer sky-layer-day" />
        <div className="sky-layer sky-layer-dusk" />
        <div className="sky-layer sky-layer-night" />
        <div className="sky-layer sky-layer-dawn" />
      </div>

      <div className="sky-celestials" aria-hidden="true">
        <div className="sky-sun" />
        <div className="sky-moon" />
      </div>

      <div className="clouds-layer">
        {[0, 1].map((pass) =>
          CLOUD_CLASSES.map((cls) => (
            <div key={`${pass}-${cls}`} className={`cloud ${cls}`} style={{ left: '-200px' }} />
          )),
        )}
      </div>

      <div className="stars" aria-hidden="true" />

      <div className="hills" aria-hidden="true">
        <div className="hill hill1">
          <div className="tree" style={{ left: '40px' }}>
            <div className="tree-top2" />
            <div className="tree-top" />
            <div className="tree-trunk" />
          </div>
          <div className="tree" style={{ left: '90px' }}>
            <div className="tree-top2" />
            <div className="tree-top" />
            <div className="tree-trunk" />
          </div>
        </div>
        <div className="hill hill2">
          <div className="tree" style={{ left: '60px' }}>
            <div className="tree-top2" />
            <div className="tree-top" />
            <div className="tree-trunk" />
          </div>
        </div>
        <div className="hill hill3">
          <div className="tree" style={{ right: '50px' }}>
            <div className="tree-top2" />
            <div className="tree-top" />
            <div className="tree-trunk" />
          </div>
          <div className="tree" style={{ right: '100px' }}>
            <div className="tree-top2" />
            <div className="tree-top" />
            <div className="tree-trunk" />
          </div>
        </div>
        <div className="hill hill5" />
        <div className="hill hill4" />
      </div>
    </>
  )
}
