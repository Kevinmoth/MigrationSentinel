#!/usr/bin/env python3
"""Genera web/datos.js desde los catálogos del detector local.

Uso:  python scripts/generar_datos_web.py

Lee logros_wotlk.json, objetos_fuente.json y nombres_logros.json de la raíz
del repositorio y escribe web/datos.js. No editar datos.js a mano: si cambia
el catálogo, se vuelve a ejecutar esto.
"""
from __future__ import annotations

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "web"


def cargar(nombre: str) -> dict:
    return json.loads((RAIZ / nombre).read_text(encoding="utf-8"))


def main() -> None:
    catalogo = cargar("logros_wotlk.json")
    fuentes = cargar("objetos_fuente.json")
    nombres = cargar("nombres_logros.json")

    partes = [
        "// Datos del motor 3.3.5. Generado desde logros_wotlk.json,",
        "// objetos_fuente.json y nombres_logros.json. No editar a mano:",
        "// ejecutar scripts/generar_datos_web.py",
        "const CATALOGO = " + json.dumps(catalogo, ensure_ascii=False, separators=(",", ":")) + ";",
        "const FUENTES = " + json.dumps(fuentes, ensure_ascii=False, separators=(",", ":")) + ";",
        "const NOMBRES = " + json.dumps(nombres, ensure_ascii=False, separators=(",", ":")) + ";",
    ]
    salida = WEB / "datos.js"
    salida.write_text("\n".join(partes), encoding="utf-8")

    print("escrito %s (%.0f KB)" % (salida.relative_to(RAIZ), salida.stat().st_size / 1024))
    print("metas: %d | objetos con fuente: %d | nombres: %d"
          % (len(catalogo), len(fuentes), len(nombres)))


if __name__ == "__main__":
    main()
