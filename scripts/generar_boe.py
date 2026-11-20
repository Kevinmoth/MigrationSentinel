#!/usr/bin/env python3
"""Genera boe_epicos.json desde la CSV de BoE épicos de nivel 80.

Uso:  python scripts/generar_boe.py

La CSV es la lista de objetos "Bound on Equip" (ligados al equipar) de nivel 80
que usa la regla de acumulación. Cada entrada del catálogo guarda nombre, ranura,
ilvl y de dónde sale, para poder explicar el hallazgo.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def buscar_csv() -> Path:
    candidatas = sorted(RAIZ.glob("BoE*.csv")) + sorted(RAIZ.glob("*BoE*.csv"))
    if not candidatas:
        raise SystemExit("No se encuentra la CSV de BoE en la raiz del repositorio")
    return candidatas[0]


def main() -> None:
    ruta_csv = buscar_csv()
    with ruta_csv.open(encoding="utf-8-sig", newline="") as fh:
        filas = list(csv.DictReader(fh))

    catalogo = {}
    for f in filas:
        try:
            id_ = int(f["ID"])
        except (KeyError, TypeError, ValueError):
            continue
        if not id_:
            continue
        info = catalogo.setdefault(str(id_), {
            "nombre": (f.get("Nombre") or "").strip(),
            "slot": (f.get("Slot") or "").strip(),
            "ilvl": int(f.get("iLvl") or 0),
            "origen": (f.get("Origen") or "").strip(),
            "grupo": (f.get("Raid / Profesión") or "").strip(),
        })
        # una misma pieza puede caer en dos sitios (BCE, NSU, ICC...)
        fuentes = info.setdefault("fuentes", [])
        grupo = (f.get("Raid / Profesión") or "").strip()
        if grupo and grupo not in fuentes:
            fuentes.append(grupo)

    salida = RAIZ / "boe_epicos.json"
    salida.write_text(json.dumps(catalogo, ensure_ascii=False, indent=0, sort_keys=True),
                      encoding="utf-8")
    print("origen:  %s (%d filas)" % (ruta_csv.name, len(filas)))
    print("escrito: %s (%.0f KB, %d objetos)" % (
        salida.name, salida.stat().st_size / 1024, len(catalogo)))


if __name__ == "__main__":
    main()
