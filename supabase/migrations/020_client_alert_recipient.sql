-- 020: destinatário dos alertas por cliente.
-- Usado no painel /alertas para o operador saber "para quem enviar" e mandar o
-- digest manualmente (o envio automático por e-mail — Resend — fica opcional).
-- Idempotente.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS alert_recipient TEXT;
