'use client'
import Image from 'next/image'
import { formatDate } from '@/lib/utils'
import type { Article } from '@/types'
import { cn } from '@/lib/utils'
import { articleImageMatches, safeExternalUrl } from '@/lib/url'

interface Props {
  article: Article
  selected: boolean
  anySelected?: boolean
  onSelect: (id: string) => void
  score?: number
}

export default function ArticleCard({ article, selected, onSelect, score }: Props) {
  // Link real resolvido tem prioridade sobre o redirecionador do Google News.
  const link = (article as Article & { resolved_url?: string | null }).resolved_url || article.url
  const showImage = articleImageMatches(article.image_url, link)
  return (
    <div className={cn('group card-hover flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white', selected && 'ring-2 ring-sky-600')}>
      {/* Source + Date header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {article.tag?.manual_intake && (
            <span
              className="border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] tracking-normal text-blue-800"
              title="Material adicionado pela área Importações"
            >
              Enviada por mim
            </span>
          )}
          {score != null && score > 0 && (
            <span
              className="bg-black text-white px-1.5 py-0.5 text-[10px] tracking-normal"
              title="Relevância para o cliente"
            >
              ★ {score}
            </span>
          )}
          <span className="font-medium uppercase tracking-wide text-gray-700">{article.publisher || article.sources?.name}</span>
          {article.published_at ? <span>· {formatDate(article.published_at)}</span> : null}
        </span>
        {/* Checkbox */}
        <div
          className={cn(
            'w-5 h-5 border flex items-center justify-center cursor-pointer',
            selected ? 'bg-black border-black' : 'border-gray-300'
          )}
          onClick={() => onSelect(article.id)}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Image */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
        {showImage && article.image_url ? (
          <Image src={article.image_url} alt="" fill className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-950 to-slate-700">
            <span className="line-clamp-2 px-3 text-center text-xs uppercase tracking-widest text-white/80">
              {article.publisher || article.sources?.name || 'Sem imagem'}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      {/* Manchete inteira: cortar o título escondia justamente o que decide a leitura. */}
      <h3 className="mx-4 mt-3 mb-2 text-base font-semibold leading-snug text-slate-900">{article.title}</h3>

      {/* Excerpt */}
      {article.excerpt && <p className="mx-4 mb-3 flex-1 text-sm text-slate-600 line-clamp-3">{article.excerpt}</p>}

      {/* Read link — o href passa pelo validador: linhas gravadas antes da
          correção na ingestão podem conter javascript:, e o React não sanitiza. */}
      {safeExternalUrl(link) ? (
        <a
          href={safeExternalUrl(link)!}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring mx-4 mb-4 mt-auto inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          Ler matéria
        </a>
      ) : (
        <span className="text-xs text-gray-400 mt-auto">Sem link externo</span>
      )}
    </div>
  )
}
