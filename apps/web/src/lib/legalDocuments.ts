import privacyVi from '../../../../docs/legal/privacy.vi.md?raw'
import privacyEn from '../../../../docs/legal/privacy.en.md?raw'
import termsVi from '../../../../docs/legal/terms.vi.md?raw'
import termsEn from '../../../../docs/legal/terms.en.md?raw'

export type LegalLang = 'vi' | 'en'
export type LegalKind = 'privacy' | 'terms'

export type LegalDocMeta = {
  kind: LegalKind
  lang: LegalLang
  path: string
  alternatePath: string
  alternateLabel: string
  eyebrow: string
  title: string
  subtitle: string
  seoDescription: string
  markdown: string
}

const RAW: Record<LegalKind, Record<LegalLang, string>> = {
  privacy: { vi: privacyVi, en: privacyEn },
  terms: { vi: termsVi, en: termsEn },
}

function extractTitle(markdown: string): string {
  const match = /^# (.+)$/m.exec(markdown)
  return match?.[1]?.trim() ?? ''
}

function extractSubtitle(markdown: string): string {
  const meta = [...markdown.matchAll(/^\*\*([^*]+):\*\* (.+)$/gm)]
    .slice(0, 2)
    .map(([, label, value]) => `${label}: ${value}`)
  return meta.join(' · ')
}

const CONFIG: Record<LegalKind, Record<LegalLang, Omit<LegalDocMeta, 'kind' | 'lang' | 'markdown' | 'title' | 'subtitle'>>> = {
  privacy: {
    vi: {
      path: '/privacy',
      alternatePath: '/privacy/en',
      alternateLabel: 'English version',
      eyebrow: 'Pháp lý',
      seoDescription:
        'Chính sách quyền riêng tư của Rune Race: thu thập dữ liệu, đăng nhập Google, email, chơi ẩn danh, Supabase và Render.',
    },
    en: {
      path: '/privacy/en',
      alternatePath: '/privacy',
      alternateLabel: 'Bản tiếng Việt',
      eyebrow: 'Legal',
      seoDescription:
        'Rune Race Privacy Policy: data collection, Google Sign-In, email accounts, anonymous play, Supabase, and Render.',
    },
  },
  terms: {
    vi: {
      path: '/terms',
      alternatePath: '/terms/en',
      alternateLabel: 'English version',
      eyebrow: 'Pháp lý',
      seoDescription:
        'Điều khoản dịch vụ Rune Race: quy tắc sử dụng, tài khoản, chat trong game và trách nhiệm người chơi.',
    },
    en: {
      path: '/terms/en',
      alternatePath: '/terms',
      alternateLabel: 'Bản tiếng Việt',
      eyebrow: 'Legal',
      seoDescription:
        'Rune Race Terms of Service: usage rules, accounts, in-game chat, and player responsibilities.',
    },
  },
}

export function getLegalDoc(kind: LegalKind, lang: LegalLang): LegalDocMeta {
  const markdown = RAW[kind][lang]
  const base = CONFIG[kind][lang]
  return {
    kind,
    lang,
    markdown,
    title: extractTitle(markdown),
    subtitle: extractSubtitle(markdown),
    ...base,
  }
}
