-- 051: volume e grandes veículos por cliente; perfil de relatório por cliente.
-- Reclamação de outubro: SINDINFOR, PRIO e CCEE com poucas matérias e muito
-- portal desconhecido; uma matéria da CNN ficou de fora. Os feeds gerais dos
-- grandes veículos publicam centenas de matérias por dia e o RSS só devolve as
-- últimas dezenas, então a matéria do cliente some antes da coleta. Uma busca
-- por cliente restrita aos grandes veículos (site:) chega nela direto.

INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode) VALUES
  ('Google News — PRIO nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)', 'https://news.google.com/rss/search?q=(site%3Aoglobo.globo.com%20OR%20site%3Avalor.globo.com%20OR%20site%3Aestadao.com.br%20OR%20site%3Acnnbrasil.com.br%20OR%20site%3Aeixos.com.br)%20(PRIO%20OR%20%22Petro%20Rio%22%20OR%20%22PRIO%20S.A.%22%20OR%20%22Roberto%20Monteiro%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — PRIO nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)', 'https://news.google.com/rss/search?q=(site%3Afolha.uol.com.br%20OR%20site%3Ag1.globo.com%20OR%20site%3Apoder360.com.br%20OR%20site%3Ainfomoney.com.br%20OR%20site%3Ametropoles.com)%20(PRIO%20OR%20%22Petro%20Rio%22%20OR%20%22PRIO%20S.A.%22%20OR%20%22Roberto%20Monteiro%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — CCEE nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)', 'https://news.google.com/rss/search?q=(site%3Aoglobo.globo.com%20OR%20site%3Avalor.globo.com%20OR%20site%3Aestadao.com.br%20OR%20site%3Acnnbrasil.com.br%20OR%20site%3Aeixos.com.br)%20(CCEE%20OR%20%22C%C3%A2mara%20de%20Comercializa%C3%A7%C3%A3o%20de%20Energia%22%20OR%20%22mercado%20livre%20de%20energia%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — CCEE nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)', 'https://news.google.com/rss/search?q=(site%3Afolha.uol.com.br%20OR%20site%3Ag1.globo.com%20OR%20site%3Apoder360.com.br%20OR%20site%3Ainfomoney.com.br%20OR%20site%3Ametropoles.com)%20(CCEE%20OR%20%22C%C3%A2mara%20de%20Comercializa%C3%A7%C3%A3o%20de%20Energia%22%20OR%20%22mercado%20livre%20de%20energia%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — SINDINFOR nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)', 'https://news.google.com/rss/search?q=(site%3Aoglobo.globo.com%20OR%20site%3Avalor.globo.com%20OR%20site%3Aestadao.com.br%20OR%20site%3Acnnbrasil.com.br%20OR%20site%3Aeixos.com.br)%20(Sindinfor%20OR%20Redata%20OR%20%22data%20center%22%20OR%20%22data%20centers%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — SINDINFOR nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)', 'https://news.google.com/rss/search?q=(site%3Afolha.uol.com.br%20OR%20site%3Ag1.globo.com%20OR%20site%3Apoder360.com.br%20OR%20site%3Ainfomoney.com.br%20OR%20site%3Ametropoles.com)%20(Sindinfor%20OR%20Redata%20OR%20%22data%20center%22%20OR%20%22data%20centers%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — SIMINERAL nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)', 'https://news.google.com/rss/search?q=(site%3Aoglobo.globo.com%20OR%20site%3Avalor.globo.com%20OR%20site%3Aestadao.com.br%20OR%20site%3Acnnbrasil.com.br%20OR%20site%3Aeixos.com.br)%20(Simineral%20OR%20%22minera%C3%A7%C3%A3o%20no%20Par%C3%A1%22%20OR%20Caraj%C3%A1s%20OR%20%22minera%C3%A7%C3%A3o%20paraense%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — SIMINERAL nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)', 'https://news.google.com/rss/search?q=(site%3Afolha.uol.com.br%20OR%20site%3Ag1.globo.com%20OR%20site%3Apoder360.com.br%20OR%20site%3Ainfomoney.com.br%20OR%20site%3Ametropoles.com)%20(Simineral%20OR%20%22minera%C3%A7%C3%A3o%20no%20Par%C3%A1%22%20OR%20Caraj%C3%A1s%20OR%20%22minera%C3%A7%C3%A3o%20paraense%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — DAQ nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)', 'https://news.google.com/rss/search?q=(site%3Aoglobo.globo.com%20OR%20site%3Avalor.globo.com%20OR%20site%3Aestadao.com.br%20OR%20site%3Acnnbrasil.com.br%20OR%20site%3Aeixos.com.br)%20(DNIT%20hidrovia%20OR%20dragagem%20OR%20hidrovias%20OR%20%22transporte%20aquavi%C3%A1rio%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — DAQ nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)', 'https://news.google.com/rss/search?q=(site%3Afolha.uol.com.br%20OR%20site%3Ag1.globo.com%20OR%20site%3Apoder360.com.br%20OR%20site%3Ainfomoney.com.br%20OR%20site%3Ametropoles.com)%20(DNIT%20hidrovia%20OR%20dragagem%20OR%20hidrovias%20OR%20%22transporte%20aquavi%C3%A1rio%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — ONS nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)', 'https://news.google.com/rss/search?q=(site%3Aoglobo.globo.com%20OR%20site%3Avalor.globo.com%20OR%20site%3Aestadao.com.br%20OR%20site%3Acnnbrasil.com.br%20OR%20site%3Aeixos.com.br)%20(ONS%20OR%20%22Operador%20Nacional%20do%20Sistema%22%20OR%20apag%C3%A3o%20OR%20%22setor%20el%C3%A9trico%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — ONS nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)', 'https://news.google.com/rss/search?q=(site%3Afolha.uol.com.br%20OR%20site%3Ag1.globo.com%20OR%20site%3Apoder360.com.br%20OR%20site%3Ainfomoney.com.br%20OR%20site%3Ametropoles.com)%20(ONS%20OR%20%22Operador%20Nacional%20do%20Sistema%22%20OR%20apag%C3%A3o%20OR%20%22setor%20el%C3%A9trico%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — ANTAQ nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)', 'https://news.google.com/rss/search?q=(site%3Aoglobo.globo.com%20OR%20site%3Avalor.globo.com%20OR%20site%3Aestadao.com.br%20OR%20site%3Acnnbrasil.com.br%20OR%20site%3Aeixos.com.br)%20(ANTAQ%20OR%20%22Ag%C3%AAncia%20Nacional%20de%20Transportes%20Aquavi%C3%A1rios%22%20OR%20%22setor%20portu%C3%A1rio%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Google News — ANTAQ nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)', 'https://news.google.com/rss/search?q=(site%3Afolha.uol.com.br%20OR%20site%3Ag1.globo.com%20OR%20site%3Apoder360.com.br%20OR%20site%3Ainfomoney.com.br%20OR%20site%3Ametropoles.com)%20(ANTAQ%20OR%20%22Ag%C3%AAncia%20Nacional%20de%20Transportes%20Aquavi%C3%A1rios%22%20OR%20%22setor%20portu%C3%A1rio%22)%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 85, 'imprensa', 'referencia')
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, active = TRUE, priority = EXCLUDED.priority;

-- Fonte do cliente: soma +1 como fonte temática (mesmo mecanismo da 049).
INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT client.id, source.id, 90, TRUE
FROM (VALUES
  ('PRIO', 'Google News — PRIO nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)'),
  ('PRIO', 'Google News — PRIO nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)'),
  ('CCEE', 'Google News — CCEE nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)'),
  ('CCEE', 'Google News — CCEE nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)'),
  ('SINDINFOR', 'Google News — SINDINFOR nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)'),
  ('SINDINFOR', 'Google News — SINDINFOR nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)'),
  ('SIMINERAL', 'Google News — SIMINERAL nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)'),
  ('SIMINERAL', 'Google News — SIMINERAL nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)'),
  ('DAQ%', 'Google News — DAQ nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)'),
  ('DAQ%', 'Google News — DAQ nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)'),
  ('ONS', 'Google News — ONS nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)'),
  ('ONS', 'Google News — ONS nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)'),
  ('ANTAQ', 'Google News — ANTAQ nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos)'),
  ('ANTAQ', 'Google News — ANTAQ nos grandes veículos (Folha, G1, Poder360, InfoMoney, Metrópoles)')
) AS link(client_match, source_name)
JOIN clients client ON client.name LIKE link.client_match
JOIN sources source ON source.name = link.source_name
ON CONFLICT (client_id, source_id) DO UPDATE SET is_thematic = TRUE, priority = EXCLUDED.priority;

-- Particularidades de cada cliente, copiadas de docs/referencia-relatorios/modelo/README.md.
-- min_items = 20: pedido do cliente (boletim SINDINFOR tem 20; relatório tinha 9).
CREATE TABLE IF NOT EXISTS client_report_profiles (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  display_name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'relatorio',
  location TEXT,
  max_pages INTEGER NOT NULL DEFAULT 20,
  min_items INTEGER NOT NULL DEFAULT 20,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE client_report_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_report_profiles_format_check') THEN
    ALTER TABLE client_report_profiles
      ADD CONSTRAINT client_report_profiles_format_check CHECK (format IN ('relatorio', 'boletim'));
  END IF;
END $$;

INSERT INTO client_report_profiles (client_id, brand, display_name, format, location, notes)
SELECT client.id, seed.brand, seed.display_name, seed.format, seed.location, seed.notes
FROM (VALUES
  ('ONS', 'CRT', 'ONS', 'relatorio', NULL, 'Tabela de atividades com números informados mês a mês; links e porta-voz nas evidências.'),
  ('CCEE', 'SAUZ', 'CCEE', 'relatorio', NULL, 'Sem dados de atendimento/reuniões. CCEE liquida, ONS despacha, ANEEL regula, MME faz política.'),
  ('PRIO', 'VX', 'PRIO S.A.', 'relatorio', NULL, 'Nunca PetroRecôncavo. Sem dados de atendimento. Foco em campos maduros offshore.'),
  ('SINDINFOR', 'SAUZ', 'SindInfor', 'boletim', 'Brasília/DF', 'Boletim de notícias, sem estratégia/recomendações. Versões Empresa e Associados.'),
  ('SIMINERAL', 'SAUZ', 'SIMINERAL', 'relatorio', NULL, 'Visão geral com inserções sobre a SIMINERAL; nunca expor baixo volume de menções.'),
  ('DAQ%', 'SAUZ', 'DAQ/DNIT', 'relatorio', NULL, 'DNIT/DAQ executa; MPor concede; ANTAQ regula. Não criticar o DNIT.'),
  ('ANTAQ', 'CORTEX', 'ANTAQ', 'relatorio', NULL, NULL)
) AS seed(client_match, brand, display_name, format, location, notes)
JOIN clients client ON client.name LIKE seed.client_match
ON CONFLICT (client_id) DO UPDATE SET
  brand = EXCLUDED.brand, display_name = EXCLUDED.display_name, format = EXCLUDED.format,
  location = EXCLUDED.location, notes = EXCLUDED.notes, updated_at = NOW();

-- Teto de gasto da Anthropic: cada chamada registra tokens e custo estimado.
CREATE TABLE IF NOT EXISTS ai_usage_ledger (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 5) NOT NULL DEFAULT 0
);
ALTER TABLE ai_usage_ledger ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ai_usage_ledger_created_at_idx ON ai_usage_ledger (created_at);

-- Relatório sob demanda: data de corte (exclusiva) dentro do mês. NULL = mês inteiro.
ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS period_cutoff TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
