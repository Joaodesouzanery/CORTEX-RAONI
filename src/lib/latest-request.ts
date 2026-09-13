/**
 * Guarda de "última requisição vence".
 *
 * Nasceu do bug de Notícias: dois `useEffect` sem coordenação disparavam duas
 * buscas de artigos: a primeira sem `client_id` (cara, sobre a tabela toda) e a
 * segunda já com o cliente. Sem guarda, quem resolvesse POR ÚLTIMO escrevia o
 * estado — então a requisição cara que falhou por timeout sobrescrevia a
 * barata que tinha dado certo, e a tela mostrava erro com os artigos
 * carregados na memória.
 *
 * Separado em módulo próprio porque o vitest deste repo roda em `environment:
 * 'node'`: assim a lógica que importa fica testável sem DOM.
 */
export interface LatestGuard {
  /** Abre uma requisição e devolve o token dela. */
  begin(): number
  /** `true` só se nenhuma requisição mais nova tiver começado depois. */
  isCurrent(token: number): boolean
}

export function createLatestGuard(): LatestGuard {
  let seq = 0
  return {
    begin: () => ++seq,
    isCurrent: (token: number) => token === seq,
  }
}
