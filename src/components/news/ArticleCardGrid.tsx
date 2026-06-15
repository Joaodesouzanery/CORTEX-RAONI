import ArticleCard from './ArticleCard'
import type { Article } from '@/types'

interface Props {
  articles: Article[]
  selected: Set<string>
  onSelect: (id: string) => void
}

export default function ArticleCardGrid({ articles, selected, onSelect }: Props) {
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
        />
      ))}
    </div>
  )
}
