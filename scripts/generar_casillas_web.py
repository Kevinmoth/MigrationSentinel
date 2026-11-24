#!/usr/bin/env python3
"""Genera web/casillas.js desde el catalogo de objetos con casilla.

Uso:  python scripts/generar_casillas_web.py [ruta/al/objetos_wow_3355.csv]

El CSV viene del catalogo local (bd_objetos/objetos_wow_3355.csv). Cada fila
es un objeto del juego con la casilla que ocupa: cabeza, pecho, arma, anillo...
De ahi sale el mapa que usa la web para ordenar el inventario del personaje
por casillas.

El resultado se guarda comprimido: una cadena con un caracter por id de
objeto (a..t para cada casilla, '.' para los que no son equipables), para que
la pagina no cargue un diccionario de 46.000 entradas.

No editar casillas.js a mano: si cambia el catalogo, se vuelve a ejecutar esto.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# Orden de las casillas: el mismo que el panel de personaje del juego.
# Cada casilla ocupa una letra (a, b, c...) en la cadena comprimida.
CASILLAS = [
    "cabeza", "cuello", "hombros", "espalda", "pecho", "tabardo", "camisa",
    "manos", "muñecas", "cintura", "piernas", "pies", "anillo", "abalorio",
    "arma", "escudo", "distancia", "reliquia", "bolsa", "desconocido",
]

NOMBRES_FICHA = {
    "cabeza": "Cabeza",
    "cuello": "Cuello",
    "hombros": "Hombros",
    "espalda": "Espalda",
    "pecho": "Pecho",
    "tabardo": "Tabardo",
    "camisa": "Camisa",
    "manos": "Manos",
    "muñecas": "Muñecas",
    "cintura": "Cintura",
    "piernas": "Piernas",
    "pies": "Pies",
    "anillo": "Anillo",
    "abalorio": "Abalorio",
    "arma": "Arma",
    "escudo": "Escudo",
    "distancia": "Distancia",
    "reliquia": "Reliquia",
    "bolsa": "Bolsa",
    "desconocido": "Sin casilla",
}

# Una casilla que no este en la lista entra al final, con su propia letra.
def letra(casilla: str) -> str:
    return chr(ord("a") + CASILLAS.index(casilla))


def encontrar_csv(argumentos: list[str]) -> Path:
    if argumentos:
        return Path(argumentos[0]).expanduser()
    candidatos = [
        RAIZ / "bd_objetos" / "objetos_wow_3355.csv",
        RAIZ.parent / "Detector de pvtos" / "bd_objetos" / "objetos_wow_3355.csv",
    ]
    for c in candidatos:
        if c.exists():
            return c
    raise SystemExit(
        "No encuentro objetos_wow_3355.csv. Indica la ruta:\n"
        "  python scripts/generar_casillas_web.py <ruta>\n"
        "Busque en:\n  " + "\n  ".join(str(c) for c in candidatos)
    )


def main() -> None:
    csv_path = encontrar_csv(sys.argv[1:])
    with csv_path.open(encoding="utf-8", newline="") as fh:
        filas = list(csv.DictReader(fh))

    mapa: dict[int, str] = {}
    extra: list[str] = []
    for fila in filas:
        casilla = (fila.get("casilla") or "").strip().lower()
        try:
            id_objeto = int(fila["id"])
        except (TypeError, ValueError):
            continue
        if not casilla:
            # Esta en el catalogo pero no es equipable (materiales, consumibles):
            # se marca con '-' para distinguirlos de los que ni estan en la base.
            equipable = (fila.get("equipable") or "").strip()
            if equipable == "0":
                mapa[id_objeto] = "-"
            continue
        if casilla not in CASILLAS:
            if casilla not in extra:
                extra.append(casilla)
            CASILLAS.append(casilla)
        mapa[id_objeto] = casilla

    maximo = max(mapa) if mapa else 0
    datos = ["."] * (maximo + 1)
    for id_objeto, casilla in mapa.items():
        datos[id_objeto] = "-" if casilla == "-" else letra(casilla)

    nombres = [NOMBRES_FICHA.get(c, c.capitalize()) for c in CASILLAS]
    partes = [
        "// Casilla de cada objeto del juego. Generado desde",
        "// bd_objetos/objetos_wow_3355.csv.",
        "// No editar a mano: ejecutar scripts/generar_casillas_web.py",
        "// CASILLAS: nombre visible de cada casilla, en el orden de las letras.",
        "const CASILLAS = " + repr(nombres).replace("'", '"') + ";",
        "// CASILLAS_CLAVE: clave interna de cada casilla, en el mismo orden.",
        "const CASILLAS_CLAVE = " + repr(list(CASILLAS)).replace("'", '"') + ";",
        "// CASILLAS_CODIGO: una letra por id de objeto ('.' = no esta en el",
        "// catalogo, '-' = no es equipable).",
        "const CASILLAS_CODIGO = " + repr("".join(datos)).replace("'", '"') + ";",
    ]
    salida = RAIZ / "web" / "casillas.js"
    salida.write_text("\n".join(partes) + "\n", encoding="utf-8")

    print("escrito %s (%.0f KB)" % (salida.relative_to(RAIZ), salida.stat().st_size / 1024))
    print("objetos con casilla: %d | ids hasta %d | casillas: %d"
          % (len(mapa), maximo, len(CASILLAS)))
    print("no equipables: %d" % sum(1 for v in mapa.values() if v == "-"))
    if extra:
        print("casillas nuevas (al final): " + ", ".join(extra))


if __name__ == "__main__":
    main()
