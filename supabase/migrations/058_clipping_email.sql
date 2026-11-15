-- 058: clipping diário por e-mail (Fase 20, etapa 5).
--
-- Duas tabelas, as duas só para o service role (RLS ligada, ZERO policies —
-- padrão do repo desde a 035):
--
-- client_email_recipients: quem recebe o clipping de cada cliente.
--   É dado pessoal (nome e e-mail de pessoa do cliente). Finalidade: entregar o
--   clipping contratado; base legal: execução do contrato. Sem tela e sem rota
--   pública que liste: entra e sai por SQL, como as regras de cliente.
--   Descadastro = active = FALSE (o e-mail diz "responda para descadastrar").
--   Pedido de eliminação = DELETE da linha. Encerrado o contrato, apague as
--   linhas do cliente: o acervo permanente vale para notícia, não para contato.
--
-- clipping_email_sends: registro de cada envio, para re-run ser no-op.
--   Chave (client_id, day, mode): rodar o workflow duas vezes no mesmo dia não
--   manda dois e-mails. Guarda quantos destinatários, NUNCA os e-mails.
--
-- Idempotente: pode colar mais de uma vez.

CREATE TABLE IF NOT EXISTS client_email_recipients (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE client_email_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_email_recipients_unique') THEN
    ALTER TABLE client_email_recipients ADD CONSTRAINT client_email_recipients_unique UNIQUE (client_id, email);
  END IF;
  -- Formato mínimo; a entrega real é confirmada pelo provedor.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_email_recipients_email_check') THEN
    ALTER TABLE client_email_recipients ADD CONSTRAINT client_email_recipients_email_check CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS clipping_email_sends (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviando',
  recipients_count INTEGER NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  provider_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE clipping_email_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clipping_email_sends_unique') THEN
    ALTER TABLE clipping_email_sends ADD CONSTRAINT clipping_email_sends_unique UNIQUE (client_id, day, mode);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clipping_email_sends_mode_check') THEN
    ALTER TABLE clipping_email_sends ADD CONSTRAINT clipping_email_sends_mode_check CHECK (mode IN ('review', 'send'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clipping_email_sends_status_check') THEN
    ALTER TABLE clipping_email_sends ADD CONSTRAINT clipping_email_sends_status_check CHECK (status IN ('enviando', 'enviado', 'erro'));
  END IF;
END $$;

REVOKE ALL ON client_email_recipients, clipping_email_sends FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_email_recipients, clipping_email_sends TO service_role;
GRANT USAGE, SELECT ON SEQUENCE client_email_recipients_id_seq, clipping_email_sends_id_seq TO service_role;

-- Cadastrar destinatário (troque os valores; repita por pessoa):
-- INSERT INTO client_email_recipients (client_id, email, name)
-- SELECT id, 'pessoa@cliente.com.br', 'Nome da Pessoa' FROM clients WHERE name = 'ONS'
-- ON CONFLICT (client_id, email) DO UPDATE SET active = TRUE, name = EXCLUDED.name, updated_at = NOW();
--
-- Descadastrar:  UPDATE client_email_recipients SET active = FALSE, updated_at = NOW() WHERE email = 'pessoa@cliente.com.br';
-- Eliminar:      DELETE FROM client_email_recipients WHERE email = 'pessoa@cliente.com.br';

NOTIFY pgrst, 'reload schema';
