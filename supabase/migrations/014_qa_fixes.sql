-- 014: QA do pipeline de notícias.
-- (1) Desativa feeds mortos/quase-vazios encontrados no QA (HTTP 200, mas ~0 itens).
-- (2) Popula os `synonyms` por cliente para ampliar a separação por setor sem
--     afrouxar os feeds temáticos (que continuam restritos e precisos).
-- Idempotente. Depende da 008 (clients.synonyms) e do seed de sources.

-- (1) Feeds mortos ------------------------------------------------------------
UPDATE sources SET active = false WHERE name IN (
  'Folha de S.Paulo',  -- feed retorna 0 itens (paywall/bloqueio)
  'Brasil Energia',    -- query Google News site: retorna 0 itens
  'MegaWhat'           -- query Google News site: ~3 itens; energia já coberta por
                       -- feeds temáticos + Eixos/Canal Energia/Petronotícias
);

-- (2) Synonyms por cliente ----------------------------------------------------
-- Lista separada por vírgula; expandTerms() une com as keywords (match por OR).
-- Termos escolhidos por precisão (evitam palavras ambíguas isoladas) para captar
-- o subconjunto relevante dos feeds diretos (Agência Infra, Eixos, G1/Estadão…)
-- sem gerar ruído.

UPDATE clients SET synonyms =
  'apagão, blecaute, blackout, Sistema Interligado Nacional, despacho, curtailment, ANEEL, EPE, confiabilidade do sistema, linha de transmissão, hidrelétrica, usina eólica, usina solar, reservatórios, operador nacional, segurança energética'
  WHERE name = 'ONS';

UPDATE clients SET synonyms =
  'Câmara de Comercialização, PLD, preço de liquidação das diferenças, mercado livre de energia, ambiente de contratação livre, leilão de energia, liquidação financeira, migração de mercado, consumidor livre, contratos de energia'
  WHERE name = 'CCEE';

UPDATE clients SET synonyms =
  'gasoduto, GNL, gás liquefeito, termelétrica a gás, Nova Lei do Gás, escoamento de gás, oferta de gás, mercado de gás, importação de gás, molécula de gás'
  WHERE name = 'Gás Natural';

UPDATE clients SET synonyms =
  'ANM, Agência Nacional de Mineração, lavra, barragem de rejeitos, royalties da mineração, CFEM, terras raras, lítio, minério de ferro, mineradora, licenciamento mineral'
  WHERE name = 'Mineração';

UPDATE clients SET synonyms =
  'dragagem, desassoreamento, hidrovia, eclusa, navegação interior, transporte aquaviário, porto fluvial, canal de navegação, sinalização náutica, Antaq'
  WHERE name = 'DNIT Aquaviária';

UPDATE clients SET synonyms =
  'rodovia federal, obra de arte especial, ponte, viaduto, túnel, pavimentação, duplicação de rodovia, concessão rodoviária, recuperação de pavimento, manutenção de rodovias'
  WHERE name = 'DNIT Rodoviária';

UPDATE clients SET synonyms =
  'indústria de software, tecnologia da informação, transformação digital, economia digital, Lei do Bem, incentivo fiscal a software, polo tecnológico, startups de tecnologia, Assespro'
  WHERE name = 'SindInfor';
