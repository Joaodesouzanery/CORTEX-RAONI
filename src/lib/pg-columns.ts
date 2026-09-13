/**
 * Extrai o nome da coluna ausente de um erro do PostgREST/Postgres.
 *
 * Serve para degradar um `select` quando o banco está atrás das migrations.
 * A alternativa que existia — comparar a mensagem com três nomes escritos à
 * mão — tolerava só a migration 028: qualquer coluna da 026 faltando derrubava
 * a rota, e a lista de Relatórios renderizava isso como "nenhum relatório".
 *
 * Devolve `null` quando o erro não é de coluna inexistente, para o chamador
 * parar de tentar e propagar o erro de verdade em vez de entrar em laço.
 */
export function missingColumnFrom(message: string | undefined, candidates: string[]): string | null {
  if (!message) return null
  // PostgREST repassa a mensagem do Postgres: column reports.x does not exist
  const match = message.match(/column\s+(?:[\w.]+\.)?"?([a-z_][a-z0-9_]*)"?\s+does not exist/i)
  const named = match?.[1]
  if (named && candidates.includes(named)) return named
  // PGRST204: "Could not find the 'x' column of 'y' in the schema cache"
  const cache = message.match(/could not find the '([a-z_][a-z0-9_]*)' column/i)
  if (cache?.[1] && candidates.includes(cache[1])) return cache[1]
  return null
}

/**
 * Roda `attempt` com um conjunto de colunas opcionais, removendo uma a uma as
 * que o banco disser não existir. Termina em no máximo `optional.length + 1`
 * tentativas — nunca entra em laço.
 */
export async function selectWithOptionalColumns<T>(
  required: string,
  optional: string[],
  attempt: (select: string) => Promise<{ data: T | null; error: { message: string } | null }>
): Promise<{ data: T | null; error: { message: string } | null; dropped: string[] }> {
  let remaining = [...optional]
  const dropped: string[] = []
  for (let i = 0; i <= optional.length; i++) {
    const select = [required, ...remaining].filter(Boolean).join(', ')
    const result = await attempt(select)
    if (!result.error) return { ...result, dropped }
    const missing = missingColumnFrom(result.error.message, remaining)
    if (!missing) return { ...result, dropped }
    remaining = remaining.filter((column) => column !== missing)
    dropped.push(missing)
  }
  return { data: null, error: { message: 'Não foi possível montar o select de colunas.' }, dropped }
}
