type KpiCardProps = {
  label: string
  value: string | number
  hint?: string
}

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <article className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {hint ? <p className="kpi-hint">{hint}</p> : null}
    </article>
  )
}
