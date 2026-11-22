// Motor de verificacion de migraciones - WoW 3.3.5
// Portado de motor.py. No compara entre perfiles: solo valida el personaje
// contra las normas de los logros, las reputaciones, el HK y el botin.
"use strict";

const NIVELES = [6, 7, 8, 9, 10, 11, 12, 13];
const NIVEL_80 = 13;
const DOBLE_SPEC = 2716;
const EMBLEMA_1 = 3838;
const ESCALERA_EMBLEMAS = [3838, 3839, 3840, 3841, 3842, 3843];
const EMBLEMATIC = 4785;
const ALGALON = 3036;
const GUARDIANES = 2890;
const ALAS_ICC25 = [4604, 4605, 4606, 4607, 4597];
const ALAS_ICC25_HC = [4632, 4633, 4634, 4635];
const ALAS_ICC10_HC = [4628, 4629, 4630, 4631, 4583];
const META_ICC25 = 4608;
const META_ICC10_HC = 4636;
const ANILLOS = new Set([50398, 50399, 50400, 50401, 50402, 50403,
                         52570, 52571, 52572, 52573, 52574, 52575]);

const HK_LOGROS = [[238, 1], [513, 100], [515, 500], [516, 1000], [512, 5000],
                   [509, 10000], [239, 25000], [869, 50000], [870, 100000]];

const ESCALERAS = [
  ["niveles", [6, 7, 8, 9, 10, 11, 12, 13]],
  ["emblemas", [3838, 3839, 3840, 3841, 3842, 3843]],
  ["misiones", [503, 504, 505]],
  ["fragmentos de vigilante", [2085, 2086, 2087]],
  ["reputaciones exaltadas", [523, 524]],
  ["dinero reunido", [1176, 1177, 1178, 1180]],
];

const ALAS_ICC = {
  tormenta: { "25N": 4604, "25H": 4632, "10N": 4531, "10H": 4628 },
  peste: { "25N": 4605, "25H": 4633, "10N": 4528, "10H": 4629 },
  sangre: { "25N": 4606, "25H": 4634, "10N": 4529, "10H": 4630 },
  escarcha: { "25N": 4607, "25H": 4635, "10N": 4527, "10H": 4631 },
  trono: { "25N": 4597, "25H": 4584, "10N": 4530, "10H": 4583 },
};

const JEFES_ICC = [
  ["marrowgar", "tormenta"], ["deathwhisper", "tormenta"], ["gunship", "tormenta"],
  ["saurfang", "tormenta"], ["festergut", "peste"], ["rotface", "peste"],
  ["putricide", "peste"], ["keleseth", "sangre"], ["valanar", "sangre"],
  ["taldaram", "sangre"], ["lana'thel", "sangre"], ["dreamwalker", "escarcha"],
  ["sindragosa", "escarcha"], ["lich king", "trono"],
];

const JEFES_TOC = ["icehowl", "gormok", "acidmaw", "dreadscale", "jaraxxus",
                   "fjola", "eydis", "anub'arak"];
const LOGROS_TOC = new Set([4577, 4578, 4579, 4580, 4581, 4582,
                            4615, 4616, 4617, 4618, 4619, 4620, 4622]);

const JEFES_DE_ALA = {
  tormenta: "Marrowgar, Deathwhisper, Cañones y Saurfang",
  peste: "Festergut, Rotface y Putricida",
  sangre: "el Consejo de Príncipes y la Reina de Sangre",
  escarcha: "Valithria y Sindragosa",
  trono: "el Rey Exánime",
};
const NUM_JEFES = { tormenta: 4, peste: 3, sangre: 2, escarcha: 2, trono: 1 };

const FAMILIAS = {
  normas: "Normas de logros",
  emblema: "Emblemas",
  ulduar: "Ulduar",
  icc: "Progresión ICC",
  progresion: "Progresión general",
  objetos: "Objetos sin respaldo",
  banco: "Acumulación BoE (posible banco)",
};

// ---------------------------------------------------------------- utilidades
const METAS = Object.entries(CATALOGO)
  .filter(([, v]) => Array.isArray(v) && v.length)
  .map(([k, v]) => [Number(k), v]);

function aFecha(s) {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(String(s).trim());
  if (!m) return null;
  return m[3] + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[1]).padStart(2, "0");
}

function dias(a, b) {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
}

function numero(s) {
  const n = parseInt(String(s).replace(/[.\s]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function nombre(id, p) {
  const k = String(id);
  return NOMBRES[k] || (p && p.nombres && p.nombres.get(Number(id))) || k;
}

function lista(ids, p) {
  return ids.map((i) => "«" + nombre(i, p) + "»").join(", ");
}

function delta(p, a, b) {
  const fa = p.logros.get(a), fb = p.logros.get(b);
  return fa && fb ? dias(fa, fb) : null;
}

// ------------------------------------------------------------------- parser
function campos(linea) {
  const t = linea.split("\t").map((x) => x.trim());
  if (t.length >= 2) return t;
  return linea.split(/\s{2,}/).map((x) => x.trim());
}

// Al copiar la ficha desde el navegador, entre una etiqueta y su valor puede
// quedar una linea en blanco. Devuelve la siguiente linea CON texto.
function siguienteTexto(lineas, i) {
  for (let j = i + 1; j < lineas.length; j++) {
    if (lineas[j]) return lineas[j];
  }
  return "";
}

function parsear(texto) {
  const lineas = String(texto).replace(/\r/g, "").split("\n")
    .map((l) => l.replace(/\u00a0/g, " ").trim());

  const p = {
    nombre: "", reino: "", clase: "", raza: "", nivel: 0,
    remoto: "", servidorOrigen: "", reinoOrigen: "", genero: "",
    locale: "", build: "",
    hk: 0, honor: 0, arena: 0, oro: 0,
    logros: new Map(), nombres: new Map(),
    objetos: [], reps: [], emblemas: [], habilidades: [],
    monturas: [], hechizos: [], logs: [],
    extraido: null, errores: [],
  };

  const cab = /Información del Personaje:\s*(.+?)\s*-\s*\(([^)]+)\)/.exec(texto);
  if (cab) {
    p.nombre = cab[1].trim();
    p.reino = cab[2].trim();
  }
  const estado = lineas.find((l) => /^La migración ha (sido|entrado)/i.test(l) && !/^\(WEB\)/.test(l));
  p.estadoMigracion = estado || "";

  let seccion = "";
  for (let i = 0; i < lineas.length; i++) {
    const s = lineas[i];
    if (!s) continue;

    if (s === "Migrador Logs") { seccion = "logs"; continue; }
    if (s === "Problemas con los Objetos de la Migración") { seccion = "objetos"; continue; }
    if (s === "Emblemas del personaje") { seccion = "emblemas"; continue; }
    if (s === "Habilidades") { seccion = "habilidades"; continue; }
    if (s === "Reputaciones") { seccion = "reps"; continue; }
    if (s === "Monturas y Compañeros") { seccion = "monturas"; continue; }
    if (s === "Hechizos de Clase") { seccion = "hechizos"; continue; }
    if (s === "Logros") { seccion = "logros"; continue; }

    const sig = siguienteTexto(lineas, i);
    if (s === "Clase") { p.clase = sig; continue; }
    if (s === "Raza") { p.raza = sig; continue; }
    if (s === "Nivel") { p.nivel = numero(sig); continue; }
    if (s === "Muertes") { p.hk = numero(sig); continue; }
    if (s === "Puntos de Honor") { p.honor = numero(sig); continue; }
    if (s === "Puntos de Arena") { p.arena = numero(sig); continue; }
    if (s === "Oro") { p.oro = numero(sig); continue; }
    if (s === "Genero") { p.genero = sig; continue; }
    if (s === "Locale") { p.locale = sig; continue; }
    if (s === "Build") { p.build = sig; continue; }
    if (s === "Reino") { p.reinoOrigen = sig; continue; }
    if (s === "Nombre del PJ en el Servidor Remoto") { p.remoto = sig; continue; }
    if (s === "Servidor del que Provienes") { p.servidorOrigen = sig; continue; }

    if (seccion === "logros") {
      // La fecha va, segun como copie el navegador, en la misma linea que el
      // logro o en la siguiente ("Nivel 10\t" + salto + "19-06-2025").
      const m = /^(\d+)\t(\d+)\t(.+?)(?:\t(.*))?$/.exec(s);
      if (m) {
        const resto = (m[4] || "").trim();
        let textoFecha = (/(\d{1,2}-\d{1,2}-\d{4})\b/.exec(resto) || [])[1] || "";
        if (!textoFecha) {
          const posterior = siguienteTexto(lineas, i);
          textoFecha = (/(\d{1,2}-\d{1,2}-\d{4})\b/.exec(posterior) || [])[1] || "";
        }
        const f = aFecha(textoFecha);
        const id = Number(m[2]);
        if (f) {
          p.logros.set(id, f);
          p.nombres.set(id, m[3].trim());
        }
        continue;
      }
    } else if (seccion === "objetos") {
      // El nombre o el ilvl pueden venir vacios (objetos que no estan en la
      // base): se aceptan igual y se muestran por su ID.
      const t = s.split("\t");
      if (t.length >= 5 && /^\d+$/.test(t[0]) && /^\d+$/.test(t[1]) && /^\d+$/.test(t[3])) {
        p.objetos.push({
          id: Number(t[1]), nombre: (t[2] || "").trim(),
          cantidad: numero(t[3]), ilvl: numero(t[4]),
          opcion: (t[6] || t[5] || "").trim(),
        });
        continue;
      }
    } else if (seccion === "emblemas") {
      // Igual que los objetos: la moneda puede venir sin nombre.
      const t = s.split("\t");
      if (t.length >= 4 && /^\d+$/.test(t[0]) && /^\d+$/.test(t[1]) && /^\d+$/.test(t[3])) {
        p.emblemas.push({
          id: Number(t[1]), nombre: (t[2] || "").trim(),
          cantidad: numero(t[3]),
        });
        continue;
      }
    } else if (seccion === "habilidades") {
      // # \t Maximo \t Actual \t Nombre \t Enlace
      // El nombre se queda con lo que haya hasta el tabulador: el enlace
      // (que en el texto pegado es "Ver Habilidad") va aparte.
      const m = /^(\d+)\t(\d+)\t(\d+)\t([^\t]*)\t?([^\t]*)/.exec(s);
      if (m) {
        p.habilidades.push({
          max: numero(m[2]), actual: numero(m[3]),
          nombre: m[4].trim(), enlace: (m[5] || "").trim(),
        });
        continue;
      }
    } else if (seccion === "monturas") {
      const m = /^(\d+)\t(\d+)\t/.exec(s);
      if (m) { p.monturas.push(Number(m[2])); continue; }
    } else if (seccion === "hechizos") {
      const m = /^(\d+)\t(\d+)\t/.exec(s);
      if (m) { p.hechizos.push(Number(m[2])); continue; }
    } else if (seccion === "logs") {
      const m = /^(\d+)\t(.+?)\t(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?)/.exec(s);
      if (m) {
        p.logs.push({ estado: m[2].trim(), fecha: m[3] });
        const d = m[3].slice(0, 10);
        if (!p.extraido || d > p.extraido) p.extraido = d;
        continue;
      }
    } else if (seccion === "reps") {
      const t = campos(s);
      if (t.length >= 3 && /^\d+$/.test(t[0]) && /^-?\d+$/.test(t[t.length - 1])) {
        p.reps.push({ nombre: t[1], valor: numero(t[t.length - 1]) });
        continue;
      }
    }

    const f = /(\d{4})-(\d{2})-(\d{2})[ T]\d{2}:\d{2}/.exec(s);
    if (f) {
      const d = f[1] + "-" + f[2] + "-" + f[3];
      if (!p.extraido || d > p.extraido) p.extraido = d;
    }
  }

  if (!p.clase || !p.raza) {
    const cr = lineas.find((l) => /^[A-ZÁÉÍÓÚÑ][\wáéíóúñ' ]+ - [A-ZÁÉÍÓÚÑ][\wáéíóúñ' ]+$/.test(l));
    if (cr) {
      const [c, r] = cr.split(" - ");
      p.clase = p.clase || c;
      p.raza = p.raza || r;
    }
  }
  if (p.logros.size === 0) p.errores.push("No se encontró la tabla de logros.");
  if (p.objetos.length === 0) p.errores.push("No se encontró la tabla de objetos.");
  return p;
}

// ------------------------------------------------------------------- reglas
function rMetas(p) {
  const faltas = [];
  for (const [a, comps] of METAS) {
    if (!p.logros.has(a)) continue;
    const falta = comps.filter((c) => !p.logros.has(c));
    if (falta.length) faltas.push([a, falta, comps.length]);
  }
  if (!faltas.length) return null;
  faltas.sort((x, y) => x[1].length - y[1].length || y[2] - x[2]);
  const [a, falta, total] = faltas[0];
  let det = "«" + nombre(a, p) + "» exige " + total + " logros y le faltan " + falta.length +
            ": " + lista(falta.slice(0, 4), p);
  if (faltas.length > 1) det += " · además, " + (faltas.length - 1) + " meta(s) más incompletas";
  return { titulo: "Meta de logros incompleta", detalle: det, fuerza: 0.95,
           familia: "normas", ids: [a, ...falta],
           nota: "componentes exigidos según el catálogo 3.3.5" };
}

function rMetaFechas(p) {
  const malas = [];
  for (const [a, comps] of METAS) {
    if (!p.logros.has(a) || !comps.every((c) => p.logros.has(c))) continue;
    const ultima = comps.map((c) => p.logros.get(c)).sort().pop();
    if (p.logros.get(a) < ultima) malas.push([a, ultima, p.logros.get(a)]);
  }
  if (!malas.length) return null;
  malas.sort((x, y) => dias(y[1], y[2]) - dias(x[1], x[2]));
  const [a, ultima, fecha] = malas[0];
  return { titulo: "Meta fechada antes que sus componentes",
           detalle: "«" + nombre(a, p) + "» es del " + fecha + ", pero su último componente es del " + ultima,
           fuerza: 0.95, familia: "normas", ids: [a],
           nota: "una meta se concede al completar su último requisito" };
}

function rEscaleras(p) {
  const rotas = [];
  const ids = [];
  for (const [nom, cadena] of ESCALERAS) {
    if (!cadena.every((i) => p.logros.has(i))) continue;
    const fechas = cadena.map((i) => p.logros.get(i));
    if (fechas.some((f, i) => i > 0 && f < fechas[i - 1])) {
      rotas.push(nom);
      ids.push(...cadena);
    }
  }
  if (!rotas.length) return null;
  return { titulo: "Escalera con fechas fuera de orden",
           detalle: "Series acumulativas que retroceden: " + rotas.join(", "),
           fuerza: 0.85, familia: "normas", ids,
           nota: "cada tramo exige el anterior, así que su fecha no puede ser anterior" };
}

function rReputaciones(p) {
  const exaltadas = p.reps.filter((r) => r.valor >= 42000).length;
  for (const [aid, minimo, texto] of [[524, 10, "10 reputaciones Exaltado"], [523, 5, "5 reputaciones Exaltado"]]) {
    if (p.logros.has(aid) && exaltadas < minimo) {
      return { titulo: "Logro de reputaciones sin las reputaciones",
               detalle: "«" + texto + "» exige " + minimo + " Exaltadas y solo tiene " + exaltadas,
               fuerza: 0.90, familia: "normas", ids: [aid],
               nota: "se cuentan las reputaciones actuales del perfil" };
    }
  }
  return null;
}

function rHK(p) {
  const pasados = HK_LOGROS.filter(([a, m]) => p.logros.has(a) && p.hk < m);
  if (pasados.length) {
    const [a, m] = pasados.sort((x, y) => y[1] - x[1])[0];
    return { titulo: "Logro de muertes con honor sin las muertes",
             detalle: "«" + nombre(a, p) + "» exige " + m + " HK y el perfil registra " + p.hk,
             fuerza: 0.95, familia: "normas", ids: [a],
             nota: "el campo «Muertes» de la página son muertes con honor (HK)" };
  }
  const faltan = HK_LOGROS.filter(([a, m]) => !p.logros.has(a) && p.hk >= m);
  if (faltan.length) {
    const [a, m] = faltan.sort((x, y) => y[1] - x[1])[0];
    return { titulo: "Logro automático de HK ausente",
             detalle: p.hk + " HK registradas y no tiene «" + nombre(a, p) + "» (" + m + ")",
             fuerza: 0.30, familia: "normas" };
  }
  return null;
}

function rEmblemaVs(p) {
  const d = delta(p, EMBLEMATIC, EMBLEMA_1);
  if (d === null || d === 0) return null;
  const det = d < 0
    ? "Emblematic (" + p.logros.get(EMBLEMATIC) + ") es " + (-d) + " día(s) ANTERIOR al primer emblema (" + p.logros.get(EMBLEMA_1) + ")"
    : "Emblematic (" + p.logros.get(EMBLEMATIC) + ") llega " + d + " día(s) después del primer emblema (" + p.logros.get(EMBLEMA_1) + ")";
  return { titulo: "Emblematic descuadrado con el primer emblema", detalle: det,
           fuerza: 0.90, familia: "emblema", ids: [EMBLEMATIC, EMBLEMA_1] };
}

function rEmblema80(p) {
  const d = delta(p, EMBLEMATIC, NIVEL_80);
  if (d !== null && d < 0) {
    return { titulo: "Emblematic antes del nivel 80",
             detalle: "Emblematic (" + p.logros.get(EMBLEMATIC) + ") es anterior al nivel 80 (" + p.logros.get(NIVEL_80) + ")",
             fuerza: 0.85, familia: "emblema", ids: [EMBLEMATIC, NIVEL_80] };
  }
  return null;
}

function rPrimerEmblema80(p) {
  const d = delta(p, EMBLEMA_1, NIVEL_80);
  if (d !== null && d < 0) {
    return { titulo: "Primer emblema antes del nivel 80",
             detalle: "El primer emblema (" + p.logros.get(EMBLEMA_1) + ") es anterior al nivel 80 (" + p.logros.get(NIVEL_80) + ")",
             fuerza: 0.75, familia: "emblema", ids: [EMBLEMA_1, NIVEL_80] };
  }
  return null;
}

function rEscaleraEmblemas(p) {
  if (!ESCALERA_EMBLEMAS.every((i) => p.logros.has(i))) return null;
  const fechas = ESCALERA_EMBLEMAS.map((i) => p.logros.get(i));
  if (fechas.every((f, i) => i === 0 || f >= fechas[i - 1])) return null;
  return { titulo: "Escalera de emblemas desordenada",
           detalle: "25/50/100/250/500 emblemas con fechas fuera de orden",
           fuerza: 0.90, familia: "emblema", ids: ESCALERA_EMBLEMAS };
}

function r500Rapido(p) {
  const d = delta(p, 3843, EMBLEMA_1);
  if (d !== null && d < 7) {
    return { titulo: "500 emblemas en menos de una semana",
             detalle: "3843 (500 emblemas) solo " + d + " día(s) después del primero",
             fuerza: 0.90, familia: "emblema", ids: [3843, EMBLEMA_1] };
  }
  return null;
}

function rAlgalon(p) {
  if (p.logros.has(ALGALON) && !p.logros.has(GUARDIANES)) {
    return { titulo: "Algalon sin los Guardianes de Ulduar",
             detalle: "Algalon (3036) exige la llave del Planetario Celestial; no tiene 2890",
             fuerza: 0.80, familia: "ulduar", ids: [ALGALON, GUARDIANES] };
  }
  return null;
}

function rMetaICC25(p) {
  if (p.logros.has(META_ICC25) && !ALAS_ICC25.every((i) => p.logros.has(i))) {
    const faltan = ALAS_ICC25.filter((i) => !p.logros.has(i));
    return { titulo: "Meta de ICC 25 sin sus alas",
             detalle: "Rey Exánime 25 (4608) sin los logros " + faltan.join(", "),
             fuerza: 0.95, familia: "icc", ids: [META_ICC25, ...ALAS_ICC25] };
  }
  return null;
}

function rMetaICC10HC(p) {
  if (p.logros.has(META_ICC10_HC) && !ALAS_ICC10_HC.every((i) => p.logros.has(i))) {
    const faltan = ALAS_ICC10_HC.filter((i) => !p.logros.has(i));
    return { titulo: "Meta heroica de ICC 10 sin sus alas",
             detalle: "4636 sin los logros " + faltan.join(", "),
             fuerza: 0.95, familia: "icc", ids: [META_ICC10_HC, ...ALAS_ICC10_HC] };
  }
  return null;
}

function r277(p) {
  const piezas = p.objetos.filter((o) => o.ilvl === 277 && !ANILLOS.has(o.id));
  if (piezas.length && !ALAS_ICC25_HC.some((i) => p.logros.has(i))) {
    return { titulo: "Botín 277 sin alas de ICC 25 heroico",
             detalle: piezas.length + " pieza(s) de ICC 25 HC sin ningún ala 25HC (hay tiendas: pesa poco)",
             fuerza: 0.20, familia: "icc", objs: piezas.map((x) => x.id) };
  }
  return null;
}

function rNiveles(p) {
  if (!NIVELES.every((i) => p.logros.has(i))) return null;
  const fechas = NIVELES.map((i) => p.logros.get(i));
  if (fechas.every((f, i) => i === 0 || f >= fechas[i - 1])) return null;
  return { titulo: "Escalera de niveles desordenada",
           detalle: "Los logros de nivel 10-80 no siguen el orden",
           fuerza: 0.90, familia: "progresion", ids: NIVELES };
}

function rDobleSpec(p) {
  const d = delta(p, DOBLE_SPEC, 9);
  if (d !== null && d < 0) {
    return { titulo: "Doble especialización antes del nivel 40",
             detalle: "2716 (" + p.logros.get(DOBLE_SPEC) + ") antes del nivel 40 (" + p.logros.get(9) + ")",
             fuerza: 0.90, familia: "progresion", ids: [DOBLE_SPEC, 9] };
  }
  return null;
}

function rRaides80(p) {
  if (!p.logros.has(NIVEL_80)) return null;
  const lvl = p.logros.get(NIVEL_80);
  let antes = 0;
  for (const [i, f] of p.logros) {
    if (f < lvl && !NIVELES.includes(i)) antes++;
  }
  if (antes > 60) {
    return { titulo: "Decenas de logros antes del nivel 80",
             detalle: antes + " logros (sin contar niveles) anteriores a llegar a 80",
             fuerza: 0.70, familia: "progresion" };
  }
  return null;
}

function rFechas(p) {
  if (p.extraido) {
    const futuros = [...p.logros.entries()].filter(([, f]) => f > p.extraido);
    if (futuros.length) {
      return { titulo: "Logros con fecha futura",
               detalle: futuros.length + " logro(s) posteriores a la extracción del perfil",
               fuerza: 0.99, familia: "progresion", ids: futuros.map((x) => x[0]) };
    }
  }
  const antiguos = [...p.logros.entries()].filter(([, f]) => f < "2008-10-14");
  if (antiguos.length) {
    return { titulo: "Logros anteriores a la existencia de los logros",
             detalle: antiguas.length + " logro(s) fechados antes del parche 3.0.2",
             fuerza: 0.99, familia: "progresion", ids: antiguas.map((x) => x[0]) };
  }
  return null;
}

function alaPorJefe(jefe) {
  const j = (jefe || "").toLowerCase();
  for (const [clave, ala] of JEFES_ICC) if (j.includes(clave)) return ala;
  return null;
}

function requisitosObjeto(jefe, ilvl) {
  const j = (jefe || "").toLowerCase();
  if (j.includes("halion")) {
    if (ilvl >= 284) return [4816];
    if (ilvl >= 271) return [4815, 4818];
    if (ilvl >= 258) return [4817];
    return [];
  }
  const ala = alaPorJefe(jefe);
  if (!ala) return [];
  const t = ALAS_ICC[ala];
  if (ilvl >= 277) return [t["25H"]];
  if (ilvl >= 271) return [t["25N"], t["10H"]];
  if (ilvl >= 264) return [t["25N"], t["10H"]];
  if (ilvl >= 251) return [t["10N"]];
  return [];
}

function rObjetos(p) {
  const grupos = new Map();
  for (const o of p.objetos) {
    const f = FUENTES[String(o.id)];
    if (!f) continue;
    const jefe = (f.jefe || "").replace(/ \(\d\)$/, "");
    const req = requisitosObjeto(f.jefe, o.ilvl || f.ilvl || 0);
    if (!req.length || req.some((r) => p.logros.has(r))) continue;
    const clave = req.slice().sort((a, b) => a - b).join(",");
    if (!grupos.has(clave)) grupos.set(clave, { req, jefes: new Map(), items: [] });
    const g = grupos.get(clave);
    if (!g.jefes.has(jefe)) g.jefes.set(jefe, []);
    g.jefes.get(jefe).push(o.nombre);
    g.items.push([o.nombre, o.ilvl, jefe, o.id]);
  }
  if (!grupos.size) return null;

  const partes = [];
  let fuerza = 0;
  for (const g of grupos.values()) {
    const jefes = [...g.jefes.keys()];
    const ala = alaPorJefe(jefes[0]);
    const esHalion = jefes[0].toLowerCase().includes("halion");
    const unico = ala === "trono";
    let f;
    if (unico) f = 0.70;
    else if (esHalion) f = 0.30;
    else if (jefes.length >= (NUM_JEFES[ala] || 99)) f = 0.60;
    else if (jefes.length >= 2) f = 0.30;
    else f = 0.15;
    fuerza = Math.max(fuerza, f);
    const [nom, nv, jefe] = g.items[0];
    const pedido = g.req.map((r) => "«" + nombre(r, p) + "»").join(" o ");
    let texto;
    if (unico) {
      texto = "posee «" + nom + "» (ilvl " + nv + ", cae de " + jefe + ") sin " + pedido;
    } else if (esHalion) {
      texto = "posee «" + nom + "» (ilvl " + nv + ", atribuido a Halion) sin " + pedido +
              "; Ruby Sanctum tiene mini-jefes, así que el objeto puede no ser de Halion";
    } else {
      texto = "posee «" + nom + "» (ilvl " + nv + ", cae de " + jefe + ") y no tiene " + pedido +
              ", que exige " + (JEFES_DE_ALA[ala] || "completar el ala") +
              "; un objeto de un jefe intermedio no implica el ala";
    }
    if (g.items.length > 1) texto += " (" + g.items.length + " objeto(s) de esta ala)";
    partes.push({ texto, unico });
  }
  partes.sort((a, b) => (a.unico === b.unico ? 0 : a.unico ? -1 : 1));
  let det = partes.slice(0, 2).map((x) => x.texto).join("; ");
  if (partes.length > 2) det += "; y " + (partes.length - 2) + " ala(s) más";
  return { titulo: "Objetos sin el logro que los respalde", detalle: det,
           fuerza, familia: "objetos",
           objs: [...grupos.values()].flatMap((g) => g.items.map((i) => i[3])),
           nota: "puede venir de tienda o de un jefe suelto; se anota como indicio" };
}

function rTOC(p) {
  const piezas = [];
  for (const o of p.objetos) {
    if (o.ilvl !== 258) continue;
    const f = FUENTES[String(o.id)];
    if (!f) continue;
    const j = (f.jefe || "").toLowerCase();
    if (JEFES_TOC.some((k) => j.includes(k))) piezas.push(o.id);
  }
  if (piezas < 4) return null;
  let logros = 0;
  for (const i of LOGROS_TOC) if (p.logros.has(i)) logros++;
  let fuerza;
  if (piezas >= 10 && logros === 0) fuerza = 0.75;
  else if (piezas >= 10 && logros <= 1) fuerza = 0.65;
  else if (piezas >= 6 && logros === 0) fuerza = 0.55;
  else if (logros === 0) fuerza = 0.40;
  else return null;
  return { titulo: "Equipo de la Cruzada sin logros de la Cruzada",
           detalle: "lleva " + piezas.length + " objetos de la Cruzada 25 heroico (ilvl 258) y solo " +
                    logros + " logro(s) de esa banda",
           fuerza, familia: "objetos", objs: piezas,
           nota: "los logros de ToC son condicionales, pero tantas piezas sin la banda acreditada no cuadra" };
}

function rBoE(p) {
  // Acumulacion de objetos BoE: posible personaje banco.
  // Un BoE se compra en la subasta o se fabrica con profesiones, asi que por si
  // solo no prueba nada. Pero un personaje con media partida de BoE epicos de
  // nivel 80 en el inventario no es un jugador: es un almacen.
  if (!BOE) return null;
  const distintos = new Map();
  let unidades = 0;
  const slots = new Set();
  const origenes = new Map();

  for (const o of p.objetos) {
    const info = BOE[String(o.id)];
    if (!info) continue;
    const cant = o.cantidad || 0;
    if (cant <= 0) continue;                 // fila con 0: el objeto no migra
    distintos.set(o.id, { nombre: info.nombre || o.nombre, cant });
    unidades += cant;
    slots.add(info.slot || "");
    const origen = info.origen || "?";
    origenes.set(origen, (origenes.get(origen) || 0) + 1);
  }

  const n = distintos.size;
  if (n < 8) return null;

  let titulo, fuerza;
  if (n >= 20) {
    titulo = "Acumulación de objetos BoE (posible migración banco)";
    fuerza = 0.80;
  } else if (n >= 12) {
    titulo = "Acumulación de objetos BoE";
    fuerza = 0.45;
  } else {
    titulo = "Objetos BoE en el inventario";
    fuerza = 0.25;
  }

  const top = [...distintos.values()].sort((a, b) => b.cant - a.cant || a.nombre.localeCompare(b.nombre));
  const nombres = top.slice(0, 3).map((x) => "«" + x.nombre + "»").join(", ");
  const repes = top.filter((x) => x.cant >= 2).length;
  const prof = origenes.get("Profesión") || 0;
  const raid = origenes.get("Raid") || 0;
  let detalle = `${n} objeto(s) BoE de nivel 80 (${unidades} unidades, ${slots.size} ranura(s) distintas` +
                (repes ? `, ${repes} repetido(s)` : "") + `): ${nombres}`;
  if (top.length > 3) detalle += ` y ${top.length - 3} más`;
  detalle += ` · ${prof} de profesiones, ${raid} de banda`;

  return { titulo, detalle, fuerza, familia: "banco", objs: [...distintos.keys()],
           nota: "los BoE se compran en la subasta: indica un personaje-banco (motivo de rechazo " +
                 "por política), no que los logros sean falsos" };
}

const REGLAS = [rMetas, rMetaFechas, rEscaleras, rReputaciones, rHK,
                rEmblemaVs, rEmblema80, rPrimerEmblema80, rEscaleraEmblemas, r500Rapido,
                rAlgalon, rMetaICC25, rMetaICC10HC, r277, rNiveles, rDobleSpec,
                rRaides80, rFechas, rObjetos, rTOC, rBoE];

function analizar(p) {
  const hallazgos = [];
  for (const fn of REGLAS) {
    try {
      const h = fn(p);
      if (h) hallazgos.push(h);
    } catch (e) {
      p.errores.push("Regla " + fn.name + ": " + e.message);
    }
  }

  const familias = {};
  for (const h of hallazgos) familias[h.familia] = Math.max(familias[h.familia] || 0, h.fuerza);
  let resto = 1;
  for (const f of Object.values(familias)) resto *= 1 - f;
  const nota = Math.round((1 - resto) * 1000) / 10;

  let nivel = "LIMPIO";
  if (nota >= 80) nivel = "ALTO";
  else if (nota >= 50) nivel = "SOSPECHOSO";
  else if (nota >= 15) nivel = "DUDOSO";

  const principal = hallazgos.length
    ? hallazgos.reduce((a, b) => (b.fuerza > a.fuerza ? b : a)).familia
    : "";

  return { nota, nivel, hallazgos, familia: FAMILIAS[principal] || "", principal };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parsear, analizar };
}
