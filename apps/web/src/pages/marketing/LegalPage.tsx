import { PageMeta } from '../../components/marketing/PageMeta'
import { LegalDocumentView } from '../../components/marketing/LegalDocumentView'
import { getLegalDoc, type LegalKind, type LegalLang } from '../../lib/legalDocuments'

type LegalPageProps = {
  kind: LegalKind
  lang: LegalLang
}

export default function LegalPage({ kind, lang }: LegalPageProps) {
  const doc = getLegalDoc(kind, lang)

  return (
    <>
      <PageMeta path={doc.path} lang={doc.lang} />
      <LegalDocumentView doc={doc} />
    </>
  )
}
