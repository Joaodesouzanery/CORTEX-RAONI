'use client'

interface Props {
  content: string
}

export default function ReportViewer({ content }: Props) {
  const lines = content.split('\n')

  return (
    <div className="prose prose-sm max-w-none">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-5 mb-2">{line.slice(3)}</h2>
        if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>
        if (line.startsWith('---')) return <hr key={i} className="my-4 border-gray-200" />
        if (line.trim() === '') return <div key={i} className="h-3" />
        return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>
      })}
    </div>
  )
}
