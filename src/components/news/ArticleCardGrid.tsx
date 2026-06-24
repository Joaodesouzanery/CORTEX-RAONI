import ArticleCard from './ArticleCard'
import type { Article } from '@/types'

interface Props {
  articles: Article[]
  selected: Set<string>
  onSelect: (id: string) => void
  scores?: Map<string, number> | null
}

export default function ArticleCardGrid({ articles, selected, onSelect, scores }: Props) {
  const anySelected = selected.size > 0
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          selected={selected.has(article.id)}
          anySelected={anySelected}
          onSelect={onSelect}
          score={scores?.get(article.id)}
        />
      ))}
    </div>
  )
}
