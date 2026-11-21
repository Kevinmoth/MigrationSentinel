"""Descarga en web/iconos/ los iconos 3.3.5 que usa la web.

Usa la BD local del usuario como fuente principal (item_db.json, spell_db.json
e icons/) y descarga de wowhead solo los iconos que no estan en ella (sobre
todo los de logro, que la BD local no trae).

Uso:
  python scripts/descargar_iconos.py [--bd RUTA_BD] [--fuerza]

Los iconos se guardan con el nombre del propio icono en minusculas, que es
como los nombra wowhead: web/iconos/inv_chest_samurai.jpg
"""
from __future__ import annotations

import argparse
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "web"
DESTINO = WEB / "iconos"

BD_POR_DEFECTO = Path(
    r"C:\Users\Mate\Desktop\Migraciones\Desarrollo opencode\BD"
)
CACHE_LOGROS = RAIZ / "logros_iconos.json"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"
CDN = "https://wow.zamimg.com/images/wow/icons/large/{}.jpg"


def cargar_json(ruta: Path):
    return json.loads(ruta.read_text(encoding="utf-8"))


def descargar(nombre: str) -> bytes | None:
    try:
        req = urllib.request.Request(CDN.format(nombre), headers={"user-agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            datos = r.read()
        return datos if len(datos) > 200 else None
    except Exception:
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bd", type=Path, default=BD_POR_DEFECTO)
    ap.add_argument("--fuerza", action="store_true",
                    help="vuelve a descargar aunque el archivo ya exista")
    args = ap.parse_args()

    bd = args.bd
    if not (bd / "item_db.json").exists():
        raise SystemExit(
            "No se encuentra %s. Indica la ruta con --bd." % (bd / "item_db.json")
        )

    items = cargar_json(bd / "item_db.json")
    spells = cargar_json(bd / "spell_db.json")
    logros = cargar_json(CACHE_LOGROS) if CACHE_LOGROS.exists() else {}

    nombres = set()
    for fuente in (items, spells):
        for v in fuente.values():
            if v.get("icon"):
                nombres.add(v["icon"].lower())
    for v in logros.values():
        if v:
            nombres.add(v.lower())
    nombres = sorted(nombres)
    print("iconos necesarios: %d" % len(nombres))

    # indice de la BD local, sin distinguir mayusculas
    local = {p.stem.lower(): p for p in (bd / "icons").iterdir() if p.is_file()}

    DESTINO.mkdir(parents=True, exist_ok=True)
    desde_bd, desde_web, fallos = [], [], []

    faltan = []
    for nombre in nombres:
        destino = DESTINO / (nombre + ".jpg")
        if destino.exists() and not args.fuerza:
            continue
        origen = local.get(nombre)
        if origen:
            desde_bd.append((origen, destino))
        else:
            faltan.append((nombre, destino))

    for origen, destino in desde_bd:
        destino.write_bytes(origen.read_bytes())
    print("copiados de la BD local: %d" % len(desde_bd))

    def bajar(par):
        nombre, destino = par
        datos = descargar(nombre)
        if datos:
            destino.write_bytes(datos)
            return True
        return False

    if faltan:
        print("descargando de wowhead: %d" % len(faltan))
        with ThreadPoolExecutor(max_workers=12) as pool:
            for (nombre, destino), ok in zip(faltan, pool.map(bajar, faltan)):
                if ok:
                    desde_web.append(nombre)
                else:
                    fallos.append(nombre)
        print("descargados: %d | fallidos: %d" % (len(desde_web), len(fallos)))

    total = sum(p.stat().st_size for p in DESTINO.iterdir() if p.is_file())
    print("\nweb/iconos: %d ficheros, %.1f MB"
          % (len(list(DESTINO.iterdir())), total / 1048576))
    if fallos:
        print("sin icono (%d): %s" % (len(fallos), ", ".join(fallos[:20])))


if __name__ == "__main__":
    main()
