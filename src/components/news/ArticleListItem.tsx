'use client'
import Image from 'next/image'
import { formatDate } from '@/lib/utils'
import type { Article } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  article: Article
  selected: boolean
  anySelected?: boolean
  onSelect: (id: string) => void
  score?: number
}

export default function ArticleListItem({ article, selected, onSelect, score }: Props) {
  return (
    <div className={cn('flex gap-4 py-4 border-b border-gray-100 group', selected && 'bg-gray-50')}>
      {/* Checkbox */}
      <div
        className={cn(
          'flex-shrink-0 self-start mt-1 w-5 h-5 border flex items-center justify-center cursor-pointer',
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

      {/* Thumbnail */}
      <div className="flex-shrink-0 relative w-24 h-16 bg-gray-100 overflow-hidden">
        {article.image_url ? (
          <Image src={article.image_url} alt={article.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full bg-gray-200" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-xs uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2">
          {score != null && score > 0 && (
            <span className="bg-black text-white px-1.5 py-0.5 text-[10px] tracking-normal" title="Relevância para o cliente">
              ★ {score}
            </span>
          )}
          {article.publisher || article.sources?.name}{article.published_at ? `, ${formatDate(article.published_at)}` : ''}
        </span>
        <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-1">{article.title}</h3>
        {article.excerpt && (
          <p className="text-sm text-gray-500 line-clamp-2">{article.excerpt}</p>
        )}
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-xs text-black hover:underline mt-1">
          ↳ Saiba Mais
        </a>
      </div>
    </div>
  )
}
