# Clipping diário por e-mail

**Como funciona.** Todo dia, para cada cliente, o Cortex monta um e-mail no formato do clipping que a ONS recebe (`docs/referencia-relatorios/2026-10-destaques/formato-clipping-diario.md`):
- primeiro as menções ao cliente, agrupadas por fato, com os veículos e o tom ("A menção foi técnica/positiva/negativa");
- depois "Em setor", com até 3 itens;
- cada item traz título, veículo e link. **Nunca vai a íntegra**: ela é do fornecedor licenciado.

O código está em `src/lib/clipping-text.ts`, `src/lib/clipping-email.ts` e `src/app/api/internal/clipping-email/route.ts`.

## Gmail com senha de app (escolha do dono, 17/11/2026)
O Cortex envia pelo seu Gmail, sozinho, sem o Resend e sem domínio novo. O limite é de cerca de 500 destinatários por dia, e 7 clientes com 3 pessoas cada dão 21 por dia.

1. Na conta Google que vai enviar, ligue a **verificação em 2 etapas** (myaccount.google.com → Segurança).
2. Gere uma **senha de app**: myaccount.google.com/apppasswords → nome "Cortex" → Criar. Copie os 16 caracteres.
3. Na **Vercel** (projeto cortexintel → Settings → Environment Variables → Production):
   - `GMAIL_USER`: o endereço do Gmail;
   - `GMAIL_APP_PASSWORD`: a senha de app (não a senha da conta);
   - `ALERTS_EMAIL_TO`: o seu e-mail, que recebe a revisão;
   - `ALERTS_EMAIL_FROM` (opcional): só o nome que aparece, como `Clipping CRT <...>`. O endereço é sempre o da conta Gmail.
4. Faça um redeploy da produção para as variáveis valerem.
5. Cole a migration 058 e cadastre os 3 destinatários de cada cliente (modelo no fim da 058).

Com o Gmail configurado, ele tem prioridade sobre o Resend. Login recusado aparece como "use uma senha de app" no resultado do envio.

**O que o e-mail traz, por cliente:**
1. a marca;
2. as menções ao cliente do dia, agrupadas por fato, com veículos, link exato e o tom (só quando revisado);
3. "Em setor", com até 3 itens;
4. **Temas do mês até hoje**, com a contagem por tema (o mesmo cálculo do Painel);
5. o link "Ver o clipping do dia e o histórico no Cortex";
6. o rodapé com o denominador e o descadastro.

## Por que não o conector do Gmail do Claude
O conector age só enquanto uma sessão do Claude está rodando. Serve para rascunho, não para envio automático todo dia.

## Resend (alternativa)
- **O conector do Gmail do Claude age na caixa do dono só durante um chat.** Serve para criar um rascunho por dia que o dono revisa e envia (alternativa abaixo), não para envio automático aos clientes.
- **Gmail API dentro do app** exigiria OAuth do Google, renovação de token e verificação do app para o escopo de envio. O limite é de cerca de 500 e-mails por dia (2.000 no Workspace), e a mensagem sairia da caixa pessoal.
- **Resend** já estava pronto em `src/lib/email.ts`. É uma chamada HTTP; com domínio verificado (SPF/DKIM) não cai em spam e roda sozinho pelo GitHub Actions.

**Custo**
- **Resend:** grátis até 3.000 e-mails por mês e 100 por dia. Com 7 clientes, 3 destinatários e 22 dias úteis, são cerca de 460 por mês. O plano pago custa cerca de US$ 20 por mês para 50.000.
- **Domínio:** cerca de R$ 40 por ano, se a marca ainda não tiver um.
- **Anthropic:** não usa. O texto sai do modelo fixo.

## Passo a passo para ligar
1. Crie a conta no Resend e verifique o domínio do remetente (DNS: SPF e DKIM).
2. Na **Vercel**, defina:
   - `RESEND_API_KEY`;
   - `ALERTS_EMAIL_FROM`, por exemplo `Clipping CRT <clipping@seudominio.com.br>`;
   - `ALERTS_EMAIL_TO`, o seu e-mail, que recebe a revisão.
3. Cole a migration `058_clipping_email.sql` no Supabase.
4. Cadastre os destinatários por SQL (modelo no fim da 058). Não há tela: são dados pessoais.
5. Veja a prévia em **Clipping → Ver e-mail do dia**. Ela não envia nada.
6. Em Actions, rode **Daily clipping email** com `mode = review`: chega um e-mail por cliente só para você.
7. Aprovado, rode de novo com `mode = send`: vai para os destinatários do cliente, em cópia oculta.
8. Para automatizar, descomente o `schedule` do workflow. Ele vem em modo revisão; diga se prefere diário ou semanal.

**Garantias**
- **Re-run no mesmo dia e modo não duplica o e-mail** (`clipping_email_sends`, chave cliente + dia + modo). Envio que falhou pode ser refeito.
- **Dia sem matéria não manda e-mail vazio.**
- **Sem `RESEND_API_KEY`, ou sem remetente no modo `send`, a rota responde "não configurado" (HTTP 503)**, e o workflow falha visível.
- **Destinatários:** um não vê o e-mail do outro (cópia oculta). Descadastro: responder ao e-mail, e o dono marca `active = FALSE`.

## LGPD
- **Dados:** nome e e-mail de pessoas do cliente, para entregar o clipping contratado (execução de contrato).
- **Proteção:** a tabela só é acessível pelo service role, sem tela e sem rota pública. O registro de envios guarda só quantos receberam, nunca quem.
- **Fim do contrato:** apague as linhas do cliente em `client_email_recipients`.
- **Suboperador:** o Resend é suboperador novo e entra no registro de `docs/playbook/riscos-e-conformidade.md`.

## Alternativa sem custo: rascunho no Gmail
Uma tarefa agendada nesta conta do Claude pode, todo dia, abrir a prévia (`/api/clipping-email/preview?client_id=…&date=…&format=text`) e criar um **rascunho** no Gmail do dono, que revisa e envia. Não custa nada, mas depende do Claude rodar e do envio manual. Serve para a fase de teste, não para escala.
