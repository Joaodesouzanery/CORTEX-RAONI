-- 005: seed the initial 7 clients with sector, contracting party, context,
-- report direction, and starter keywords. Idempotent via ON CONFLICT (name).
-- TEXT of context/report_prompt are starting drafts — refine in the UI.
-- Depends on migrations 003 (clients) and 004 (report_prompt/sector/contratante).

-- The ON CONFLICT (name) below needs a UNIQUE constraint on clients.name. If the
-- table was created manually without it, add it now (idempotent). Fails loudly
-- only if duplicate names already exist — dedupe them first in that case.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'clients'::regclass AND contype = 'u' AND conname = 'clients_name_key'
  ) THEN
    ALTER TABLE clients ADD CONSTRAINT clients_name_key UNIQUE (name);
  END IF;
END $$;

INSERT INTO clients (name, sector, contratante, context, report_prompt, keywords) VALUES
(
  'ONS',
  'Setor elétrico',
  'CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA',
  'Operador Nacional do Sistema Elétrico — coordena a operação da geração e transmissão no Sistema Interligado Nacional. Alta sensibilidade reputacional sobre confiabilidade, transparência e segurança do suprimento.',
  'Priorize segurança energética, operação do SIN, transição energética e modernização do setor elétrico. Trate riscos de apagão e transparência decisória como temas-âncora.',
  ARRAY['ONS','setor elétrico','energia elétrica','transmissão','geração','carga','operação do sistema']
),
(
  'DNIT Aquaviária',
  'Transporte aquaviário e hidrovias',
  'CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA',
  'Diretoria de Infraestrutura Aquaviária do DNIT — hidrovias, portos fluviais, navegação interior e dragagem.',
  'Foque em hidrovias, dragagem, pequenos portos e transporte fluvial; trate segurança da navegação e investimento em infraestrutura aquaviária como temas-âncora.',
  ARRAY['DNIT','hidrovia','hidrovias','portos','pequenos portos','transporte fluvial','dragagem','navegação interior']
),
(
  'DNIT Rodoviária',
  'Infraestrutura rodoviária',
  'CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA',
  'Diretoria de Infraestrutura Rodoviária do DNIT — rodovias federais e obras de arte especiais (pontes, viadutos, túneis).',
  'Foque em obras de arte especiais (pontes, viadutos, túneis), conservação e segurança de rodovias federais; trate acidentes estruturais e investimento em manutenção como temas-âncora.',
  ARRAY['DNIT','pontes','viadutos','túneis','obras de arte especiais','rodovias']
),
(
  'CCEE',
  'Comercialização de energia elétrica',
  'CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA',
  'Câmara de Comercialização de Energia Elétrica — mercado de energia, leilões e liquidação financeira.',
  'Foque em comercialização e mercado de energia, leilões, preço de liquidação (PLD) e abertura de mercado; trate liquidez e regras de mercado como temas-âncora.',
  ARRAY['CCEE','comercialização de energia','mercado de energia','leilão de energia','preço de liquidação']
),
(
  'SindInfor',
  'Indústria de software (Minas Gerais)',
  'CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA',
  'Sindicato das Indústrias de Software de Minas Gerais — representação do setor de tecnologia da informação mineiro.',
  'Foque em indústria de software, tecnologia da informação, inovação e políticas setoriais em Minas Gerais; trate tributação e capital humano em TI como temas-âncora.',
  ARRAY['SindInfor','software','tecnologia da informação','indústria de software','Minas Gerais']
),
(
  'Gás Natural',
  'Gás natural e geração térmica',
  'CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA',
  'Segmento de gás natural — geração térmica, comercialização e escoamento da produção.',
  'Foque em gás natural, geração térmica e termelétricas, comercialização e escoamento; trate o papel do gás na matriz e infraestrutura de transporte como temas-âncora.',
  ARRAY['gás natural','geração térmica','termelétrica','comercialização','escoamento']
),
(
  'Mineração',
  'Mineração e minerais críticos',
  'CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA',
  'Segmento de mineração — minerais, minerais críticos e terras raras.',
  'Foque em mineração, minerais críticos e terras raras; trate licenciamento, sustentabilidade e cadeia de suprimentos estratégicos como temas-âncora.',
  ARRAY['mineração','minerais','minerais críticos','terras raras']
)
ON CONFLICT (name) DO UPDATE SET
  sector        = EXCLUDED.sector,
  contratante   = EXCLUDED.contratante,
  context       = EXCLUDED.context,
  report_prompt = EXCLUDED.report_prompt,
  keywords      = EXCLUDED.keywords;
