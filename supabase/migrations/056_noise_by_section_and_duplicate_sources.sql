-- 056: ruído por seção do link e fontes duplicadas de novo ativas.
--
-- 1) "novela" sai das exclusões das regras de setor (posta pela 050).
--    A exclusão era testada no texto inteiro e derrubava matéria de setor
--    escrita com a gíria da imprensa: "a novela do leilão", "a novela da
--    privatização". Esporte, novela de TV e celebridade agora saem pela
--    SEÇÃO do link e por título de rodada (src/lib/noise.ts), aplicada só a
--    regras de setor. Os demais termos da 050 (Brasileirão, Libertadores,
--    BBB, horóscopo...) ficam: não têm segundo sentido em pauta econômica.
--
-- 2) A 053 e a 054 reativaram InfoMoney e MegaWhat que a 042 tinha desligado
--    como cópia de outra URL do mesmo veículo. A matéria não duplica (dedupe
--    por URL), mas cada cópia é uma fonte a mais no lote do botão "Buscar
--    Notícias" (4 por lote, 45 s), que é onde a coleta manual quebrava.
--    Mantém a URL que a 042 escolheu e que recebeu os vínculos de cliente; só
--    desliga a cópia se a mantida estiver ativa, para o veículo nunca sumir.
--
-- Idempotente: pode colar mais de uma vez.

UPDATE client_relevance_rules
SET excluded_terms = array_remove(excluded_terms, 'novela'),
    updated_at = NOW()
WHERE match_type <> 'direta'
  AND 'novela' = ANY(excluded_terms);

UPDATE sources old
SET active = FALSE
FROM (VALUES
  ('https://www.infomoney.com.br/feed/', 'https://www.infomoney.com.br/feed'),
  ('https://megawhat.energy/feed/', 'https://megawhat.uol.com.br/feed')
) AS pair(old_url, keep_url)
JOIN sources keep ON keep.url = pair.keep_url AND keep.active = TRUE
WHERE old.url = pair.old_url
  AND old.active = TRUE;

-- Conferência: deve listar uma linha por veículo, só a mantida ativa.
-- SELECT name, url, active FROM sources
-- WHERE url ILIKE '%infomoney.com.br/feed%' OR url ILIKE '%megawhat%' ORDER BY url;

NOTIFY pgrst, 'reload schema';
