import ArticleListItem from './ArticleListItem'
import type { Article, ArticleTag } from '@/types'
import type { TagPatch } from './TagControls'

interface Props {
  articles: Article[]
  selected: Set<string>
  onSelect: (id: string) => void
  scores?: Map<string, number> | null
  clientId?: string | null
  tagsById?: Map<string, ArticleTag>
  onTag?: (articleId: string, patch: TagPatch) => void
}

export default function ArticleListView({
  articles,
  selected,
  onSelect,
  scores,
  clientId,
  tagsById,
  onTag,
}: Props) {
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
          score={scores?.get(article.id)}
          clientId={clientId}
          tag={tagsById?.get(article.id) ?? null}
          onTag={onTag}
        />
      ))}
    </div>
  )
}
