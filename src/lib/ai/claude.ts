import Anthropic from '@anthropic-ai/sdk'
import type { Article } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateReport(
  articles: Article[],
  userPrompt: string
): Promise<string> {
  const articlesSummary = articles.map((a, i) =>
    `## Artigo ${i + 1}: ${a.title}\nFonte: ${a.sources?.name || 'Desconhecida'}\nData: ${a.published_at || 'N/A'}\nURL: ${a.url}\n\n${a.excerpt || ''}`
  ).join('\n\n---\n\n')

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8192,
    system: `Você é um analista especialista. Receberá um conjunto de artigos de notícias e um prompt do usuário. Produza um relatório profissional e estruturado em markdown, com múltiplas seções, títulos claros, análise aprofundada e citações dos artigos quando relevante. O relatório deve ser completo, coeso e adequado para executivos.`,
    messages: [
      {
        role: 'user',
        content: `${userPrompt}\n\n# Artigos para análise:\n\n${articlesSummary}`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text : ''
}
