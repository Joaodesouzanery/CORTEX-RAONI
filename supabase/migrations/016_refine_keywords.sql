-- 016: refina as keywords por cliente para PRECISÃO (QA data-driven sobre os
-- dados reais). Remove termos genéricos que geravam falsos-positivos claros —
-- validado por amostragem:
--   ONS: "transmissão" casava transmissão de jogo na TV; "carga" casava carga
--        ferroviária/tributária; "geração" casava "nova geração"/empregos.
--   SindInfor: "Minas Gerais" casava qualquer notícia do estado (inclusive crime).
--   DNIT Aquaviária: "portos" casava até matéria de agressão.
--   DNIT Rodoviária: "rodovias" casava acidentes de trânsito.
--   Gás Natural: "comercialização" casava "reação alérgica à vacina";
--                "escoamento" casava dragagem/navegação.
--   Mineração: "minerais" bare (redundante com "minerais críticos"/"mineração").
-- Os synonyms (migration 014) permanecem — já são específicos e cobrem os casos
-- legítimos (ex.: "linha de transmissão", "usina eólica", "escoamento de gás",
-- "mercado de gás"). Idempotente. CCEE fica como está (já preciso).

UPDATE clients SET keywords =
  ARRAY['ONS','setor elétrico','energia elétrica','operação do sistema']
  WHERE name = 'ONS';

UPDATE clients SET keywords =
  ARRAY['gás natural','geração térmica','termelétrica']
  WHERE name = 'Gás Natural';

UPDATE clients SET keywords =
  ARRAY['mineração','minerais críticos','terras raras']
  WHERE name = 'Mineração';

UPDATE clients SET keywords =
  ARRAY['DNIT','hidrovia','hidrovias','pequenos portos','transporte fluvial','dragagem','navegação interior']
  WHERE name = 'DNIT Aquaviária';

UPDATE clients SET keywords =
  ARRAY['DNIT','pontes','viadutos','túneis','obras de arte especiais']
  WHERE name = 'DNIT Rodoviária';

UPDATE clients SET keywords =
  ARRAY['SindInfor','software','tecnologia da informação','indústria de software']
  WHERE name = 'SindInfor';
