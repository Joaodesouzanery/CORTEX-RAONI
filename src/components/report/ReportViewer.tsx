'use client'
import { Fragment } from 'react'

interface Props {
  content: string
}

// Render **bold** segments inline.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  )
}

const isTableRow = (l: string) => l.trim().startsWith('|') && l.includes('|')
const isSeparatorRow = (cells: string[]) => cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.trim()))

function cellsOf(line: string): string[] {
  const cells = line.split('|').map((c) => c.trim())
  if (cells.length && cells[0] === '') cells.shift()
  if (cells.length && cells[cells.length - 1] === '') cells.pop()
  return cells
}

export default function ReportViewer({ content }: Props) {
  const lines = content.split('\n')
  const out: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (isTableRow(line)) {
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        const cells = cellsOf(lines[i])
        if (!isSeparatorRow(cells)) rows.push(cells)
        i++
      }
      i--
      if (rows.length) {
        out.push(
          <table key={`t${i}`} className="w-full text-sm my-4 border border-gray-200">
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className={r === 0 ? 'bg-black text-white' : 'border-t border-gray-200'}>
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-1.5">{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
      continue
    }

    if (line.startsWith('# ')) out.push(<h1 key={i} className="text-3xl font-light tracking-tight mt-2 mb-4">{inline(line.slice(2))}</h1>)
    else if (line.startsWith('## ')) out.push(<h2 key={i} className="text-xl font-bold mt-8 mb-3 pb-2 border-b border-gray-200">{inline(line.slice(3))}</h2>)
    else if (line.startsWith('### ')) out.push(<h3 key={i} className="text-base font-semibold mt-5 mb-2">{inline(line.slice(4))}</h3>)
    else if (line.startsWith('- ') || line.startsWith('* ')) out.push(<li key={i} className="ml-5 text-sm text-gray-700 leading-relaxed list-disc">{inline(line.slice(2))}</li>)
    else if (line.startsWith('---')) out.push(<hr key={i} className="my-5 border-gray-100" />)
    else if (line.trim() === '') out.push(<div key={i} className="h-2" />)
    else out.push(<p key={i} className="text-sm text-gray-700 leading-relaxed mb-2 text-justify">{inline(line)}</p>)
  }

  return <div className="max-w-none">{out}</div>
}
