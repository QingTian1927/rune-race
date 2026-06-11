import { Link } from 'react-router-dom'

type PlayCtaProps = {
  title: string
  description: string
  buttonLabel?: string
}

export function PlayCta({
  title,
  description,
  buttonLabel = 'Chơi Rune Race',
}: PlayCtaProps) {
  return (
    <section className="section section-sm">
      <div className="cta-card surface reveal visible">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Link className="btn btn-primary" to="/play">
          <i className="bi bi-play-circle-fill" aria-hidden="true" /> {buttonLabel}
        </Link>
      </div>
    </section>
  )
}
