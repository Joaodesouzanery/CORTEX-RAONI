#!/usr/bin/env python3
"""Do JSON de scripts/extract-report-pdf.py para:
  - docs/referencia-relatorios/pdf-entregues/itens.json (um item por matéria)
  - supabase/migrations/060_delivered_reports_pdf.sql (delivered_report_items,
    variant 'pdf-final', idempotente), só com o que o gabarito ainda não tem.

Por quê: os PDFs de outubro que chegaram ao cliente NÃO são os .dc.html que
estão no gabarito (rascunhos); de 18 a 25 matérias por cliente diferem, e ONS
e SIMINERAL de outubro nem tinham .dc.html. O gabarito precisa do que foi
entregue de verdade.

Uso: python3 -I scripts/build-delivered-pdf-items.py <report-links.json>
"""
import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
items_in = json.load(open(sys.argv[1], encoding="utf-8"))
gabarito = json.load(open(ROOT / "docs/referencia-relatorios/gabarito.json", encoding="utf-8"))

TONE = {"positivo": "Positivo", "neutro": "Neutro", "negativo": "Negativo", "misto": "Misto", "técnica": "Neutro", "tecnica": "Neutro", "crítico": "Negativo", "critico": "Negativo"}


def norm_url(url):
    return re.sub(r"^https?://(www\d?\.|m\.)?", "", (url or "").lower()).split("#")[0].rstrip("/")


def norm_title(text):
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()[:60]


def clean_anchor(anchor):
    # Boletim do SindInfor: "01 SINDINFOR · 05/10 Título Ler ↗" — tira número,
    # rótulo, data e o "Ler ↗" do botão.
    text = re.sub(r"\s*Ler\s*↗\s*", " ", anchor)
    text = re.sub(r"^\d{2}\s+[A-ZÀ-Ú ]+·\s*\d{1,2}/\d{1,2}\s*", "", text)
    return re.sub(r"\s+", " ", text.replace("↗", "")).strip()


def outlet_from(row, title):
    """Veículo = o que vem antes do título na linha, sem a data."""
    first = " ".join(title.split()[:3])
    idx = row.find(first) if first else -1
    head = row[:idx] if idx > 0 else ""
    head = re.sub(r"\b\d{1,2}/\d{1,2}(/\d{2,4})?\b", "", head)
    head = re.sub(r"^\d{2}\s+", "", head).strip(" ·-|")
    return head[:80] or None


def iso_date(ddmm, period):
    if not ddmm:
        return None
    parts = ddmm.split("/")
    day, month = int(parts[0]), int(parts[1])
    year = int(parts[2]) if len(parts) > 2 and len(parts[2]) == 4 else int(period[:4])
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


known = {}
for report in gabarito["reports"]:
    key = (report["client"], report["period"][:7])
    bucket = known.setdefault(key, {"urls": set(), "titles": set()})
    for item in report["items"]:
        bucket["urls"].add(norm_url(item.get("url")))
        bucket["titles"].add(norm_title(item.get("title")))

items = OrderedDict()
for raw in items_in:
    title = clean_anchor(raw["anchor"])
    if len(title) < 12:  # rótulo de botão sem título ("Ler ↗") não é matéria
        continue
    # Arquivo duplicado no zip ("Relatorio ONS Outubro 2026 2.pdf"): mesmo conteúdo.
    file = re.sub(r" 2\.pdf$", ".pdf", raw["file"])
    key = (raw["client"], raw["period"], norm_url(raw["url"]), norm_title(title))
    if key in items:
        continue
    bucket = known.get((raw["client"], raw["period"]), {"urls": set(), "titles": set()})
    items[key] = {
        "client": raw["client"],
        "period": raw["period"],
        "variant": raw["variant"],
        "file": file,
        "date": iso_date(raw.get("date"), raw["period"]),
        "outlet": outlet_from(raw["row"], title),
        "title": title,
        "url": raw["url"],
        "tone": TONE.get((raw.get("tone") or "").lower()),
        "in_gabarito": norm_url(raw["url"]) in bucket["urls"] or norm_title(title) in bucket["titles"],
    }

out_dir = ROOT / "docs/referencia-relatorios/pdf-entregues"
out_dir.mkdir(parents=True, exist_ok=True)
rows = list(items.values())
json.dump(rows, open(out_dir / "itens.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

q = lambda v: "NULL" if v in (None, "") else "'" + str(v).replace("'", "''") + "'"
new_rows = [row for row in rows if not row["in_gabarito"]]
values = ",\n".join(
    f"({q(r['client'])}, '{r['period']}-01', 'pdf-final', {q('pdf:' + r['file'])}, {q(r['date'])}, {q(r['outlet'])}, {q(r['title'])}, {q(r['url'])}, NULL, {q(r['tone'])})"
    for r in new_rows
)
sql = f"""-- 060: matérias dos relatórios EM PDF que chegaram ao cliente e não estão no
-- gabarito (delivered_report_items, variant 'pdf-final').
--
-- Os PDFs finais de outubro não são os .dc.html do gabarito (rascunhos): de
-- 18 a 25 matérias por cliente diferem, e ONS e SIMINERAL de outubro nem
-- tinham .dc.html. Setembro bate com o gabarito e não entra aqui.
-- Gerado por scripts/build-delivered-pdf-items.py a partir dos PDFs da pasta
-- "RELATORIOS CORTEX OUTUBRO" (17/11/2026); os PDFs não são versionados.
-- Links do Google News e com ?p= ficam como foram entregues: o validador e o
-- CSV de links marcam o problema; o gabarito registra o que o cliente recebeu.
--
-- Idempotente: pode colar mais de uma vez.

INSERT INTO delivered_report_items (client_name, period_month, variant, report_file, item_date, outlet, title, url, spokesperson, tone) VALUES
{values}
ON CONFLICT (report_file, title) DO UPDATE SET url = EXCLUDED.url, outlet = EXCLUDED.outlet, item_date = EXCLUDED.item_date, tone = EXCLUDED.tone, variant = EXCLUDED.variant;

-- Conferência: SELECT client_name, count(*) FROM delivered_report_items WHERE variant = 'pdf-final' GROUP BY 1 ORDER BY 1;  -- {len(new_rows)} no total

NOTIFY pgrst, 'reload schema';
"""
(ROOT / "supabase/migrations/060_delivered_reports_pdf.sql").write_text(sql, encoding="utf-8")
by = {}
for row in new_rows:
    by[(row["client"], row["period"])] = by.get((row["client"], row["period"]), 0) + 1
print(f"{len(rows)} itens; {len(new_rows)} novos para a 060: {by}")
