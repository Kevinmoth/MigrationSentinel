#!/usr/bin/env python3
"""Convierte JSON de logros (uno por personaje) al CSV del validador.

Uso:  python convertir_json.py carpeta_o_archivo.json salida.csv
char_id = nombre del archivo sin extension.
Acepta el JSON completo o solo el fragmento  "logros": [ ... ]
"""
import json
import sys
from pathlib import Path

import pandas as pd


def leer(path):
    txt = Path(path).read_text(encoding="utf-8").strip()
    try:
        data = json.loads(txt)
    except json.JSONDecodeError:
        data = json.loads("{" + txt.rstrip(",") + "}")  # fragmento suelto
    return data["logros"] if isinstance(data, dict) else data


def main(src, out):
    p = Path(src)
    files = sorted(p.glob("*.json")) if p.is_dir() else [p]
    rows = []
    for f in files:
        for l in leer(f):
            rows.append({
                "char_id": f.stem,
                "achievement_id": int(l["id"]),
                "date": l.get("fecha"),
                "nombre": l.get("nombre"),
                "rojo": l.get("colorFila") == "rojo",
            })
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"], format="%d-%m-%Y", errors="coerce")
    bad = int(df["date"].isna().sum())
    if bad:
        print(f"Aviso: {bad} fechas no se pudieron leer")
    df.to_csv(out, index=False)
    print(f"{df.char_id.nunique()} personajes, {len(df)} logros -> {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
