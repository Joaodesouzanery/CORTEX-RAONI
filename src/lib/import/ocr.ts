export async function extractPdfWithAi(data: Uint8Array): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16_000,
    system:
      'Você é um transcritor documental. Extraia fielmente todo o texto legível do PDF, em ordem de páginas. Preserve títulos, datas, veículos, autores, seções, tabelas simples e listas. Não interprete, não resuma e não invente trechos.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: Buffer.from(data).toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Transcreva o documento em Markdown pesquisável. Marque as mudanças de página como `<!-- página N -->`.',
          },
        ],
      },
    ],
  })
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

