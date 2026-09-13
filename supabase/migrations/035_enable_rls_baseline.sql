-- 035: fecha a base para as chaves públicas (anon / authenticated).
--
-- CONTEXTO
-- Trinta e quatro das 44 tabelas já recebem ENABLE ROW LEVEL SECURITY nas
-- migrations 025-031. Estas dez foram criadas antes daquela convenção e nunca
-- tiveram RLS. Esta migration termina o padrão; não inventa um novo.
--
-- POR QUE ISSO IMPORTA
-- NEXT_PUBLIC_SUPABASE_ANON_KEY é compilada no bundle do navegador — é pública
-- por definição. Sob os grants padrão do Supabase, uma tabela sem RLS é
-- legível E gravável pelo papel `anon` direto no PostgREST
-- (https://<ref>.supabase.co/rest/v1/<tabela>), sem passar pelo app.
--
-- A prova de que os grants estavam abertos veio do próprio código, sem precisar
-- do banco: src/app/reports/[id]/page.tsx usava o cliente ANON para ler
-- `reports` com join em `clients`, e a página funcionava em produção.
--
-- ORDEM OBRIGATÓRIA
-- A correção daquela página (para createAdminClient) tem de estar EM PRODUÇÃO
-- antes desta migration rodar. Invertido, a página passa a devolver notFound().
--
-- POR QUE ZERO POLICIES É O ESTADO CORRETO
-- O app é service-role-only: as 76 rotas usam createAdminClient(), e o papel
-- `service_role` tem o atributo BYPASSRLS — não sente nada disto. RLS ligado
-- sem policy nenhuma significa negar tudo para anon/authenticated, que é
-- exatamente o desejado. O linter do Supabase vai reportar
-- `rls_enabled_no_policy` em nível INFO nestas tabelas: é o estado pretendido.
-- NÃO "conserte" isso criando uma policy permissiva para anon.
--
-- O QUE NÃO QUEBRA
-- src/components/imports/ImportsPage.tsx usa a chave anon no navegador, mas
-- somente para storage.from('source-documents').uploadToSignedUrl(). Isso vai
-- para a API de Storage e é autorizado pelo token assinado emitido no servidor,
-- não por grant de tabela. RLS na TABELA source_documents não o afeta.
--
-- VERIFICAÇÃO (rode antes e depois; o "depois" deve mostrar rls_on = true):
--   SELECT c.relname, c.relrowsecurity AS rls_on,
--          (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies,
--          COALESCE((SELECT string_agg(DISTINCT g.grantee||':'||g.privilege_type, ', ')
--                    FROM information_schema.role_table_grants g
--                    WHERE g.table_schema='public' AND g.table_name=c.relname
--                      AND g.grantee IN ('anon','authenticated')), '(nenhum)') AS grants_publicos
--   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--   WHERE n.nspname='public' AND c.relkind='r'
--   ORDER BY c.relrowsecurity, c.relname;
--
-- E o teste empírico, que é o que realmente conta — de fora, com a chave anon:
--   curl "https://<ref>.supabase.co/rest/v1/clients?select=id,name&limit=1" \
--        -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>"
-- Antes: 200 com dados. Depois: 200 com [] (ou 401/403). Se um POST responder
-- 201 ANTES desta migration, o achado sobe de alto para crítico — significa que
-- dava para injetar uma linha em `sources` que o cron depois buscaria.
--
-- DEPOIS DE APLICAR: rotacione a chave anon. Ela esteve pública no bundle.
--
-- Idempotente.

ALTER TABLE sources              ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_client_tags  ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_sources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_provenance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_editions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_edition_items ENABLE ROW LEVEL SECURITY;

-- Defesa em profundidade: mesmo que alguém desligue o RLS de uma tabela pelo
-- painel, sem GRANT o papel anon continua sem conseguir ler.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- E o que impede a tabela 45 de repetir o problema: por padrão, tabela nova
-- criada por este papel não nasce mais com grant para anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
