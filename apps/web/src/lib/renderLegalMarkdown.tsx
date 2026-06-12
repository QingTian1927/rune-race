import type { ReactNode } from 'react'

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_PATTERN).filter((part) => part.length > 0)
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (linkMatch) {
      const [, label, href] = linkMatch
      const external = /^https?:\/\//.test(href)
      return (
        <a
          key={key}
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : undefined)}
        >
          {label}
        </a>
      )
    }
    return part
  })
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|')
}

function isTableSeparator(line: string): boolean {
  return /^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line.trim())
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function renderTable(lines: string[], startIndex: number): { node: ReactNode; nextIndex: number } {
  const header = parseTableRow(lines[startIndex]!)
  const bodyRows: string[][] = []
  let index = startIndex + 2

  while (index < lines.length && isTableRow(lines[index]!)) {
    if (!isTableSeparator(lines[index]!)) {
      bodyRows.push(parseTableRow(lines[index]!))
    }
    index++
  }

  return {
    nextIndex: index,
    node: (
      <div key={`table-${startIndex}`} className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              {header.map((cell, cellIndex) => (
                <th key={cellIndex}>{parseInline(cell, `th-${startIndex}-${cellIndex}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{parseInline(cell, `td-${startIndex}-${rowIndex}-${cellIndex}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  }
}

export function renderLegalMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.split('\n')
  const nodes: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    const trimmed = line.trim()

    if (trimmed.startsWith('# ')) {
      index++
      continue
    }

    if (trimmed === '') {
      index++
      continue
    }

    if (isTableRow(trimmed) && index + 1 < lines.length && isTableSeparator(lines[index + 1]!)) {
      const table = renderTable(lines, index)
      nodes.push(table.node)
      index = table.nextIndex
      continue
    }

    if (trimmed.startsWith('## ')) {
      nodes.push(
        <h2 key={`h2-${index}`}>{parseInline(trimmed.slice(3), `h2-${index}`)}</h2>,
      )
      index++
      continue
    }

    if (trimmed.startsWith('### ')) {
      nodes.push(
        <h3 key={`h3-${index}`}>{parseInline(trimmed.slice(4), `h3-${index}`)}</h3>,
      )
      index++
      continue
    }

    if (trimmed.startsWith('- ')) {
      const items: ReactNode[] = []
      while (index < lines.length && lines[index]!.trim().startsWith('- ')) {
        const itemText = lines[index]!.trim().slice(2)
        items.push(<li key={`li-${index}`}>{parseInline(itemText, `li-${index}`)}</li>)
        index++
      }
      nodes.push(<ul key={`ul-${index}`}>{items}</ul>)
      continue
    }

    nodes.push(<p key={`p-${index}`}>{parseInline(trimmed, `p-${index}`)}</p>)
    index++
  }

  return nodes
}
