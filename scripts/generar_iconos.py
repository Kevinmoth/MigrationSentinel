"""Genera los datos de iconos para la web: mapa ID -> nombre de icono.

Fuentes:
  - item_db.json   (BD local): item id -> icono
  - spell_db.json  (BD local): spell id -> icono
  - logros_iconos.json (cache): logro id -> icono

Salida:
  web/iconos.js       -> nombres de los iconos y mapa de logros (ligero)
  web/iconos-ids.js   -> ids de objetos y hechizos (pesado, se carga bajo
                         demanda: la web no lo necesita para el resumen)

Uso:
  python scripts/generar_iconos.py [--bd RUTA_BD] [--cache RUTA_CACHE]

El BD por defecto es la carpeta que usa el usuario:
  C:\\Users\\Mate\\Desktop\\Migraciones\\Desarrollo opencode\\BD

La cache de los iconos de logro (lo que wowhead devuelve por tooltip) se guarda
en la raiz del repositorio como logros_iconos.json para no depender de la red
en cada ejecucion.
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "web"

BD_POR_DEFECTO = Path(
    r"C:\Users\Mate\Desktop\Migraciones\Desarrollo opencode\BD"
)
CACHE_LOGROS = RAIZ / "logros_iconos.json"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"
TOOLTIP = "https://nether.wowhead.com/tooltip/achievement/{}?dataEnv=1&locale=0"


# ------------------------------------------------------------------ fuentes
def cargar_json(ruta: Path):
    return json.loads(ruta.read_text(encoding="utf-8"))


def icono_logro(aid: int, intentos: int = 3) -> str | None:
    """Nombre del icono de un logro segun wowhead (p.ej. achievement_level_10)."""
    url = TOOLTIP.format(aid)
    req = urllib.request.Request(url, headers={"user-agent": UA})
    for intento in range(intentos):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                datos = json.loads(r.read().decode("utf-8", "replace"))
            icono = datos.get("icon")
            if icono and icono != "undefined":
                return icono.lower()
            return None
        except Exception:
            time.sleep(1.5 * (intento + 1))
    return None


def cache_logros(bd: Path, cache: Path, forzar: bool = False) -> dict:
    """Mapa id -> icono de logro, cacheado en disco."""
    if cache.exists() and not forzar:
        datos = cargar_json(cache)
        print("cache de logros leida: %d entradas" % len(datos))
        return datos

    logros = cargar_json(bd / "achievement_db.json")
    ids = sorted(int(k) for k in logros)
    print("consultando el icono de %d logros en wowhead..." % len(ids))
    salida = {}
    with ThreadPoolExecutor(max_workers=12) as pool:
        for i, (aid, icono) in enumerate(
            zip(ids, pool.map(icono_logro, ids)), 1
        ):
            if icono:
                salida[str(aid)] = icono
            if i % 250 == 0:
                print("  ... %d / %d" % (i, len(ids)))
    cache.write_text(
        json.dumps(salida, ensure_ascii=False, indent=0, sort_keys=True),
        encoding="utf-8",
    )
    print("cache escrita: %s (%d con icono)" % (cache.name, len(salida)))
    return salida


# ------------------------------------------------------------------ salida
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bd", type=Path, default=BD_POR_DEFECTO,
                    help="carpeta con item_db.json, spell_db.json e icons/")
    ap.add_argument("--cache", type=Path, default=CACHE_LOGROS,
                    help="cache del mapa id -> icono de logro")
    ap.add_argument("--refrescar-logros", action="store_true",
                    help="vuelve a consultar los logros en vez de usar la cache")
    args = ap.parse_args()

    bd = args.bd
    if not (bd / "item_db.json").exists():
        raise SystemExit(
            "No se encuentra %s. Indica la ruta con --bd." % (bd / "item_db.json")
        )

    items = cargar_json(bd / "item_db.json")
    spells = cargar_json(bd / "spell_db.json")
    logros = cache_logros(bd, args.cache, args.refrescar_logros)

    mapa_items = {
        str(k): v["icon"].lower()
        for k, v in items.items()
        if v.get("icon")
    }
    mapa_spells = {
        str(k): v["icon"].lower()
        for k, v in spells.items()
        if v.get("icon")
    }
    mapa_logros = {str(k): v for k, v in logros.items() if v}

    nombres = sorted(set(mapa_items.values()) | set(mapa_spells.values())
                     | set(mapa_logros.values()))
    indice = {n: i for i, n in enumerate(nombres)}

    # Los ids de objeto y hechizo son casi todos los que hay, asi que se
    # codifican como una lista de indices (un numero por id) en vez de un
    # objeto {id: nombre}: ocupa la cuarta parte y se lee en microsegundos.
    def indices(mapa: dict, maximo: int) -> str:
        return ",".join(
            str(indice[mapa[str(i)]]) if str(i) in mapa else "-1"
            for i in range(maximo)
        )

    max_item = max(int(k) for k in mapa_items) + 1
    max_spell = max(int(k) for k in mapa_spells) + 1

    # ---- archivo ligero: nombres + logros (se carga siempre) --------------
    # "var" y no "const": asi los datos quedan tambien en window, que es como
    # los lee el modulo de iconos cuando se carga iconos-ids.js bajo demanda.
    ligero = [
        "// Iconos 3.3.5: nombres de icono y mapa de logros.",
        "// Generado por scripts/generar_iconos.py. No editar a mano.",
        "var ICONOS = {",
        '  Nombres: ' + json.dumps(nombres, ensure_ascii=False,
                                   separators=(",", ":")) + ",",
        '  Logros: ' + json.dumps(mapa_logros, ensure_ascii=False,
                                  separators=(",", ":")) + ",",
        "};",
    ]
    destino = WEB / "iconos.js"
    destino.write_text("\n".join(ligero), encoding="utf-8")

    # ---- archivo pesado: ids de objetos y hechizos (bajo demanda) --------
    pesado = [
        "// Ids de objetos y hechizos -> indice en ICONOS.Nombres.",
        "// Generado por scripts/generar_iconos.py. No editar a mano.",
        "// La posicion de la lista es el id; -1 significa que no hay icono.",
        "var ICONOS_IDS = {",
        '  Objetos: ' + json.dumps(indices(mapa_items, max_item),
                                   separators=(",", ":")) + ",",
        '  Hechizos: ' + json.dumps(indices(mapa_spells, max_spell),
                                    separators=(",", ":")) + ",",
        "};",
    ]
    destino_ids = WEB / "iconos-ids.js"
    destino_ids.write_text("\n".join(pesado), encoding="utf-8")

    print("\nescrito %s (%.0f KB)" % (destino.relative_to(RAIZ),
                                      destino.stat().st_size / 1024))
    print("escrito %s (%.0f KB)" % (destino_ids.relative_to(RAIZ),
                                    destino_ids.stat().st_size / 1024))
    print("objetos: %d | hechizos: %d | logros: %d | iconos unicos: %d"
          % (len(mapa_items), len(mapa_spells), len(mapa_logros), len(nombres)))


if __name__ == "__main__":
    main()
