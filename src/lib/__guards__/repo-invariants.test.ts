import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Invariantes do repositório.
 *
 * Cada asserção aqui corresponde a um achado real da auditoria de segurança.
 * A correção pontual sai numa linha; o que impede a regressão é este arquivo —
 * é o que faz um agente (ou você às 2h da manhã) não desfazer a decisão sem
 * perceber. Falha de teste com a mensagem explicando o porquê vale mais que um
 * comentário no código que ninguém relê.
 */

const ROOT = join(__dirname, '..', '..', '..')

function walk(dir: string, filter: (p: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, filter))
    else if (filter(full)) out.push(full)
  }
  return out
}

const sourceFiles = walk(join(ROOT, 'src'), (p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p))
const read = (p: string) => ({ path: relative(ROOT, p), text: readFileSync(p, 'utf8') })

describe('invariantes de segurança do repositório', () => {
  it('não interpola entrada de usuário em filtro cru do PostgREST', () => {
    // `.or()` e `.filter()` recebem uma STRING DE FILTRO crua — o postgrest-js
    // não escapa nada. Interpolar ali deu um oráculo booleano sobre
    // articles.content via ?published_after=.
    //
    // Se a interpolação for comprovadamente segura (valor reconstruído pela
    // máquina, ou constante de compilação), marque a linha anterior com
    // `safe-filter-ok:` e a razão. O marcador é greppável e força justificar.
    const offenders: string[] = []
    for (const { path, text } of sourceFiles.map(read)) {
      const lines = text.split('\n')
      lines.forEach((line, index) => {
        if (!/\.(?:or|filter)\(`/.test(line) || !line.includes('${')) return
        const janela = lines.slice(Math.max(0, index - 3), index).join('\n')
        if (janela.includes('safe-filter-ok')) return
        offenders.push(`${path}:${index + 1}: ${line.trim().slice(0, 90)}`)
      })
    }
    expect(offenders, 'valide/reconstrua o valor, ou justifique com // safe-filter-ok:').toEqual([])
  })

  it('não faz fetch direto para URL de terceiro fora do safe-fetch', () => {
    // Cinco caminhos de saída buscavam sources.url / articles.url sem guarda
    // nenhuma, e POST /api/sources aceita qualquer URL de qualquer um.
    const offenders: string[] = []
    for (const { path, text } of sourceFiles.map(read)) {
      if (!/^src\/lib\/fetcher\//.test(path)) continue
      if (path.endsWith('safe-fetch.ts')) continue
      // `fetch(` direto — o permitido é safeFetch(. Host fixo e comprovado
      // pode ficar, desde que marcado com `safe-fetch-ok:` na linha anterior.
      const lines = text.split('\n')
      lines.forEach((line, index) => {
        if (!/(?<!safe)(?<![A-Za-z])fetch\(/.test(line)) return
        const janela = lines.slice(Math.max(0, index - 2), index).join('\n')
        if (janela.includes('safe-fetch-ok')) return
        offenders.push(`${path}:${index + 1}`)
      })
    }
    expect(offenders, 'use safeFetch de @/lib/safe-fetch: valida cada salto de redirecionamento').toEqual([])
  })

  it('não renderiza href de terceiro sem safeExternalUrl', () => {
    // React NÃO sanitiza href. articles.url vem do <link> de um feed.
    const offenders: string[] = []
    for (const { path, text } of sourceFiles.map(read)) {
      if (!path.endsWith('.tsx')) continue
      for (const match of text.match(/href=\{[^}]*\}/g) || []) {
        if (match.includes('safeExternalUrl')) continue
        // Só interessa o que carrega URL de TERCEIRO. Neste repo esses campos
        // se chamam `url` (article.url, it.url, article_snapshot.url). Rotas
        // internas (`prepareHref`, `link.href`, `/reports/...`) não entram.
        if (!/\burl\b/i.test(match)) continue
        offenders.push(`${path}: ${match.slice(0, 80)}`)
      }
    }
    expect(offenders, 'passe URL de terceiro por safeExternalUrl de @/lib/url').toEqual([])
  })

  it('toda tabela criada tem ENABLE ROW LEVEL SECURITY em alguma migration', () => {
    // Dez tabelas ficaram sem RLS por terem sido criadas antes da convenção.
    // Com a chave anon no bundle, isso é leitura e escrita direta no PostgREST.
    const dir = join(ROOT, 'supabase', 'migrations')
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n')
    const created = new Set<string>()
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
      created.add(m[1].toLowerCase())
    }
    const guarded = new Set<string>()
    for (const m of sql.matchAll(/ALTER TABLE (?:public\.)?([a-z_][a-z0-9_]*)\s+ENABLE ROW LEVEL SECURITY/gi)) {
      guarded.add(m[1].toLowerCase())
    }
    const missing = [...created].filter((t) => !guarded.has(t)).sort()
    expect(missing, 'adicione ENABLE ROW LEVEL SECURITY na mesma migration que cria a tabela').toEqual([])
  })

  it('descompressão sempre declara um teto de saída', () => {
    // O tamanho descomprimido no cabeçalho do ZIP é declarado por quem monta o
    // arquivo. O teto precisa ir para o zlib, não sair de um número do atacante.
    const offenders: string[] = []
    for (const { path, text } of sourceFiles.map(read)) {
      for (const match of text.match(/(?:inflateRawSync|inflateSync|gunzipSync)\([^)]*\)/g) || []) {
        if (!match.includes('maxOutputLength')) offenders.push(`${path}: ${match.slice(0, 70)}`)
      }
    }
    expect(offenders, 'passe { maxOutputLength } — o size do cabeçalho ZIP não é confiável').toEqual([])
  })

  it('nao grava image_url sem passar por isGenericImage', () => {
    // O backfill gravava o logo do Google News como foto de todo artigo vindo
    // de la e, como filtra `.is('image_url', null)`, o artigo ficava excluido
    // de nova tentativa PARA SEMPRE. A escolha tem de passar por
    // pickImageCandidate/isGenericImage, ou trazer justificativa explicita.
    const offenders: string[] = []
    for (const { path, text } of sourceFiles.map(read)) {
      if (path.endsWith('article-image.ts')) continue
      const lines = text.split('\n')
      lines.forEach((line, index) => {
        const m = line.match(/image_url:\s*(.+?),?\s*$/)
        if (!m) return
        const valor = m[1].trim()
        // `null` explicito e copia de um valor ja existente sao seguros; o que
        // importa e a escrita de um valor BUSCADO agora.
        // Copia de um valor ja existente (com ou sem fallback para null).
        if (valor === 'null' || /^[\w.?[\]']+\.image_url(\s*\|\|\s*null)?$/.test(valor)) return
        if (/^string \| null$/.test(valor)) return // declaracao de tipo
        const janela = lines.slice(Math.max(0, index - 4), index + 1).join('\n')
        if (
          janela.includes('pickImageCandidate') ||
          janela.includes('isGenericImage') ||
          janela.includes('generic-image-ok')
        ) {
          return
        }
        if (text.includes('pickImageCandidate') || text.includes('isGenericImage')) return
        offenders.push(`${path}:${index + 1}: ${valor.slice(0, 60)}`)
      })
    }
    expect(
      offenders,
      'use pickImageCandidate de @/lib/fetcher/article-image, ou justifique com // generic-image-ok:'
    ).toEqual([])
  })

  it('o caminho de imagem nunca busca um link news.google.com direto', () => {
    // O link do Google News redireciona para si mesmo; buscá-lo direto devolve
    // a pagina do Google, cujo og:image e o mesmo logo para todos os artigos.
    // Quem chama fetchOgImage tem de resolver a URL real antes.
    const offenders: string[] = []
    for (const { path, text } of sourceFiles.map(read)) {
      if (!text.includes('fetchOgImage')) continue
      if (path.endsWith('rss.ts')) continue // a definicao resolve internamente
      const resolve = text.includes('resolved_url') || text.includes('resolveGoogleNewsUrl')
      if (!resolve) offenders.push(path)
    }
    expect(offenders, 'resolva a URL real antes de buscar imagem de link do Google News').toEqual([])
  })

  it('a migration 034 nao tem guard de pre-condicao que a impeca de rodar', () => {
    // A 034 abortava com RAISE EXCEPTION quando o cliente ANTAQ nao existia,
    // exigindo um passo manual na UI antes do SQL. Ela agora cria o cliente
    // sozinha (Bloco A2) e verifica o resultado no FIM (pos-condicao).
    // Este invariante fixa a decisao: nenhum RAISE antes do primeiro INSERT.
    const sql = readFileSync(join(ROOT, 'supabase', 'migrations', '034_antaq_client_relevance.sql'), 'utf8')
    // Tira os comentarios antes de casar: o cabecalho EXPLICA o guard antigo e
    // cita RAISE EXCEPTION, e isso nao pode fazer o teste falhar.
    const codigo = sql.replace(/^\s*--.*$/gm, '')
    const primeiroInsert = codigo.indexOf('INSERT INTO')
    const raiseAntes = codigo.slice(0, primeiroInsert).includes('RAISE EXCEPTION')
    expect(raiseAntes, 'a 034 voltou a ter guard de pre-condicao; ela deve criar o cliente, nao abortar').toBe(false)
    // E a pos-condicao tem de continuar existindo — ela impede o no-op silencioso.
    expect(sql).toMatch(/RAISE EXCEPTION '034:/)
  })

  it('não devolve a matriz de curadoria ao relatório do cliente', () => {
    // buildThematicMatrix escreve rótulos de PROCESSO ("Cobertura confirmada",
    // "Lacuna reconhecida") numa coluna chamada "Sinal do mês" — exatamente o
    // que a seção 2 do prompt proíbe. É auditoria interna: vive no dossiê.
    for (const rota of ['finalize', 'export']) {
      const { text } = read(join(ROOT, 'src', 'app', 'api', 'report-drafts', '[id]', rota, 'route.ts'))
      expect(text, `${rota} voltou a anexar a matriz temática ao entregável`).not.toContain('buildThematicMatrix')
    }
    const { text: dossie } = read(join(ROOT, 'src', 'lib', 'report-drafts.ts'))
    expect(dossie, 'a matriz temática precisa continuar no dossiê interno').toContain('buildThematicMatrix(topics, items)')
  })

  it('não confia em segredo ausente como autorização', () => {
    // internalAuthorized devolvia true quando CRON_SECRET não estava definido e
    // NODE_ENV !== 'production' — aberto em dev E em teste.
    const { text } = read(join(ROOT, 'src', 'lib', 'internal-auth.ts'))
    // Tira comentários antes de casar: o comentário que EXPLICA o bug antigo
    // cita o padrão, e não deve fazer o teste falhar.
    const codigo = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(codigo).not.toMatch(/NODE_ENV !== 'production'/)
    expect(text, 'use bearerMatches, que nega quando não há segredo').toContain('bearerMatches')
  })
})
