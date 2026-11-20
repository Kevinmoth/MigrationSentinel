#!/usr/bin/env python3
"""
Motor del detector de migraciones falsas - WoW 3.3.5 (WotLK).

No calcula una "probabilidad" abstracta: monta un expediente de indicios
jerarquizado, como lo haria un revisor.

  PRUEBA   (fuerza >= 80%)  -> practicamente concluyente
  INDICIO  (fuerza 50-79%)  -> hay que mirarlo
  ANOMALIA (fuerza < 50%)   -> se anota siempre, aunque sea frecuente

Cada indicio lleva dos numeros distintos:
  fuerza     -> cuanto pesa como signo de falsificacion (criterio del revisor)
  frecuencia -> en cuantos perfiles del corpus aparece (contexto, NO descuenta)

Familias: dentro de una misma familia manda el indicio mas fuerte, para no
contar cinco veces el mismo hecho. Entre familias se combina con noisy-OR.

La bala de plata es la deteccion de clones: dos personajes distintos no pueden
tener los mismos logros en las mismas fechas (o con el mismo desplazamiento).
"""
from __future__ import annotations

import bisect
import collections
import json
import math
import re
from datetime import datetime
from pathlib import Path

FORMATO = "%d-%m-%Y"
INICIO_LOGROS = datetime(2008, 10, 14).date()   # 3.0.2: aparecen los logros

NIVELES = (6, 7, 8, 9, 10, 11, 12, 13)
NIVEL_10 = 6
NIVEL_80 = 13
DOBLE_SPEC = 2716
EMBLEMA_1 = 3838
ESCALERA_EMBLEMAS = (3838, 3839, 3840, 3841, 3842, 3843)
EMBLEMATIC = 4785
ALGALON = 3036
GUARDIANES = 2890
ALAS_ICC25 = (4604, 4605, 4606, 4607, 4597)
ALAS_ICC10 = (4531, 4528, 4529, 4527, 4530)
ALAS_ICC25_HC = (4632, 4633, 4634, 4635)
ALAS_ICC10_HC = (4628, 4629, 4630, 4631, 4583)
META_ICC25 = 4608
META_ICC10_HC = 4636
ANILLOS_REPUTACION = set(range(50398, 50404)) | set(range(52570, 52576))

# Escalera de muertes con honor (HK). El campo "muertes" del perfil ES el HK.
HK_LOGROS = [(238, 1), (513, 100), (515, 500), (516, 1000), (512, 5000),
             (509, 10000), (239, 25000), (869, 50000), (870, 100000)]

FAMILIAS = {
    "normas": "Normas de logros",
    "objetos": "Objetos sin respaldo",
    "clon": "Clonación (señal)",
    "emblema": "Emblemas",
    "ulduar": "Ulduar",
    "icc": "Progresión ICC",
    "progresion": "Progresión general",
    "rareza": "Rareza estadística",
}

# Catálogo real de normas: logro -> componentes que exige.
# Se genera con el volcado de criterios de la base 3.3.5 (logros_wotlk.json).
CATALOGO = {}
CATALOGO_VALIDO = {}
NOMBRES = {}
FUENTES = {}

# Jefe de ICC -> ala, y ala -> logro por tamaño/dificultad.
ALAS_ICC = {
    "tormenta": {"25N": 4604, "25H": 4632, "10N": 4531, "10H": 4628},
    "peste": {"25N": 4605, "25H": 4633, "10N": 4528, "10H": 4629},
    "sangre": {"25N": 4606, "25H": 4634, "10N": 4529, "10H": 4630},
    "escarcha": {"25N": 4607, "25H": 4635, "10N": 4527, "10H": 4631},
    "trono": {"25N": 4597, "25H": 4584, "10N": 4530, "10H": 4583},
}

JEFES_ICC = [
    ("marrowgar", "tormenta"), ("deathwhisper", "tormenta"), ("gunship", "tormenta"),
    ("saurfang", "tormenta"), ("festergut", "peste"), ("rotface", "peste"),
    ("putricide", "peste"), ("keleseth", "sangre"), ("valanar", "sangre"),
    ("taldaram", "sangre"), ("lana'thel", "sangre"), ("dreamwalker", "escarcha"),
    ("sindragosa", "escarcha"), ("lich king", "trono"),
]


def _cargar_catalogo():
    ruta = Path(__file__).with_name("logros_wotlk.json")
    if not ruta.exists():
        return
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
        CATALOGO.update({int(k): [int(x) for x in v] for k, v in datos.items() if v})
    except (ValueError, OSError):
        pass


def _cargar_fuentes():
    ruta = Path(__file__).with_name("objetos_fuente.json")
    if not ruta.exists():
        return
    try:
        FUENTES.update(json.loads(ruta.read_text(encoding="utf-8")))
    except (ValueError, OSError):
        pass


def _cargar_nombres():
    ruta = Path(__file__).with_name("nombres_logros.json")
    if not ruta.exists():
        return
    try:
        NOMBRES.update({int(k): v for k, v in json.loads(ruta.read_text(encoding="utf-8")).items()})
    except (ValueError, OSError):
        pass


def _nombre(aid):
    return NOMBRES.get(aid) or str(aid)


_cargar_catalogo()
_cargar_fuentes()
_cargar_nombres()


# --------------------------------------------------------------------------
# Lectura
# --------------------------------------------------------------------------
def _fecha(txt):
    try:
        return datetime.strptime(str(txt).strip(), FORMATO).date()
    except (ValueError, TypeError):
        return None


def _entero(valor):
    try:
        return int(str(valor).strip())
    except (ValueError, TypeError):
        return None


def _reino(nombre):
    base = re.sub(r"_\d{8}-\d{4}.*$", "", Path(nombre).stem)
    partes = base.split("_")
    return partes[partes.index("com") - 1] if "com" in partes else "otro"


def leer_perfil(ruta):
    ruta = Path(ruta)
    datos = json.loads(ruta.read_text(encoding="utf-8-sig", errors="replace"))
    pj = datos.get("personaje", {}) or {}

    logros, nombres = {}, {}
    for a in datos.get("logros", []) or []:
        aid, f = _entero(a.get("id")), _fecha(a.get("fecha"))
        if aid is not None and f is not None:
            logros[aid] = f
            nombres[aid] = a.get("nombre", "")

    objetos, ilvl = [], {}
    for o in datos.get("objetos", []) or []:
        eid, nv = _entero(o.get("entryId")), _entero(o.get("itemLevel"))
        if eid is not None and nv is not None:
            objetos.append((eid, nv, o.get("nombre", "")))
            ilvl[eid] = nv

    monturas = set()
    for m in datos.get("monturas", []) or []:
        sid = _entero(m.get("spellId") or m.get("id"))
        if sid is not None:
            monturas.add(sid)

    suma_rep = 0
    reps_exaltadas = 0
    for r in datos.get("reputaciones", []) or []:
        v = _entero(r.get("puntuacion")) or 0
        suma_rep += v
        if v >= 42000:
            reps_exaltadas += 1

    extraido = (datos.get("meta", {}) or {}).get("extraidoEn")
    try:
        extraido = datetime.fromisoformat(str(extraido).replace("Z", "")).date() if extraido else None
    except ValueError:
        extraido = None

    return {
        "ruta": str(ruta),
        "archivo": ruta.name,
        "nombre": pj.get("nombreServidor") or pj.get("nombreRemoto") or ruta.stem.split("_")[0],
        "reino": _reino(ruta.name),
        "url": pj.get("urlOriginal") or "",
        "clase": pj.get("clase", ""),
        "raza": pj.get("raza", ""),
        "nivel": _entero(pj.get("nivel")) or 0,
        "muertes": _entero(pj.get("muertes")) or 0,
        "honor": _entero(pj.get("puntosHonor")) or 0,
        "arena": _entero(pj.get("puntosArena")) or 0,
        "oro": (_entero(pj.get("oroCobre")) or 0) / 10000.0,
        "logros": logros,
        "nombres": nombres,
        "objetos": objetos,
        "ilvl": ilvl,
        "monturas": monturas,
        "nombre_remoto": pj.get("nombreRemoto") or "",
        "realmlist": pj.get("realmlistOrigen") or "",
        "suma_rep": suma_rep,
        "reps_exaltadas": reps_exaltadas,
        "extraido": extraido,
    }


# --------------------------------------------------------------------------
# Reglas: cada una devuelve un dict o None
# --------------------------------------------------------------------------
def _delta(p, a, b):
    fa, fb = p["logros"].get(a), p["logros"].get(b)
    return (fa - fb).days if fa and fb else None


def r_emblema_vs_emblema(p):
    """Emblematic y el primer emblema son el mismo hecho: deben coincidir."""
    d = _delta(p, EMBLEMATIC, EMBLEMA_1)
    if d is None or d == 0:
        return None
    if d < 0:
        det = "Emblematic (%s) es %d día(s) ANTERIOR al primer emblema (%s)" % (
            p["logros"][EMBLEMATIC], -d, p["logros"][EMBLEMA_1])
    else:
        det = "Emblematic (%s) llega %d día(s) después del primer emblema (%s)" % (
            p["logros"][EMBLEMATIC], d, p["logros"][EMBLEMA_1])
    return {"titulo": "Emblematic descuadrado con el primer emblema",
            "detalle": det, "fuerza": 0.90, "familia": "emblema"}


def r_emblema_antes_80(p):
    d = _delta(p, EMBLEMATIC, NIVEL_80)
    if d is not None and d < 0:
        return {"titulo": "Emblematic antes del nivel 80",
                "detalle": "Emblematic (%s) es anterior al nivel 80 (%s)" % (
                    p["logros"][EMBLEMATIC], p["logros"][NIVEL_80]),
                "fuerza": 0.85, "familia": "emblema"}
    return None


def r_primer_emblema_antes_80(p):
    d = _delta(p, EMBLEMA_1, NIVEL_80)
    if d is not None and d < 0:
        return {"titulo": "Primer emblema antes del nivel 80",
                "detalle": "El primer emblema (%s) es anterior al nivel 80 (%s)" % (
                    p["logros"][EMBLEMA_1], p["logros"][NIVEL_80]),
                "fuerza": 0.75, "familia": "emblema"}
    return None


def r_escalera_emblemas(p):
    if not all(i in p["logros"] for i in ESCALERA_EMBLEMAS):
        return None
    fechas = [p["logros"][i] for i in ESCALERA_EMBLEMAS]
    if fechas == sorted(fechas):
        return None
    dias = [_delta(p, i, EMBLEMA_1) for i in ESCALERA_EMBLEMAS]
    return {"titulo": "Escalera de emblemas desordenada",
            "detalle": "25/50/100/250/500 emblemas con fechas fuera de orden: %s días" % dias,
            "fuerza": 0.90, "familia": "emblema"}


def r_500_rapido(p):
    d = _delta(p, 3843, EMBLEMA_1)
    if d is not None and d < 7:
        return {"titulo": "500 emblemas en menos de una semana",
                "detalle": "3843 (500 emblemas) solo %d día(s) después del primero" % d,
                "fuerza": 0.90, "familia": "emblema"}
    return None


def r_algalon(p):
    if ALGALON in p["logros"] and GUARDIANES not in p["logros"]:
        return {"titulo": "Algalon sin los Guardianes de Ulduar",
                "detalle": "Algalon (3036) exige la llave del Planetario Celestial; no tiene 2890",
                "fuerza": 0.80, "familia": "ulduar"}
    return None


def r_meta_icc25(p):
    if META_ICC25 in p["logros"] and not set(ALAS_ICC25) <= set(p["logros"]):
        faltan = sorted(set(ALAS_ICC25) - set(p["logros"]))
        return {"titulo": "Meta de ICC 25 sin sus alas",
                "detalle": "Rey Exánime 25 (4608) sin los logros %s" % faltan,
                "fuerza": 0.95, "familia": "icc"}
    return None


def r_meta_icc10hc(p):
    if META_ICC10_HC in p["logros"] and not set(ALAS_ICC10_HC) <= set(p["logros"]):
        faltan = sorted(set(ALAS_ICC10_HC) - set(p["logros"]))
        return {"titulo": "Meta heroica de ICC 10 sin sus alas",
                "detalle": "4636 sin los logros %s" % faltan,
                "fuerza": 0.95, "familia": "icc"}
    return None


def r_277(p):
    piezas = [e for e, nv in p["ilvl"].items() if nv == 277 and e not in ANILLOS_REPUTACION]
    if piezas and not set(ALAS_ICC25_HC) & set(p["logros"]):
        return {"titulo": "Botín 277 sin alas de ICC 25 heroico",
                "detalle": "%d pieza(s) de ICC 25 HC sin ningún ala 25HC (hay tiendas: pesa poco)" % len(piezas),
                "fuerza": 0.20, "familia": "icc"}
    return None


def r_metas(p):
    """Cada meta exige sus componentes segun el catalogo real del juego."""
    reglas = CATALOGO_VALIDO or CATALOGO
    if not reglas:
        return None
    ids = set(p["logros"])
    faltas = []
    for a, componentes in reglas.items():
        if a in ids:
            falta = [c for c in componentes if c not in ids]
            if falta:
                faltas.append((a, falta, len(componentes)))
    if not faltas:
        return None
    faltas.sort(key=lambda x: (len(x[1]), -x[2]))
    a, falta, total = faltas[0]
    det = "«%s» exige %d logros y le faltan %d: %s" % (
        _nombre(a), total, len(falta), ", ".join(_nombre(c) for c in falta[:4]))
    if len(faltas) > 1:
        det += " · además, %d meta(s) más incompletas" % (len(faltas) - 1)
    return {"titulo": "Meta de logros incompleta", "detalle": det,
            "fuerza": 0.95, "familia": "normas", "sin_frecuencia": True,
            "nota": "componentes exigidos según el catálogo 3.3.5"}


def r_meta_fechas(p):
    """Una meta no puede estar fechada antes que su último componente."""
    reglas = CATALOGO_VALIDO or CATALOGO
    ids = p["logros"]
    malas = []
    for a, componentes in reglas.items():
        if a not in ids or not all(c in ids for c in componentes):
            continue
        ultima = max(ids[c] for c in componentes)
        if ids[a] < ultima:
            malas.append((a, ultima, ids[a]))
    if not malas:
        return None
    a, ultima, fecha = min(malas, key=lambda x: x[1] - x[2])
    return {"titulo": "Meta fechada antes que sus componentes",
            "detalle": "«%s» es del %s, pero su último componente es del %s" % (
                _nombre(a), fecha, ultima),
            "fuerza": 0.95, "familia": "normas", "sin_frecuencia": True,
            "nota": "una meta se concede al completar su último requisito"}


ESCALERAS = [
    ("niveles", (6, 7, 8, 9, 10, 11, 12, 13)),
    ("emblemas", (3838, 3839, 3840, 3841, 3842, 3843)),
    ("misiones", (503, 504, 505)),
    ("fragmentos de vigilante", (2085, 2086, 2087)),
    ("reputaciones exaltadas", (523, 524)),
    ("dinero reunido", (1176, 1177, 1178, 1180)),
]


def r_escaleras(p):
    ids = p["logros"]
    rotas = []
    for nombre, cadena in ESCALERAS:
        if not all(i in ids for i in cadena):
            continue
        fechas = [ids[i] for i in cadena]
        if fechas != sorted(fechas):
            rotas.append(nombre)
    if rotas:
        return {"titulo": "Escalera con fechas fuera de orden",
                "detalle": "Series acumulativas que retroceden: %s" % ", ".join(rotas),
                "fuerza": 0.85, "familia": "normas", "sin_frecuencia": True,
                "nota": "cada tramo exige el anterior, así que su fecha no puede ser anterior"}


def r_reputaciones(p):
    pares = [(524, 10, "10 reputaciones Exaltado"), (523, 5, "5 reputaciones Exaltado")]
    for aid, minimo, texto in pares:
        if aid in p["logros"] and p["reps_exaltadas"] < minimo:
            return {"titulo": "Logro de reputaciones sin las reputaciones",
                    "detalle": "«%s» exige %d Exaltadas y solo tiene %d" % (
                        texto, minimo, p["reps_exaltadas"]),
                    "fuerza": 0.90, "familia": "normas", "sin_frecuencia": True,
                    "nota": "se cuentan las reputaciones actuales del perfil"}
    return None


def _ala_por_jefe(jefe):
    j = (jefe or "").lower()
    for clave, ala in JEFES_ICC:
        if clave in j:
            return ala
    return None


def _requisitos_objeto(jefe, ilvl):
    """Logros que respaldan un objeto; basta con uno de la lista."""
    j = (jefe or "").lower()
    if "halion" in j:
        if ilvl >= 284:
            return [4816]
        if ilvl >= 271:
            return [4815, 4818]
        if ilvl >= 258:
            return [4817]
        return []
    ala = _ala_por_jefe(jefe)
    if not ala:
        return []
    tabla = ALAS_ICC[ala]
    if ilvl >= 277:
        return [tabla["25H"]]
    if ilvl >= 271:
        # 271 = 25 normal o 10 heroico (Rey Exánime); en el resto de alas solo 10H
        return [tabla["25N"], tabla["10H"]]
    if ilvl >= 264:
        return [tabla["25N"], tabla["10H"]]
    if ilvl >= 251:
        return [tabla["10N"]]
    return []


JEFES_TOC = ("icehowl", "gormok", "acidmaw", "dreadscale", "jaraxxus",
             "fjola", "eydis", "anub'arak")
LOGROS_TOC = set(range(4577, 4583)) | {4615, 4616, 4617, 4618, 4619, 4620, 4622}
JEFES_DE_ALA = {
    "tormenta": "Marrowgar, Deathwhisper, Cañones y Saurfang",
    "peste": "Festergut, Rotface y Putricida",
    "sangre": "el Consejo de Príncipes y la Reina de Sangre",
    "escarcha": "Valithria y Sindragosa",
    "trono": "el Rey Exánime",
}

NUM_JEFES = {"tormenta": 4, "peste": 3, "sangre": 2, "escarcha": 2, "trono": 1}


def r_objetos(p):
    """Objetos de banda sin el logro que los respalde.

    Ojo: los logros de ala exigen completar el ala entera, así que un objeto de
    un jefe intermedio NO demuestra nada. Solo es concluyente cuando el ala la
    cierra un único jefe (Rey Exánime, Halion) o cuando hay objetos de varios
    jefes del ala. Se pondera en consecuencia.
    """
    if not FUENTES:
        return None
    ids = set(p["logros"])
    grupos = {}
    for eid, nv, nom in p["objetos"]:
        f = FUENTES.get(str(eid))
        if not f:
            continue
        jefe = re.sub(r" \(\d\)$", "", f.get("jefe", ""))
        req = _requisitos_objeto(f.get("jefe", ""), nv or f.get("ilvl") or 0)
        if not req or set(req) & ids:
            continue
        clave = tuple(sorted(req))
        g = grupos.setdefault(clave, {"req": req, "jefes": {}, "items": []})
        g["jefes"].setdefault(jefe, []).append(nom)
        g["items"].append((nom, nv, jefe))
    if not grupos:
        return None

    partes, fuerza = [], 0.0
    for clave, g in grupos.items():
        req = g["req"]
        jefes = list(g["jefes"])
        ala = _ala_por_jefe(jefes[0])
        es_halion = "halion" in jefes[0].lower()
        unico = ala == "trono"
        if unico:
            f = 0.70
        elif es_halion:
            f = 0.30          # RS tiene mini-jefes: el objeto puede no ser de Halion
        elif len(jefes) >= NUM_JEFES.get(ala, 99):
            f = 0.60
        elif len(jefes) >= 2:
            f = 0.30
        else:
            f = 0.15
        fuerza = max(fuerza, f)
        nom, nv, jefe = g["items"][0]
        pedido = " o ".join("«%s»" % _nombre(r) for r in req)
        if unico:
            texto = "posee «%s» (ilvl %d, cae de %s) sin %s" % (nom, nv, jefe, pedido)
        elif es_halion:
            texto = ("posee «%s» (ilvl %d, atribuido a Halion) sin %s; Ruby Sanctum tiene "
                     "mini-jefes, así que el objeto puede no ser de Halion") % (nom, nv, pedido)
        else:
            texto = ("posee «%s» (ilvl %d, cae de %s) y no tiene %s, que exige %s; "
                     "un objeto de un jefe intermedio no implica el ala") % (
                nom, nv, jefe, pedido, JEFES_DE_ALA.get(ala, "completar el ala"))
        if len(g["items"]) > 1:
            texto += " (%d objeto(s) de esta ala)" % len(g["items"])
        partes.append(texto)

    partes.sort(key=lambda s: 0 if "no implica el ala" not in s else 1)
    det = "; ".join(partes[:2])
    if len(partes) > 2:
        det += "; y %d ala(s) más" % (len(partes) - 2)
    return {"titulo": "Objetos sin el logro que los respalde",
            "detalle": det, "fuerza": fuerza, "familia": "objetos",
            "sin_frecuencia": True,
            "nota": "puede venir de tienda o de un jefe suelto; se anota como indicio"}


def r_hk(p):
    """La escalera de HK es automática: el logro exige el contador."""
    pasados = [(a, m) for a, m in HK_LOGROS if a in p["logros"] and p["muertes"] < m]
    if pasados:
        a, m = max(pasados, key=lambda x: x[1])
        return {"titulo": "Logro de muertes con honor sin las muertes",
                "detalle": "«%s» exige %d HK y el perfil registra %d" % (
                    _nombre(a), m, p["muertes"]),
                "fuerza": 0.95, "familia": "normas", "sin_frecuencia": True,
                "nota": "el contador de HK del perfil es el campo «muertes»"}
    # al revés: si tiene las HK, el logro automático debería estar
    faltan = [(a, m) for a, m in HK_LOGROS if a not in p["logros"] and p["muertes"] >= m]
    if faltan:
        a, m = max(faltan, key=lambda x: x[1])
        return {"titulo": "Logro automático de HK ausente",
                "detalle": "%d HK registradas y no tiene «%s» (%d)" % (
                    p["muertes"], _nombre(a), m),
                "fuerza": 0.30, "familia": "normas"}
    return None


def r_toc(p):
    """Equipo de la Cruzada 25 heroico sin logros de la Cruzada.

    Los logros de ToC son condicionales (no por jefe), así que unos pocos
    pueden faltar sin problema. Pero llevar muchas piezas de 258 y casi
    ningún logro de la banda no cuadra con haberla limpiado.
    """
    piezas = sum(1 for e, nv, _nom in p["objetos"]
                 if nv == 258 and str(e) in FUENTES
                 and any(j in (FUENTES[str(e)].get("jefe") or "").lower() for j in JEFES_TOC))
    if piezas < 4:
        return None
    logros = len(LOGROS_TOC & set(p["logros"]))
    if piezas >= 10 and logros == 0:
        fuerza = 0.75
    elif piezas >= 10 and logros <= 1:
        fuerza = 0.65
    elif piezas >= 6 and logros == 0:
        fuerza = 0.55
    elif logros == 0:
        fuerza = 0.40
    else:
        return None
    return {"titulo": "Equipo de la Cruzada sin logros de la Cruzada",
            "detalle": "lleva %d objetos de la Cruzada 25 heroico (ilvl 258) y solo %d logro(s) de esa banda" % (
                piezas, logros),
            "fuerza": fuerza, "familia": "objetos",
            "nota": "los logros de ToC son condicionales, pero 15 piezas sin la banda acreditada no cuadra"}


def r_niveles(p):
    if not all(i in p["logros"] for i in NIVELES):
        return None
    if [p["logros"][i] for i in NIVELES] == sorted(p["logros"][i] for i in NIVELES):
        return None
    return {"titulo": "Escalera de niveles desordenada",
            "detalle": "Los logros de nivel 10-80 no siguen el orden",
            "fuerza": 0.90, "familia": "progresion"}


def r_doble_spec(p):
    d = _delta(p, DOBLE_SPEC, 9)
    if d is not None and d < 0:
        return {"titulo": "Doble especialización antes del nivel 40",
                "detalle": "2716 (%s) antes del nivel 40 (%s)" % (
                    p["logros"][DOBLE_SPEC], p["logros"][9]),
                "fuerza": 0.90, "familia": "progresion"}
    return None


def r_raides_antes_80(p):
    if NIVEL_80 not in p["logros"]:
        return None
    antes = sum(1 for i, f in p["logros"].items()
                if f < p["logros"][NIVEL_80] and i not in NIVELES)
    if antes > 60:
        return {"titulo": "Decenas de logros antes del nivel 80",
                "detalle": "%d logros (sin contar niveles) anteriores a llegar a 80" % antes,
                "fuerza": 0.70, "familia": "progresion"}
    return None


def r_fechas_imposibles(p):
    futuros = [i for i, f in p["logros"].items() if p["extraido"] and f > p["extraido"]]
    if futuros:
        return {"titulo": "Logros con fecha futura",
                "detalle": "%d logro(s) posteriores a la extracción del perfil" % len(futuros),
                "fuerza": 0.99, "familia": "progresion"}
    antiguos = [i for i, f in p["logros"].items() if f < INICIO_LOGROS]
    if antiguos:
        return {"titulo": "Logros anteriores a la existencia de los logros",
                "detalle": "%d logro(s) fechados antes del parche 3.0.2" % len(antiguos),
                "fuerza": 0.99, "familia": "progresion"}
    return None


def r_lote(p):
    """Retirada: el honor y los puntos de arena pueden estar a 0 por gasto o
    reinicio de temporada, así que no es un indicio. Se deja por historial."""
    return None


REGLAS = [r_metas, r_meta_fechas, r_escaleras, r_reputaciones, r_hk,
          r_emblema_vs_emblema, r_emblema_antes_80, r_primer_emblema_antes_80,
          r_escalera_emblemas, r_500_rapido, r_algalon, r_meta_icc25, r_meta_icc10hc,
          r_277, r_niveles, r_doble_spec, r_raides_antes_80, r_fechas_imposibles,
          r_objetos, r_toc]


# --------------------------------------------------------------------------
# Métricas
# --------------------------------------------------------------------------
def metricas(p):
    fechas = sorted(set(p["logros"].values()))
    hueco = max(((b - a).days for a, b in zip(fechas, fechas[1:])), default=0)
    por_dia = collections.Counter(p["logros"].values())
    anios = collections.Counter(f.year for f in p["logros"].values())
    ilv = [nv for _, nv, _ in p["objetos"]]
    return {
        "logros": len(p["logros"]),
        "objetos": len(p["objetos"]),
        "dias": len(fechas),
        "racha": max(por_dia.values()) if por_dia else 0,
        "hueco": hueco,
        "densidad": len(p["logros"]) / max(1, len(fechas)),
        "cuota_anio": (max(anios.values()) / len(p["logros"])) if p["logros"] else 0,
        "ilvl_max": max(ilv) if ilv else 0,
        "ilvl_sin_bultos": (max(ilv) if ilv else 0) - len(p["objetos"]),
    }


def _percentil(valor, ordenados):
    if not ordenados:
        return 0.0
    return bisect.bisect_left(ordenados, valor) / max(1, len(ordenados) - 1)


RAREZAS = [("ilvl_sin_bultos", 0.10), ("densidad", 0.08), ("racha", 0.07),
           ("hueco", 0.06), ("cuota_anio", 0.05)]


# --------------------------------------------------------------------------
# Corpus
# --------------------------------------------------------------------------
class Corpus:
    def __init__(self, perfiles=None):
        self.perfiles = list(perfiles or [])
        self.errores = []
        self._recalcular()

    @classmethod
    def desde_rutas(cls, rutas, progreso=None):
        perfiles, errores = [], []
        rutas = list(rutas)
        for i, r in enumerate(rutas, 1):
            try:
                perfiles.append(leer_perfil(r))
            except Exception as exc:
                errores.append("%s: %s" % (Path(r).name, exc))
            if progreso and (i % 25 == 0 or i == len(rutas)):
                progreso(i, len(rutas))
        c = cls(perfiles)
        c.errores = errores
        return c

    # -- preparación -------------------------------------------------------
    def _recalcular(self):
        self.n = len(self.perfiles)
        for p in self.perfiles:
            for k, v in p["nombres"].items():
                if v:
                    NOMBRES.setdefault(k, v)
        ruta_nombres = Path(__file__).with_name("nombres_logros.json")
        if not ruta_nombres.exists() and NOMBRES:
            try:
                ruta_nombres.write_text(json.dumps(
                    {str(k): v for k, v in sorted(NOMBRES.items())}, ensure_ascii=False),
                    encoding="utf-8")
            except OSError:
                pass
        self.metricas = [metricas(p) for p in self.perfiles]
        self.orden = {k: sorted(m[k] for m in self.metricas) for k, _ in RAREZAS}

        self._buscar_clones()

        # tasas base medidas solo sobre perfiles NO clonados, para no
        # normalizar el fraude: si casi todos son copias, "frecuente" no
        # significa "normal".
        limpios = [p for i, p in enumerate(self.perfiles) if self.grupo[i] == -1]
        if len(limpios) < 100:
            limpios = self.perfiles
        self.base = {}
        for fn in REGLAS:
            self.base[fn.__name__] = sum(1 for p in limpios if fn(p))
        self.n_base = len(limpios)

        # Validar el catalogo contra el corpus: una norma solo se usa si los
        # perfiles no clonados que tienen la meta cumplen TODOS sus componentes.
        # Asi se descartan criterios opcionales y errores de parseo.
        CATALOGO_VALIDO.clear()
        for a, componentes in CATALOGO.items():
            con = [p for p in limpios if a in p["logros"]]
            if len(con) < 5:
                continue
            malos = sum(1 for p in con if any(c not in p["logros"] for c in componentes))
            if malos / len(con) <= 0.02:
                CATALOGO_VALIDO[a] = componentes

    def _buscar_clones(self):
        n = self.n
        self.parecido = [[] for _ in range(n)]
        self.grupo = [-1] * n
        if n < 2:
            return

        freq = collections.Counter()
        for p in self.perfiles:
            freq.update(p["logros"].keys())

        # bloqueo por los 6 logros más raros: dos clones comparten casi todos
        buckets = collections.defaultdict(list)
        for i, p in enumerate(self.perfiles):
            for a in sorted(p["logros"], key=lambda x: freq[x])[:6]:
                buckets[a].append(i)

        pares = set()
        for lista in buckets.values():
            if len(lista) < 2:
                continue
            for x in range(len(lista)):
                for y in range(x + 1, len(lista)):
                    i, j = lista[x], lista[y]
                    pares.add((i, j) if i < j else (j, i))

        padre = list(range(n))

        def raiz(x):
            while padre[x] != x:
                padre[x] = padre[padre[x]]
                x = padre[x]
            return x

        for i, j in pares:
            a, b = self.perfiles[i], self.perfiles[j]
            if a["url"] and a["url"] == b["url"]:
                continue                       # misma migración extraída dos veces
            if a["nombre"].lower() == b["nombre"].lower() and a["reino"] == b["reino"]:
                continue                       # mismo personaje, dos extracciones
            com = set(a["logros"]) & set(b["logros"])
            if len(com) < 40:
                continue
            jac = len(com) / len(set(a["logros"]) | set(b["logros"]))
            if jac < 0.65:
                continue
            deltas = collections.Counter((a["logros"][k] - b["logros"][k]).days for k in com)
            modo, veces = deltas.most_common(1)[0]
            cobertura = veces / len(com)
            if cobertura < 0.80:
                continue
            union_m = set(a["monturas"]) | set(b["monturas"])
            mj = (len(set(a["monturas"]) & set(b["monturas"])) / len(union_m)) if union_m else 0.0
            self.parecido[i].append((j, jac, cobertura, modo, len(com), mj))
            self.parecido[j].append((i, jac, cobertura, -modo, len(com), mj))
            ri, rj = raiz(i), raiz(j)
            if ri != rj:
                padre[ri] = rj

        for i in range(n):
            self.parecido[i].sort(key=lambda x: -x[1])
        conteo = collections.Counter(raiz(i) for i in range(n))
        for i in range(n):
            r = raiz(i)
            self.grupo[i] = r if conteo[r] > 1 else -1

    def tam_grupo(self, i):
        g = self.grupo[i]
        return sum(1 for x in self.grupo if x == g) if g != -1 else 1

    def _huellas(self, p, q, monturas):
        """Coincidencias exactas con el clon: lo que el falsificador no cambió."""
        h = []
        if p["logros"].get(NIVEL_10) and p["logros"].get(NIVEL_10) == q["logros"].get(NIVEL_10):
            h.append("Misma fecha de Nivel 10 (%s)" % p["logros"][NIVEL_10])
        if p["nombre_remoto"] and p["nombre_remoto"].lower() == q["nombre_remoto"].lower():
            h.append("Mismo nombre remoto (%s)" % p["nombre_remoto"])
        if p["oro"] and p["oro"] == q["oro"]:
            h.append("Oro idéntico hasta el cobre (%.0f)" % p["oro"])
        for campo, etiqueta in (("honor", "Honor"), ("arena", "Arena"), ("muertes", "Muertes")):
            if p[campo] and p[campo] == q[campo]:
                h.append("%s idénticas (%d)" % (etiqueta, p[campo]))
        if monturas:
            h.append("Monturas: %.0f%% en común" % (100 * monturas))
        return h

    # -- evaluación --------------------------------------------------------
    def evaluar(self, p):
        hallazgos = []
        for fn in REGLAS:
            h = fn(p)
            if not h:
                continue
            if h.get("sin_frecuencia"):
                h["veces"] = None
                h["tasa"] = None
            else:
                veces = self.base.get(fn.__name__, 0)
                h["veces"] = veces
                h["tasa"] = veces / max(1, self.n_base)
            hallazgos.append(h)

        idx = next((i for i, q in enumerate(self.perfiles) if q is p), None)
        huellas = []
        if idx is not None and self.parecido[idx]:
            j, jac, cob, modo, com, mj = self.parecido[idx][0]
            otro = self.perfiles[j]
            if modo == 0:
                det = "%d de %d logros compartidos con las MISMAS fechas exactas" % (com, len(p["logros"]))
                fuerza = 0.70
            else:
                det = "%d de %d logros compartidos, con TODAS las fechas desplazadas %+d días (%.0f%%)" % (
                    com, len(p["logros"]), modo, 100 * cob)
                fuerza = 0.75
            hallazgos.append({
                "titulo": "Clon de %s" % otro["nombre"],
                "detalle": "%s · %s %s · %s · grupo de %d personajes" % (
                    det, otro["raza"], otro["clase"], otro["reino"], self.tam_grupo(idx)),
                "fuerza": fuerza, "familia": "clon",
                "veces": None, "tasa": None,
                "parecido": jac, "delta": modo,
            })
            huellas = self._huellas(p, otro, mj)

        # rareza estadística: informativa, nunca decisiva
        m = metricas(p)
        for clave, peso in RAREZAS:
            pc = _percentil(m[clave], self.orden[clave])
            if pc >= 0.90:
                hallazgos.append({
                    "titulo": "Rareza: %s" % ETIQUETAS[clave],
                    "detalle": "percentil %d del corpus (valor %s)" % (round(pc * 100), m[clave]),
                    "fuerza": peso, "familia": "rareza", "veces": None, "tasa": None,
                })

        por_familia = {}
        for h in hallazgos:
            if h["fuerza"] > por_familia.get(h["familia"], 0):
                por_familia[h["familia"]] = h["fuerza"]

        resto = 1.0
        for f in por_familia.values():
            resto *= (1 - f)
        nota = round(100 * (1 - resto), 1)

        if nota >= 80:
            nivel = "ALTO"
        elif nota >= 50:
            nivel = "SOSPECHOSO"
        elif nota >= 15:
            nivel = "DUDOSO"
        else:
            nivel = "LIMPIO"

        principal = max(hallazgos, key=lambda h: h["fuerza"])["familia"] if hallazgos else ""
        return {"nota": nota, "nivel": nivel, "hallazgos": hallazgos, "huellas": huellas,
                "metricas": m, "principal": principal, "n_corpus": self.n,
                "n_base": self.n_base, "familia": FAMILIAS.get(principal, "")}

    def ordenar(self):
        filas = [(p, self.evaluar(p)) for p in self.perfiles]
        filas.sort(key=lambda x: -x[1]["nota"])
        return filas


ETIQUETAS = {
    "ilvl_sin_bultos": "equipo de alto nivel con pocos objetos",
    "densidad": "logros concentrados en pocos días",
    "racha": "muchos logros en un solo día",
    "hueco": "hueco largo sin logros",
    "cuota_anio": "concentración en un año",
}


# --------------------------------------------------------------------------
# Informe
# --------------------------------------------------------------------------
def informe(p, ev):
    l = ["%s — %s (%s %s, nivel %s)" % (
        p["nombre"], p["reino"], p["raza"], p["clase"], p["nivel"] or "?"), ""]
    l.append("VEREDICTO: %s  (nota %.1f/100)" % (ev["nivel"], ev["nota"]))
    if ev["principal"]:
        l.append("Motivo principal: %s" % ev["familia"])
    l.append("")

    pruebas = [h for h in ev["hallazgos"] if h["fuerza"] >= 0.80]
    indicios = [h for h in ev["hallazgos"] if 0.50 <= h["fuerza"] < 0.80]
    anomalias = [h for h in ev["hallazgos"] if h["fuerza"] < 0.50]

    for titulo, grupo in [("PRUEBAS", pruebas), ("INDICIOS", indicios),
                          ("ANOMALÍAS (se anotan aunque sean frecuentes)", anomalias)]:
        if not grupo:
            continue
        l.append(titulo)
        for h in sorted(grupo, key=lambda x: -x["fuerza"]):
            l.append("  [%d%%] %s" % (round(h["fuerza"] * 100), h["titulo"]))
            l.append("        %s" % h["detalle"])
            if h.get("nota"):
                l.append("        %s" % h["nota"])
            if h.get("tasa") is not None:
                if ev.get("n_base", 0) < 30:
                    l.append("        frecuencia no calculable: carga más perfiles")
                else:
                    l.append("        presente en %d de %d perfiles no clonados (%.1f%%)" % (
                        h["veces"], ev["n_base"], 100 * h["tasa"]))
            l.append("")
    if not ev["hallazgos"]:
        l += ["Sin indicios. No significa que sea auténtico: un perfil bien", "falsificado no deja contradicciones internas.", ""]

    if ev.get("huellas"):
        l.append("HUELLAS QUE COINCIDEN CON EL CLON")
        for h in ev["huellas"]:
            l.append("  · %s" % h)
        l.append("")

    m = ev["metricas"]
    l += ["DATOS", "  %d logros en %d días | %d objetos | ilvl máx %d" % (
        m["logros"], m["dias"], m["objetos"], m["ilvl_max"]),
        "  HK %d | honor %d | arena %d | oro %.0f" % (
            p["muertes"], p["honor"], p["arena"], p["oro"])]
    return "\n".join(l)


def listar_json(rutas):
    vistos, salida = set(), []
    for r in rutas:
        r = Path(r)
        candidatos = sorted(r.glob("*.json")) if r.is_dir() else [r]
        for c in candidatos:
            clave = str(c.resolve()).lower()
            if clave not in vistos and c.suffix.lower() == ".json":
                vistos.add(clave)
                salida.append(c)
    return salida
