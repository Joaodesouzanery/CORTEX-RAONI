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

export default function ArticleCard({ article, selected, onSelect, score }: Props) {
  return (
    <div className={cn('group flex flex-col', selected && 'ring-2 ring-black')}>
      {/* Source + Date header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-widest text-gray-500 flex items-center gap-2">
          {score != null && score > 0 && (
            <span className="bg-black text-white px-1.5 py-0.5 text-[10px] tracking-normal" title="Relevância para o cliente">
              ★ {score}
            </span>
          )}
          {article.publisher || article.sources?.name}{article.published_at ? `, ${formatDate(article.published_at)}` : ''}
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
      <div className="relative w-full aspect-video bg-gray-100 overflow-hidden mb-3">
        {article.image_url ? (
          <Image
            src={article.image_url}
            alt={article.title}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gray-200" />
        )}
      </div>

      {/* Title */}
      <h3 className="font-bold text-base leading-snug line-clamp-2 mb-2">
        {article.title}
      </h3>

      {/* Excerpt */}
      {article.excerpt && (
        <p className="text-sm text-gray-600 line-clamp-3 mb-3 flex-1">
          {article.excerpt}
        </p>
      )}

      {/* Read link */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-black hover:underline mt-auto"
      >
        ↳ Saiba Mais
      </a>
    </div>
  )
}
