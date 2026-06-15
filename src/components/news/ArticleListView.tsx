import ArticleListItem from './ArticleListItem'
import type { Article } from '@/types'

interface Props {
  articles: Article[]
  selected: Set<string>
  onSelect: (id: string) => void
}

export default function ArticleListView({ articles, selected, onSelect }: Props) {
  const anySelected = selected.size > 0
  return (
    <div>
      {articles.map((article) => (
        <ArticleListItem
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
