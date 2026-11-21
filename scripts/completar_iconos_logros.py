"""Anade iconos a los logros que wowhead no conoce.

Los emblemas de mazmorra y banda (3838-3843) y el Emblematico (4785) son
logros propios del servidor, sin icono publico. Se les asigna un icono
representativo de la familia para que la tabla no deje huecos.

Uso: python scripts/completar_iconos_logros.py
"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# id -> icono representativo
COMPLEMENTO = {
    3838: "achievement_bg_ab_defendflags",   # Emblema de mazmorra y banda
    3839: "achievement_bg_ab_kill_in_mine",
    3840: "achievement_bg_defendxtowers_av",
    3841: "achievement_bg_takexflags_ab",
    3842: "achievement_worldevent_mistletoe",
    3843: "achievement_reputation_01",
    4785: "achievement_general",             # Emblematico
}


def main() -> None:
    ruta = RAIZ / "logros_iconos.json"
    import json
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    anadidos = 0
    for aid, icono in COMPLEMENTO.items():
        clave = str(aid)
        if clave not in datos:
            datos[clave] = icono
            anadidos += 1
    ruta.write_text(
        json.dumps(datos, ensure_ascii=False, indent=0, sort_keys=True),
        encoding="utf-8",
    )
    print("logros con icono: %d (anadidos %d)" % (len(datos), anadidos))


if __name__ == "__main__":
    main()
