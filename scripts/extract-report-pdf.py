#!/usr/bin/env python3
"""Extrai de cada PDF de relatório entregue: link clicável, o texto do link
(título da matéria) e a linha da tabela onde ele está (data, veículo, porta-voz,
tom), para o gabarito.

Uso: python3 -I scripts/extract-report-pdf.py <pasta-com-pdfs> > saida.json

O PDF é dado de terceiro: só lemos texto e anotações /URI, nada é executado.
Requer pdfplumber. Arquivo que não é relatório (clipping, matéria avulsa) é
ignorado pelo nome.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber

CLIENTS = [("sindinfor", "SINDINFOR"), ("ccee", "CCEE"), ("prio", "PRIO"), ("simineral", "SIMINERAL"), ("daq", "DAQ"), ("ons", "ONS"), ("antaq", "ANTAQ")]
MONTHS = {"janeiro": "01", "fevereiro": "02", "marco": "03", "abril": "04", "maio": "05", "junho": "06", "julho": "07",
          "agosto": "08", "setembro": "09", "outubro": "10", "novembro": "11", "dezembro": "12"}
DATE = re.compile(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b")
TONES = ("positivo", "neutro", "negativo", "misto", "técnica", "tecnica", "crítico", "critico")


def plain(text):
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


def meta(name):
    low = plain(name)
    if not low.startswith("relat"):
        return None
    client = next((code for key, code in CLIENTS if re.search(rf"\b{key}\b", low)), None)
    month = next((num for word, num in MONTHS.items() if word in low), None)
    year = re.search(r"20\d\d", low)
    if not client or not month or not year:
        return None
    variant = "completo" if "completo" in low else "associados" if "associados" in low else "principal"
    return client, f"{year.group(0)}-{month}", variant


def words_in(words, box, pad=1.5):
    x0, top, x1, bottom = box
    return [w for w in words if w["x0"] >= x0 - pad and w["x1"] <= x1 + pad and w["top"] >= top - pad and w["bottom"] <= bottom + pad]


def row_text(words, top, bottom):
    line = [w for w in words if w["bottom"] >= top - 2 and w["top"] <= bottom + 2]
    return " ".join(w["text"] for w in sorted(line, key=lambda w: (round(w["top"]), w["x0"])))


out = []
for pdf_path in sorted(Path(sys.argv[1]).glob("*.pdf")):
    info = meta(pdf_path.name)
    if not info:
        continue
    client, period, variant = info
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            links = page.hyperlinks or []
            if not links:
                continue
            words = page.extract_words(keep_blank_chars=False, use_text_flow=True)
            for link in links:
                uri = str(link.get("uri") or "")
                if not re.match(r"https?://", uri):
                    continue
                box = (link["x0"], link["top"], link["x1"], link["bottom"])
                anchor = " ".join(w["text"] for w in words_in(words, box)).strip()
                row = row_text(words, link["top"], link["bottom"])
                date = DATE.search(row)
                tone = next((t for t in TONES if t in row.lower()), None)
                out.append({
                    "client": client,
                    "period": period,
                    "variant": variant,
                    "file": unicodedata.normalize("NFC", pdf_path.name),
                    "page": page_no,
                    "url": uri,
                    "anchor": anchor,
                    "row": row[:400],
                    "date": date.group(0) if date else None,
                    "tone": tone,
                })
# Título que quebra linha vira várias anotações com o mesmo link: junta.
merged = []
for item in out:
    last = merged[-1] if merged else None
    if last and last["file"] == item["file"] and last["page"] == item["page"] and last["url"] == item["url"]:
        last["anchor"] = f"{last['anchor']} {item['anchor']}".strip()
        last["date"] = last["date"] or item["date"]
        last["tone"] = last["tone"] or item["tone"]
        continue
    merged.append(item)
print(json.dumps(merged, ensure_ascii=False, indent=1))
