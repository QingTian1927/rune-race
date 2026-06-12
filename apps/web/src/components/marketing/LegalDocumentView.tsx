import { Link } from 'react-router-dom'
import type { LegalDocMeta } from '../../lib/legalDocuments'
import { renderLegalMarkdown } from '../../lib/renderLegalMarkdown'
import { Reveal } from './Reveal'

type LegalDocumentViewProps = {
  doc: LegalDocMeta
}

export function LegalDocumentView({ doc }: LegalDocumentViewProps) {
  return (
    <main>
      <Reveal className="page-hero">
        <span className="eyebrow">
          <i className="bi bi-file-earmark-text-fill" aria-hidden="true" /> {doc.eyebrow}
        </span>
        <h1>{doc.title}</h1>
        {doc.subtitle ? <p>{doc.subtitle}</p> : null}
        <p className="legal-lang-switch">
          <Link to={doc.alternatePath}>{doc.alternateLabel}</Link>
        </p>
      </Reveal>

      <section className="section section-sm">
        <Reveal className="legal-doc surface">{renderLegalMarkdown(doc.markdown)}</Reveal>
      </section>
    </main>
  )
}
