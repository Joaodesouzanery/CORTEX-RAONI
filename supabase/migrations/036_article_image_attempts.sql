-- 036: conserta as imagens dos artigos vindos do Google News e do gov.br.
--
-- O DEFEITO
-- O link do Google News redireciona para SI MESMO — o salto real para o veículo
-- é feito por JavaScript, que o `fetch` não executa. A página de chegada tem
-- og:image, e é O MESMO logo do Google para TODOS os artigos
-- (https://lh3.googleusercontent.com/J6_coFbog...). O backfill gravava esse
-- logo em `articles.image_url` e, como ele seleciona `.is('image_url', null)`,
-- o artigo passava a ser PERMANENTEMENTE excluído de nova tentativa.
--
-- Em páginas gov.br o problema é outro: o og:image é o BRASÃO da agência, e
-- como a escolha era "primeiro candidato vence", a foto do corpo da matéria
-- nunca era alcançada.
--
-- Idempotente.

-- Marcador de tentativa, no mesmo padrão de `enrichment_attempts` (023).
-- Sem ele, um link que nunca resolve consome uma vaga do lote em toda execução,
-- para sempre, bloqueando os artigos mais antigos que nunca chegam a ser vistos.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_attempted_at TIMESTAMPTZ;

-- A URL real do veículo, depois de resolvido o token do Google News. Paga-se
-- sozinha: a ida ao endpoint `batchexecute` é feita UMA vez e reaproveitada
-- pelo caminho de imagem, pelo de texto (fetchArticleText) e pelas citações.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS resolved_url TEXT;

-- Índice parcial para a fila do backfill (só o que ainda não tem imagem).
CREATE INDEX IF NOT EXISTS articles_image_backfill_idx
  ON articles (published_at DESC) WHERE image_url IS NULL;

-- --------------------------------------------------------------------------
-- LIMPEZA das linhas já envenenadas
-- Rode o SELECT equivalente antes se quiser conferir o alcance:
--   SELECT count(*) FROM articles WHERE image_url LIKE 'https://lh3.googleusercontent.com/%';
-- --------------------------------------------------------------------------

-- 1. O logo genérico conhecido do Google News.
-- (lh3.googleusercontent.com também hospeda imagem de Blogger, mas nenhuma
-- fonte semeada é feed de Blogger — se isso mudar, estreite a condição.)
UPDATE articles
SET image_url = NULL, image_attempts = 0, image_attempted_at = NULL
WHERE image_url LIKE 'https://lh3.googleusercontent.com/%';

-- 2. Regra geral: uma imagem compartilhada por 5 ou mais artigos é, por
-- definição, genérica — logo de veículo, imagem padrão de compartilhamento,
-- brasão. Varre também os casos que não enumeramos.
-- O limiar 5 é conservador para um corpus de um mês; ajuste se necessário.
UPDATE articles
SET image_url = NULL, image_attempts = 0, image_attempted_at = NULL
WHERE image_url IN (
  SELECT image_url FROM articles
  WHERE image_url IS NOT NULL
  GROUP BY image_url
  HAVING count(*) >= 5
);
