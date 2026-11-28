"use strict";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const ENTIDADES = {
  "&": "&#38;",
  "<": "&#60;",
  ">": "&#62;",
  '"': "&#34;",
};
const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ENTIDADES[c] || c);

// Logros que el motor usa como referencia: se resaltan en la tabla de logros.
const LOGROS_CLAVE = {
  6: "nivel", 7: "nivel", 8: "nivel", 9: "nivel", 10: "nivel", 11: "nivel",
  12: "nivel", 13: "nivel",
  238: "HK", 513: "HK", 515: "HK", 516: "HK", 512: "HK", 509: "HK",
  239: "HK", 869: "HK", 870: "HK",
  3838: "emblemas", 3839: "emblemas", 3840: "emblemas", 3841: "emblemas",
  3842: "emblemas", 3843: "emblemas",
  4785: "Emblematic", 3036: "Algalon", 2890: "Ulduar", 2716: "doble espec.",
  4608: "meta ICC", 4636: "meta ICC",
  4604: "ala ICC", 4605: "ala ICC", 4606: "ala ICC", 4607: "ala ICC", 4597: "ala ICC",
  4632: "ala ICC", 4633: "ala ICC", 4634: "ala ICC", 4635: "ala ICC",
  4628: "ala ICC", 4629: "ala ICC", 4630: "ala ICC", 4631: "ala ICC", 4583: "ala ICC",
  523: "reputaciones", 524: "reputaciones",
  503: "misiones", 504: "misiones", 505: "misiones",
  2085: "fragmentos", 2086: "fragmentos", 2087: "fragmentos",
};

// ------------------------------------------------------------------ helpers
function numeros(p, r) {
  const ids = new Set(), objs = new Set();
  for (const h of r.hallazgos) {
    (h.ids || []).forEach((i) => ids.add(i));
    (h.objs || []).forEach((i) => objs.add(i));
  }
  const boe = new Set();
  for (const o of p.objetos) {
    if ((o.cantidad || 0) > 0 && BOE[String(o.id)]) boe.add(o.id);
  }
  return { ids, objs, boe };
}

function bloqueHallazgos(titulo, lista, clase) {
  if (!lista.length) return "";
  const filas = lista.map((h) => `
    <div class="hallazgo ${clase}">
      <div class="peso">${Math.round(h.fuerza * 100)}%</div>
      <div>
        <h4>${esc(h.titulo)}</h4>
        <p>${esc(h.detalle)}</p>
        ${h.nota ? `<p class="porque">${esc(h.nota)}</p>` : ""}
        ${miniaturasHallazgo(h)}
      </div>
    </div>`).join("");
  return `<div class="bloque"><h3>${esc(titulo)}</h3>${filas}</div>`;
}

// Miniaturas de los objetos y logros que sostienen el hallazgo: el revisor
// los ve de un vistazo y decide si el indicio tiene sentido.
function miniaturasHallazgo(h) {
  const partes = [];
  if (h.objs && h.objs.length) {
    const vistos = new Set();
    for (const id of h.objs) {
      if (vistos.has(id)) continue;
      vistos.add(id);
      const ic = iconoItem(id);
      if (!ic) continue;
      partes.push(`<a class="icono-enlace" href="${esc(enlaceWowhead("objeto", id))}" ` +
                  `target="_blank" rel="noopener noreferrer" title="Objeto ${esc(id)} · abrir en Wowhead">` +
                  `<img class="icono miniatura" src="iconos/${esc(ic)}.jpg" alt="" loading="lazy" ` +
                  `width="20" height="20" ` +
                  `onerror="this.style.visibility='hidden'"></a>`);
      if (partes.length >= 24) break;
    }
  }
  if (h.ids && h.ids.length) {
    for (const id of h.ids) {
      const ic = iconoLogro(id);
      if (!ic) continue;
      partes.push(`<a class="icono-enlace" href="${esc(enlaceWowhead("logro", id))}" ` +
                  `target="_blank" rel="noopener noreferrer" title="Logro ${esc(id)} · abrir en Wowhead">` +
                  `<img class="icono miniatura" src="iconos/${esc(ic)}.jpg" alt="" loading="lazy" ` +
                  `width="20" height="20" ` +
                  `onerror="this.style.visibility='hidden'"></a>`);
      if (partes.length >= 30) break;
    }
  }
  if (!partes.length) return "";
  return `<div class="miniaturas">${partes.join("")}</div>`;
}

function resumenLinea(p, r) {
  return `${p.nombre || "?"} — ${p.reino || "?"} (${p.clase || "?"} ${p.raza || "?"}, nivel ${p.nivel || "?"})`;
}

// Fila para la hoja de trabajo: un dato por columna, en el orden que pide el
// Excel. Se copia en una sola linea con tabuladores, asi al pegar cada valor
// cae en su columna. El logro 6 es «Nivel 10»; el nombre interno es el de la
// ficha (el que el personaje tiene en Thalassa).
function filaExcel(p) {
  const columnas = [
    p.remoto,                            // nombre externo (servidor de origen)
    p.clase,
    p.raza,
    p.servidorOrigen || p.reinoOrigen,   // servidor del que proviene
    p.logros.get(6) || "",               // fecha del logro «Nivel 10»
    p.nombre,                            // nombre interno en Thalassa
  ];
  return columnas
    .map((v) => String(v == null ? "" : v).replace(/[\t\r\n]+/g, " ").trim())
    .join("\t");
}

// Mensaje para reclamar una migración en el foro. El nombre del personaje
// sustituye al hueco de la plantilla; si no se pudo leer, se usa el remoto.
function mensajeReclamacion(p) {
  const nombre = (p.nombre || p.remoto || "jugador").trim();
  return `Hola ${nombre}!

Si ya has publicado tu reclamación en el foro de Migraciones, puedes ignorar este mensaje.

En primer lugar, queremos aclararte que tu migración NO HA SIDO RECHAZADA DEFINITIVAMENTE. El rechazo inicial forma parte del proceso habitual de revisión del Departamento de Migraciones y no implica necesariamente que no puedas continuar con el trámite.

Para seguir con el proceso, debes publicar una reclamación en el subforo de Migraciones. Te dejamos los enlaces necesarios:

Subforo de Migraciones: https://naerzone.com/subforo/151/migraciones.html

Plantilla de reclamación: https://naerzone.com/post/151/151402/reclamaciones-gratuitas.html

Guía y normativa de Migraciones: https://naerzone.com/post/151/133977/guia-y-normativa-migraciones.html

Recuerda que es obligatorio utilizar la plantilla indicada y completar todos los apartados correspondientes.

Por último, te recomendamos revisar la guía y normativa, donde encontrarás respuesta a la mayoría de las dudas habituales. Si aun así necesitas ayuda, puedes crear un hilo en el subforo de Migraciones utilizando la etiqueta «Duda» y plantear allí tus consultas. Estaremos encantados de ayudarte. 🙂

--------------
Departamento De Migraciones
NaerZone.`;
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

function informeTexto(p, r) {
  const lineas = [
    resumenLinea(p, r),
    "",
    `VEREDICTO: ${r.nivel} (${r.nota.toFixed(1)}/100)${r.familia ? " — " + r.familia : ""}`,
    "",
  ];
  const grupos = [
    ["PRUEBAS", r.hallazgos.filter((h) => h.fuerza >= 0.8)],
    ["INDICIOS", r.hallazgos.filter((h) => h.fuerza >= 0.5 && h.fuerza < 0.8)],
    ["ANOMALÍAS", r.hallazgos.filter((h) => h.fuerza < 0.5)],
  ];
  for (const [titulo, lista] of grupos) {
    if (!lista.length) continue;
    lineas.push(titulo);
    for (const h of lista) {
      lineas.push(`  [${Math.round(h.fuerza * 100)}%] ${h.titulo}`);
      lineas.push(`      ${h.detalle}`);
      if (h.nota) lineas.push(`      ${h.nota}`);
    }
    lineas.push("");
  }
  if (!r.hallazgos.length) {
    lineas.push("Sin indicios. Un perfil bien falsificado no deja contradicciones internas.", "");
  }
  lineas.push(`Datos: ${p.logros.size} logros, ${p.objetos.length} objetos, ${p.hk} HK, ` +
              `${p.honor} honor, ${p.arena} arena, ${p.oro} oro.`);
  return lineas.join("\n");
}

// ------------------------------------------------------------------- resumen
function renderResumen(p, r) {
  const pruebas = r.hallazgos.filter((h) => h.fuerza >= 0.8);
  const indicios = r.hallazgos.filter((h) => h.fuerza >= 0.5 && h.fuerza < 0.8);
  const anomalias = r.hallazgos.filter((h) => h.fuerza < 0.5);
  const exaltadas = p.reps.filter((x) => x.valor >= 42000).length;

  const veredicto = `
    <div class="veredicto ${r.nivel}">
      <div class="nota">${r.nota.toFixed(1)}</div>
      <div>
        <div class="nivel">${r.nivel}</div>
        <div class="quien">${nombreClase(p)} · ${esc(p.reino || "?")} ·
          ${esc(p.clase || "?")} ${esc(p.raza || "?")} · nivel ${p.nivel || "?"}</div>
        <div class="motivo">${r.familia ? "Motivo principal: " + esc(r.familia) : "Sin hallazgos"}</div>
      </div>
    </div>`;

  const datos = `
    <div class="bloque">
      <h3>Datos del personaje</h3>
      <div class="datos">
        <div class="dato"><b>${p.logros.size}</b><span>logros</span></div>
        <div class="dato"><b>${p.objetos.length}</b><span>objetos</span></div>
        <div class="dato"><b>${p.hk}</b><span>HK</span></div>
        <div class="dato"><b>${p.honor}</b><span>honor</span></div>
        <div class="dato"><b>${p.arena}</b><span>arena</span></div>
        <div class="dato"><b>${p.oro}</b><span>oro</span></div>
        <div class="dato"><b>${exaltadas}</b><span>exaltadas</span></div>
        <div class="dato"><b>${p.reps.length}</b><span>reputaciones</span></div>
      </div>
    </div>`;

  return veredicto
    + bloqueHallazgos("Pruebas", pruebas, "prueba")
    + bloqueHallazgos("Indicios", indicios, "indicio")
    + bloqueHallazgos("Anomalías · se anotan aunque sean frecuentes", anomalias, "anomalia")
    + datos
    + `<div class="barra-inferior">
         <button id="copiar" class="secundario">Copiar informe</button>
         <button id="otra" class="secundario">Analizar otro</button>
       </div>`;
}

// ------------------------------------------------------------------- perfil
function barraFila(nombre, valor, maximo, clase, sufijo, icono) {
  const pct = maximo > 0 ? Math.min(100, (valor / maximo) * 100) : 0;
  return `<div class="barra-fila">
    <span class="barra-nombre">${icono || ""}${esc(nombre)}</span>
    <span class="barra ${clase || ""}"><i style="width:${pct.toFixed(1)}%"></i></span>
    <span class="valor">${valor}${sufijo || ""}</span>
  </div>`;
}

function histogramaLogros(p) {
  const porMes = new Map();
  for (const [, f] of p.logros) {
    const mes = f.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) || 0) + 1);
  }
  const meses = [...porMes.keys()].sort();
  if (!meses.length) return "";
  const max = Math.max(...meses.map((m) => porMes.get(m)));
  const salto = Math.max(1, Math.ceil(meses.length / 12));
  const cols = meses.map((m, i) => {
    const n = porMes.get(m);
    const alto = Math.round((n / max) * 100);
    const etiq = (i % salto === 0 || i === meses.length - 1)
      ? `<span>${m.slice(2).replace("-", "/")}</span>` : "<span></span>";
    return `<div class="col" title="${m}: ${n} logro(s)">${etiq}<i style="height:${Math.max(3, alto)}%"></i></div>`;
  }).join("");
  return `<div class="histograma">${cols}</div>
    <p class="pie-mini">${meses.length} mes(es) · máximo ${max} logros en un mes · de ${meses[0]} a ${meses[meses.length - 1]}</p>`;
}

// ------------------------------------------------------- iconos del perfil
// La ficha llega en español y con variantes ("PALADIN", "SHAMAN", "Elfo
// Nocturno", "Human"), así que se compara todo sin acentos ni mayúsculas.
const _normal = (s) => String(s == null ? "" : s).toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const CLASE_ICONO = {
  "guerrero": "classicon_warrior", "warrior": "classicon_warrior",
  "paladin": "classicon_paladin",
  "cazador": "classicon_hunter", "hunter": "classicon_hunter",
  "picaro": "classicon_rogue", "rogue": "classicon_rogue",
  "sacerdote": "classicon_priest", "priest": "classicon_priest",
  "caballero de la muerte": "classicon_deathknight", "death knight": "classicon_deathknight",
  "chaman": "classicon_shaman", "shaman": "classicon_shaman",
  "mago": "classicon_mage", "mage": "classicon_mage",
  "brujo": "classicon_warlock", "warlock": "classicon_warlock",
  "druida": "classicon_druid", "druid": "classicon_druid",
};

// Los logros de personaje del juego se llaman achievement_character_<raza>_<sexo>.
const RAZA_LOGRO = {
  "humano": "human", "human": "human",
  "enano": "dwarf",
  "elfo nocturno": "nightelf", "elfo de la noche": "nightelf",
  "gnomo": "gnome",
  "draenei": "draenei",
  "no-muerto": "undead", "no muerto": "undead",
  "tauren": "tauren",
  "trol": "troll", "troll": "troll",
  "orco": "orc",
  "elfo de sangre": "bloodelf",
};

const ICONO_CIFRA = {
  logros: "achievement_general",
  objetos: "inv_misc_bag_10",
  boe: "inv_box_02",
  exaltadas: "achievement_reputation_01",
  emblemas: "inv_misc_frostemblem_01",
  monturas: "ability_mount_ridinghorse",
  hechizos: "spell_arcane_arcane01",
  hk: "ability_dualwield",
  honor: "inv_jewelry_trinketpvp_01",
  arena: "achievement_arena_3v3_4",
  oro: "inv_misc_coin_01",
};

function iconoClase(clase) {
  return CLASE_ICONO[_normal(clase)] || "";
}

// Colores de clase del juego, para el nombre del personaje.
const COLOR_CLASE = {
  "guerrero": "#c79c6e", "warrior": "#c79c6e",
  "paladin": "#f58cba",
  "cazador": "#abd473", "hunter": "#abd473",
  "picaro": "#fff569", "rogue": "#fff569",
  "sacerdote": "#ffffff", "priest": "#ffffff",
  "caballero de la muerte": "#e04b60", "death knight": "#e04b60",
  "chaman": "#4a9ee8", "shaman": "#4a9ee8",
  "mago": "#69ccf0", "mage": "#69ccf0",
  "brujo": "#a894e6", "warlock": "#a894e6",
  "druida": "#ff7d0a", "druid": "#ff7d0a",
};

function colorClase(clase) {
  return COLOR_CLASE[_normal(clase)] || "";
}

// El nombre del personaje, con el color de su clase.
function nombreClase(p) {
  const color = colorClase(p.clase);
  const nombre = esc(p.nombre || "Sin nombre");
  return color ? `<span style="color:${color}">${nombre}</span>` : nombre;
}

// El icono de personaje del juego ya es raza + género, que es justo lo que
// resume esa fila; si la raza no se reconoce se cae al humano.
function iconoGenero(raza, genero) {
  const g = _normal(genero);
  const sexo = g.startsWith("f") ? "female" : g.startsWith("m") ? "male" : "";
  if (!sexo) return "";
  return `achievement_character_${RAZA_LOGRO[_normal(raza)] || "human"}_${sexo}`;
}

function renderPerfil(p, r) {
  const n = numeros(p, r);
  const exaltadas = p.reps.filter((x) => x.valor >= 42000).length;
  const skills = p.habilidades.filter((h) => h.max > 0);

  // Contadores con el icono que el juego usa para cada cosa.
  const cifras = [
    { v: p.logros.size, t: "logros", i: ICONO_CIFRA.logros, k: "logro" },
    { v: p.objetos.length, t: "objetos", i: ICONO_CIFRA.objetos, k: "objeto" },
    { v: n.boe.size, t: "BoE", i: ICONO_CIFRA.boe, k: "objeto", extra: n.boe.size >= 20 ? " alerta" : "" },
    { v: exaltadas, t: "exaltadas", i: ICONO_CIFRA.exaltadas, k: "logro" },
    { v: p.emblemas.length, t: "emblemas", i: ICONO_CIFRA.emblemas, k: "objeto" },
    { v: p.monturas.length, t: "monturas", i: ICONO_CIFRA.monturas, k: "hechizo" },
    { v: p.hechizos.length, t: "hechizos", i: ICONO_CIFRA.hechizos, k: "hechizo" },
    { v: p.hk, t: "HK", i: ICONO_CIFRA.hk, k: "hechizo" },
    { v: p.honor, t: "honor", i: ICONO_CIFRA.honor, k: "objeto" },
    { v: p.arena, t: "arena", i: ICONO_CIFRA.arena, k: "logro" },
    { v: p.oro, t: "oro", i: ICONO_CIFRA.oro, k: "objeto" },
  ].map((x) => `<div class="cifra${x.extra || ""}">
      <div class="cifra-topo">${etiquetaIcono(x.i, x.k, "mini")}<b>${esc(x.v)}</b></div>
      <span>${x.t}</span></div>`).join("");

  const repFilas = p.reps.slice().sort((a, b) => b.valor - a.valor);
  const repHtml = repFilas.length
    ? `<div class="barra-lista">${repFilas.map((x) => {
        const ex = x.valor >= 42000;
        return `<div class="barra-fila${ex ? " exaltada" : ""}">
          <span class="barra-nombre">${esc(x.nombre)}</span>
          <span class="barra${ex ? " exaltada" : ""}"><i style="width:${Math.min(100, (x.valor / 42000) * 100).toFixed(1)}%"></i>${
            ex ? '<b class="barra-tag">EXALTADO</b>' : ""}</span>
          <span class="valor">${x.valor}</span>
        </div>`;
      }).join("")}</div>`
    : `<p class="vacio">Sin tabla de reputaciones.</p>`;

  // Las habilidades van por bloques: clase, profesiones, armas/armaduras,
  // idiomas y el resto, cada uno con su separador.
  const porGrupo = new Map();
  for (const h of skills) {
    const g = grupoHabilidad(h.nombre, h.enlace);
    if (!porGrupo.has(g)) porGrupo.set(g, []);
    porGrupo.get(g).push(h);
  }
  const skillHtml = skills.length
    ? GRUPOS_HABILIDAD.filter((g) => porGrupo.has(g.id)).map((g) => `
        <p class="sub-titulo">${esc(g.nombre)}</p>
        <div class="barra-lista">${porGrupo.get(g.id).map((h) => barraFila(
          h.nombre, h.actual, h.max, h.actual >= h.max ? "completa" : "", ` / ${h.max}`,
          etiquetaIcono(iconoHabilidad(h.nombre, h.enlace), "hechizo", "mini"))).join("")}</div>`).join("")
    : `<p class="vacio">Sin tabla de habilidades.</p>`;

  const emblemasHtml = p.emblemas.length
    ? `<div class="chips">${p.emblemas.map((e) => {
        const enlace = enlaceWowhead("objeto", e.id);
        const nombre = e.nombre
          ? esc(e.nombre)
          : `<a class="nombre-objeto" href="${esc(enlace)}" target="_blank" rel="noopener noreferrer"
                title="Moneda no identificada · abrir en Wowhead">ID ${e.id}</a>`;
        return `<span class="chip emblema">${etiquetaIcono(iconoItem(e.id) || "inv_misc_questionmark", "objeto", "mini", enlace)}
          ${nombre} <b>×${e.cantidad}</b></span>`;
      }).join("")}</div>`
    : `<p class="vacio">Sin emblemas.</p>`;

  const monturasHtml = p.monturas.length
    ? `<div class="chips">${p.monturas.map((id) => `
        <a class="chip montura" href="${esc(enlaceWowhead("hechizo", id))}" target="_blank"
           rel="noopener noreferrer" title="Abrir en Wowhead">${etiquetaIcono(iconoSpell(id), "hechizo", "mini")}ID ${id}</a>`).join("")}</div>`
    : `<p class="vacio">Sin monturas ni compañeros.</p>`;

  const hechizosHtml = p.hechizos.length
    ? `<div class="chips">${p.hechizos.map((id) => `
        <a class="chip hechizo" href="${esc(enlaceWowhead("hechizo", id))}" target="_blank"
           rel="noopener noreferrer" title="Abrir en Wowhead">${etiquetaIcono(iconoSpell(id), "hechizo", "mini")}ID ${id}</a>`).join("")}</div>`
    : `<p class="vacio">Sin hechizos de clase.</p>`;

  const logsHtml = p.logs.length
    ? `<div class="linea-tiempo">${p.logs.map((l) => `
        <div class="evento">
          <time>${esc(l.fecha)}</time>
          <span>${esc(l.estado)}</span>
        </div>`).join("")}</div>`
    : `<p class="vacio">Sin bitácora de migración.</p>`;

  const estado = p.estadoMigracion
    ? `<div class="aviso" style="margin-bottom:14px"><b>Estado en la página:</b> ${esc(p.estadoMigracion)}</div>`
    : "";

  return estado + `
    <div class="perfil">
      <div class="ficha">
        <div class="ficha-izq">
          <div class="nombre-grande">${nombreClase(p)}</div>
          <div class="ficha-sub">${esc(p.reino || "?")} · ${etiquetaIcono(iconoClase(p.clase), "logro", "clase")}${esc(p.clase || "?")} ${esc(p.raza || "?")} · nivel ${p.nivel || "?"}</div>
          <div class="ficha-datos">
            <div><span>PJ remoto</span><b>${esc(p.remoto || "—")}</b></div>
            <div><span>Reino de origen</span><b>${esc(p.reinoOrigen || "—")}</b></div>
            <div><span>Servidor</span><b>${esc(p.servidorOrigen || "—")}</b></div>
            <div><span>Locale · Build</span><b>${esc(p.locale || "—")} · ${esc(p.build || "—")}</b></div>
            <div><span>Género</span><b>${etiquetaIcono(iconoGenero(p.raza, p.genero), "logro", "genero")}${esc(p.genero || "—")}</b></div>
            <div><span>Extraído</span><b>${esc(p.extraido || "—")}</b></div>
          </div>
        </div>
        <div class="cifras">
          ${cifras}
        </div>
        <div class="copiar-acciones">
          <button type="button" class="copiar-excel"
                  title="Copiar fila para Excel: nombre externo, clase, raza, servidor, Nivel 10 y nombre interno"
                  aria-label="Copiar fila para Excel">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4"/>
              <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19"/>
            </svg>
          </button>
          <button type="button" class="copiar-mensaje"
                  title="Copiar mensaje de reclamación para el foro"
                  aria-label="Copiar mensaje de reclamación para el foro">
            <img class="icono-mensaje" src="iconos/inv_letter_02.jpg" alt="" width="16" height="16">
          </button>
          <span class="copiar-aviso aviso-excel">Fila copiada</span>
          <span class="copiar-aviso aviso-mensaje">Mensaje copiado</span>
        </div>
      </div>

      <div class="tarjeta">
        <h3>Curva de logros</h3>
        ${histogramaLogros(p)}
      </div>

      <div class="rejilla-dos rejilla-reps">
        <div class="tarjeta tarjeta-reps">
          <h3>Reputaciones <span class="contador">${exaltadas} exaltada(s) · 42.000 = exaltado</span></h3>
          ${repHtml}
        </div>
        <div class="tarjeta">
          <h3>Habilidades</h3>
          ${skillHtml}
        </div>
      </div>

      <div class="rejilla-dos">
        <div class="tarjeta">
          <h3>Emblemas</h3>
          ${emblemasHtml}
        </div>
        <div class="tarjeta">
          <h3>Monturas y compañeros · Hechizos de clase</h3>
          <p class="sub-titulo">Monturas y compañeros</p>
          ${monturasHtml}
          <p class="sub-titulo">Hechizos</p>
          ${hechizosHtml}
        </div>
      </div>

      <div class="tarjeta">
        <h3>Bitácora de la migración</h3>
        ${logsHtml}
      </div>
    </div>`;
}

// ------------------------------------------------------------------- logros
function renderLogros(p, r) {
  const n = numeros(p, r);
  const filas = [];
  for (const [id, f] of p.logros) {
    const clave = LOGROS_CLAVE[id];
    const marca = n.ids.has(id)
      ? '<span class="chip mini alerta">en un hallazgo</span>' : "";
    filas.push({ id, nombre: p.nombres.get(id) || String(id), fecha: f, clave, marca });
  }
  filas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id));

  const cuerpo = filas.map((x) => `
    <tr data-busca="${esc(x.nombre.toLowerCase())} ${x.id} ${x.fecha}" data-id="${x.id}" data-fecha="${esc(x.fecha)}" data-filtros="${filtrosDeLogro(x.id)}">
      <td class="celda-icono">${etiquetaIcono(iconoLogro(x.id), "logro", "", enlaceWowhead("logro", x.id))}</td>
      <td class="num">${x.id}</td>
      <td>${esc(x.nombre)} ${x.clave ? `<span class="chip mini">${esc(x.clave)}</span>` : ""} ${x.marca}</td>
      <td class="num">${esc(x.fecha)}</td>
    </tr>`).join("");

  const filtros = [
    ["", "Todos"], ["icc", "ICC"], ["toc", "ToC"], ["ulduar", "Ulduar"],
    ["halion", "Halion"], ["mazmorra", "Mazmorra"], ["pvp", "PvP"],
  ];

  return `
    <div class="buscador">
      <input id="buscar-logros" type="search" placeholder="Buscar logro, ID o fecha…">
      <div class="filtros" id="filtros-logros">
        ${filtros.map(([k, t]) => `<button class="filtro${k === _filtro.raid ? " activo" : ""}" data-f="${k}"
          title="${k === "" ? "Ver todos los logros" : "Ver solo los logros de " + t}">${t}</button>`).join("")}
      </div>
      <span class="pie-mini" id="cuenta-logros">${filas.length} logros</span>
    </div>
    <div class="tarjeta">
      <h3>Curva de logros</h3>
      ${histogramaLogros(p)}
    </div>
    <div class="tabla-wrap">
      <table class="tabla">
        <thead><tr>
          <th></th>
          <th class="orden" data-orden="id" aria-sort="none" title="Ordenar por ID">ID</th>
          <th>Logro</th>
          <th class="orden" data-orden="fecha" aria-sort="none" title="Ordenar por fecha">Fecha</th>
        </tr></thead>
        <tbody id="tabla-logros">${cuerpo}</tbody>
      </table>
    </div>`;
}

// ------------------------------------------------------------------ objetos
// Estado del objeto en el catalogo del juego (web/casillas.js):
//   "casilla"  -> la clave de la casilla que ocupa
//   "material" -> esta en el catalogo pero no es equipable
//   "fuera"     -> no esta en el catalogo
function estadoCasilla(id) {
  if (typeof CASILLAS_CODIGO !== "string") return "fuera";
  const letra = CASILLAS_CODIGO[id];
  if (!letra || letra === ".") return "fuera";
  if (letra === "-") return "material";
  return "casilla";
}

// Casilla que ocupa un objeto en el personaje. "" si no se sabe.
function casillaDe(id) {
  if (estadoCasilla(id) !== "casilla") return "";
  const letra = CASILLAS_CODIGO[id];
  return CASILLAS_CLAVE[letra.charCodeAt(0) - 97] || "";
}

// Nombre visible de la casilla ("Muñecas", "Arma"...).
function nombreCasilla(clave) {
  const i = CASILLAS_CLAVE.indexOf(clave);
  return i >= 0 ? CASILLAS[i] : clave;
}

// Filtros que le corresponden a un objeto: los mismos para la tabla y para
// la vista de equipo, para que las dos vistas coincidan.
function clavesFiltro(o, n) {
  return [n.boe.has(o.id) ? "boe" : "", n.objs.has(o.id) ? "hallazgo" : "",
          o.ilvl === 277 ? "277" : "", o.ilvl === 264 ? "264" : "",
          o.ilvl >= 245 && o.ilvl <= 258 ? "245-258" : "", o.ilvl === 232 ? "232" : "",
          o.ilvl >= 226 && o.ilvl <= 239 ? "226-239" : "",
          o.ilvl >= 200 && o.ilvl <= 213 ? "200-213" : "",
          FUENTES[String(o.id)] ? "banda" : "",
          /CANCELADO/i.test(o.opcion || "") ? "cancelado" : ""].filter(Boolean);
}

function etiquetasObjeto(o, n) {
  const et = [];
  if (n.boe.has(o.id)) et.push('<span class="chip mini boe">BoE</span>');
  if (n.objs.has(o.id)) et.push('<span class="chip mini alerta">en un hallazgo</span>');
  if (o.ilvl === 277) et.push('<span class="chip mini">277</span>');
  if (o.ilvl >= 245 && o.ilvl <= 258) et.push(`<span class="chip mini">${o.ilvl}</span>`);
  const f = FUENTES[String(o.id)];
  if (f && f.jefe) et.push(`<span class="chip mini fuente">${esc(f.jefe.replace(/ \(\d\)$/, ""))}</span>`);
  return et.join(" ");
}

function renderObjetos(p, r) {
  const n = numeros(p, r);
  const cuerpo = p.objetos.map((o) => {
    const enlace = enlaceWowhead("objeto", o.id);
    // Si la página no trae el nombre (objeto fuera de la BD), se muestra el
    // ID enlazado a Wowhead y un icono de reserva.
    const nombre = o.nombre
      ? esc(o.nombre)
      : `<a class="nombre-objeto" href="${esc(enlace)}" target="_blank" rel="noopener noreferrer"
            title="Objeto no identificado · abrir en Wowhead">ID ${o.id}</a>`;
    return `
    <tr data-busca="${esc((o.nombre || "").toLowerCase())} ${o.id}"
        data-id="${o.id}" data-ilvl="${o.ilvl || 0}"
        data-filtros="${clavesFiltro(o, n).join(" ")}">
      <td class="celda-icono">${etiquetaIcono(iconoItem(o.id) || "inv_misc_questionmark", "objeto", "", enlace)}</td>
      <td class="num">${o.id}</td>
      <td>${nombre} ${etiquetasObjeto(o, n)}</td>
      <td class="num">${o.cantidad}</td>
      <td class="num">${o.ilvl || "—"}</td>
      <td class="estado-op">${o.opcion && o.opcion !== "-" ? esc(o.opcion) : ""}</td>
    </tr>`;
  }).join("");

  const filtros = [
    ["", "Todos"], ["boe", "BoE"], ["hallazgo", "En un hallazgo"], ["277", "ilvl 277"],
    ["264", "ilvl 264"], ["245-258", "ilvl 245 a 258"], ["232", "ilvl 232"],
    ["226-239", "ilvl 226 a 239"], ["200-213", "ilvl 200 a 213"],
    ["banda", "De banda"], ["cancelado", "Cancelados"],
  ];

  return `
    <div class="modo-objetos">
      <span class="modo-etiqueta">Vista</span>
      <div class="filtros" id="modos-objetos">
        <button class="filtro" data-modo="lista">Lista</button>
        <button class="filtro" data-modo="equipo">Equipo</button>
      </div>
    </div>
    <div class="buscador">
      <input id="buscar-objetos" type="search" placeholder="Buscar objeto o ID…">
      <div class="filtros" id="filtros-objetos">
        ${filtros.map(([k, t]) => `<button class="filtro${k === "" ? " activo" : ""}" data-f="${k}">${t}</button>`).join("")}
      </div>
      <span class="pie-mini" id="cuenta-objetos">${p.objetos.length} objetos</span>
    </div>
    <div id="vista-lista-objetos">
      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th></th><th>ID</th><th>Objeto</th><th>Cant.</th>
            <th class="orden" data-orden="ilvl" aria-sort="none" title="Ordenar por ilvl">ilvl</th>
            <th>Estado</th></tr></thead>
          <tbody id="tabla-objetos">${cuerpo}</tbody>
        </table>
      </div>
    </div>
    <div id="vista-equipo-objetos" class="equipo" hidden></div>`;
}

// ------------------------------------------------------------- vista equipo
// Los objetos del inventario, repartidos por la casilla que ocupan. Cada
// casilla es una tarjeta con su nombre y los objetos que le tocan, para que
// se vea de un vistazo como esta vestido el personaje.
const GRUPOS_EQUIPO = [
  { titulo: "Armadura", claves: ["cabeza", "cuello", "hombros", "espalda", "pecho",
                                  "tabardo", "camisa", "manos", "muñecas", "cintura",
                                  "piernas", "pies"] },
  { titulo: "Accesorios", claves: ["anillo", "abalorio", "reliquia"] },
  { titulo: "Armas", claves: ["arma", "escudo", "distancia"] },
  { titulo: "Otros", claves: ["bolsa", "desconocido"] },
];

// Un objeto dentro de una casilla: icono, nombre, ilvl y cantidad.
function filaEquipo(o) {
  const enlace = enlaceWowhead("objeto", o.id);
  const nombre = o.nombre
    ? esc(o.nombre)
    : `<a href="${esc(enlace)}" target="_blank" rel="noopener noreferrer"
          title="Objeto no identificado · abrir en Wowhead">ID ${o.id}</a>`;
  const etiquetas = [
    o.ilvl ? `<span class="chip mini">${o.ilvl}</span>` : "",
    o.cantidad > 1 ? `<span class="chip mini">x${o.cantidad}</span>` : "",
  ].filter(Boolean).join("");
  return `<li class="objeto-equipo">
    ${etiquetaIcono(iconoItem(o.id) || "inv_misc_questionmark", "objeto", "", enlace)}
    <span class="objeto-equipo-texto">
      <span class="objeto-equipo-nombre">${nombre}</span>
      ${etiquetas ? `<span class="objeto-equipo-tags">${etiquetas}</span>` : ""}
    </span>
  </li>`;
}

// Una casilla del personaje, con lo que el personaje lleva en ella.
function tarjetaCasilla(clave, objetos) {
  const cuerpo = objetos.length
    ? `<ul class="casilla-items">${objetos.map(filaEquipo).join("")}</ul>`
    : `<p class="casilla-vacia">vacío</p>`;
  return `<div class="casilla${objetos.length ? " con-objetos" : ""}">
    <div class="casilla-cabecera">
      <span class="casilla-nombre">${esc(nombreCasilla(clave))}</span>
      <span class="casilla-cuenta">${objetos.length}</span>
    </div>
    ${cuerpo}
  </div>`;
}

// La vista de equipo completa, respetando el buscador y el filtro activo.
function renderEquipo(p, n, consulta, filtro) {
  const q = (consulta || "").trim().toLowerCase();
  const porCasilla = new Map();
  const materiales = [];
  const fuera = [];
  for (const o of p.objetos) {
    const texto = `${(o.nombre || "").toLowerCase()} ${o.id}`;
    if (q && !texto.includes(q)) continue;
    if (filtro && !clavesFiltro(o, n).includes(filtro)) continue;
    const estado = estadoCasilla(o.id);
    if (estado === "material") { materiales.push(o); continue; }
    if (estado === "fuera") { fuera.push(o); continue; }
    const clave = casillaDe(o.id);
    if (!clave) { fuera.push(o); continue; }
    if (!porCasilla.has(clave)) porCasilla.set(clave, []);
    porCasilla.get(clave).push(o);
  }

  const grupos = GRUPOS_EQUIPO.map((g) => {
    const tarjetas = g.claves.map((c) => tarjetaCasilla(c, porCasilla.get(c) || []));
    const total = g.claves.reduce((s, c) => s + (porCasilla.get(c) || []).length, 0);
    return `<section class="grupo-equipo">
      <h4 class="grupo-equipo-titulo">${esc(g.titulo)}<span class="grupo-equipo-cuenta">${total}</span></h4>
      <div class="rejilla-casillas">${tarjetas.join("")}</div>
    </section>`;
  }).join("");

  // Materiales y objetos fuera del catalogo: no ocupan ninguna casilla, pero
  // se listan al final para que no se pierdan de vista.
  const gruposResto = [];
  if (materiales.length) {
    gruposResto.push({ titulo: "No equipables", lista: materiales });
  }
  if (fuera.length) {
    gruposResto.push({ titulo: "Fuera del catálogo", lista: fuera });
  }
  const restos = gruposResto.map((g) => `    <section class="grupo-equipo">
      <h4 class="grupo-equipo-titulo">${esc(g.titulo)}<span class="grupo-equipo-cuenta">${g.lista.length}</span></h4>
      <div class="rejilla-casillas">
        <div class="casilla con-objetos casilla-larga">
          <ul class="casilla-items">${g.lista.map(filaEquipo).join("")}</ul>
        </div>
      </div>
    </section>`).join("");

  if (!porCasilla.size && !materiales.length && !fuera.length) {
    return { html: `<p class="equipo-vacio">Ningún objeto encaja en el filtro actual.</p>`,
             casillas: 0, conCasilla: 0, restos: 0 };
  }
  const casillas = [...porCasilla.values()].filter((l) => l.length).length;
  const conCasilla = [...porCasilla.values()].reduce((s, l) => s + l.length, 0);
  return {
    html: grupos + restos,
    casillas,
    conCasilla,
    restos: materiales.length + fuera.length,
  };
}

// -------------------------------------------------------------------- pintado
const VISTAS = {
  perfil: renderPerfil,
  logros: renderLogros,
  objetos: renderObjetos,
  resumen: renderResumen,
};

// Estado del resultado actual, para poder repintar cuando lleguen los ids.
let _actual = null;
let _vistaActual = "perfil";
let _yaMostrado = false;
// La entrada escalonada solo se hace al analizar; el repintado que trae los
// iconos reutiliza el mismo HTML y no debe volver a animar.
let _primeraPintada = false;
// Lo que el revisor ha escrito o filtrado: sobrevive a los repintados.
const _filtro = { logros: "", raid: "", objetos: "", tipoObjeto: "", modoObjetos: "lista" };
// Orden de la tabla de logros: por fecha por defecto.
const _ordenLogros = { campo: "fecha", dir: 1 };
// Orden de la tabla de objetos: el de la página hasta que se pulsa ilvl.
const _ordenObjetos = { campo: "", dir: -1 };

// Reordena las filas ya pintadas, así no se pierde ni la búsqueda ni nada de
// lo que esté filtrado.
function _ordenarLogros() {
  const tbody = $("#tabla-logros");
  if (!tbody) return;
  const { campo, dir } = _ordenLogros;
  const filas = Array.from(tbody.rows);
  filas.sort((a, b) => {
    if (campo === "id") return (Number(a.dataset.id) - Number(b.dataset.id)) * dir;
    if (a.dataset.fecha === b.dataset.fecha) return Number(a.dataset.id) - Number(b.dataset.id);
    return (a.dataset.fecha < b.dataset.fecha ? -1 : 1) * dir;
  });
  const frag = document.createDocumentFragment();
  for (const f of filas) frag.appendChild(f);
  tbody.appendChild(frag);

  $$("#vista-logros th[data-orden]").forEach((th) => {
    const activa = th.dataset.orden === campo;
    th.classList.toggle("ordenado", activa);
    if (activa) th.dataset.dir = dir > 0 ? "asc" : "desc";
    else delete th.dataset.dir;
    th.setAttribute("aria-sort", activa ? (dir > 0 ? "ascending" : "descending") : "none");
  });
}

function _ordenarObjetos() {
  const tbody = $("#tabla-objetos");
  const th = $("#vista-objetos th[data-orden='ilvl']");
  if (!tbody || !th) return;
  const { campo, dir } = _ordenObjetos;

  if (campo === "ilvl") {
    const filas = Array.from(tbody.rows);
    filas.sort((a, b) => {
      const va = Number(a.dataset.ilvl) || 0;
      const vb = Number(b.dataset.ilvl) || 0;
      if (va === vb) return Number(a.dataset.id) - Number(b.dataset.id);
      return (va - vb) * dir;
    });
    const frag = document.createDocumentFragment();
    for (const f of filas) frag.appendChild(f);
    tbody.appendChild(frag);
  }

  const activa = campo === "ilvl";
  th.classList.toggle("ordenado", activa);
  if (activa) th.dataset.dir = dir > 0 ? "asc" : "desc";
  else delete th.dataset.dir;
  th.setAttribute("aria-sort", activa ? (dir > 0 ? "ascending" : "descending") : "none");
}

function pintar(p, r) {
  _actual = { p, r };
  _vistaActual = "perfil";
  // Se anima la entrada de las secciones al analizar, pero no cuando luego
  // llega el mapa de iconos y se repinta.
  _primeraPintada = true;
  _filtro.logros = "";
  _filtro.raid = "";
  _filtro.objetos = "";
  _filtro.tipoObjeto = "";
  _filtro.modoObjetos = "lista";
  _ordenObjetos.campo = "";
  _ordenObjetos.dir = -1;
  _reparto(true);
  _pintarVistas();
  _avisarIds();
}

// Reparto de anchos: con el análisis a la vista la ficha se queda en 1/3 y el
// resultado en 2/3; el botón «Ampliar» alterna sin tocar nada del análisis.
function _reparto(conResultado) {
  const rejilla = $(".rejilla");
  rejilla.classList.toggle("analizado", conResultado);
  rejilla.classList.remove("expandido");
  const b = $("#alternar-texto");
  b.hidden = !conResultado;
  b.textContent = "Ampliar";
}

// Repinta las cuatro vistas. Solo se hace al analizar y cuando llega el mapa
// de ids; cambiar de pestaña no repinta, solo muestra u oculta.
function _pintarVistas() {
  if (!_actual) return;
  const { p, r } = _actual;
  const titulos = {
    resumen: "Resumen", perfil: "Perfil", logros: "Logros", objetos: "Objetos",
  };
  const contadores = { resumen: r.hallazgos.length, perfil: 0, logros: p.logros.size, objetos: p.objetos.length };

  const pestanas = `<div class="pestanas" role="tablist">
    ${Object.keys(VISTAS).map((k) => `
      <button class="pestana${k === _vistaActual ? " activa" : ""}" data-vista="${k}" role="tab">
        ${titulos[k]}${contadores[k] ? `<span class="contador">${contadores[k]}</span>` : ""}
      </button>`).join("")}
  </div>`;

  const cuerpo = Object.keys(VISTAS).map((k) => `
    <div class="vista" id="vista-${k}"${k === _vistaActual ? "" : " hidden"}>${VISTAS[k](p, r)}</div>`).join("");

  $("#resultado").innerHTML = pestanas + cuerpo;

  $$(".pestana").forEach((b) => b.addEventListener("click", () => {
    _vistaActual = b.dataset.vista;
    $$(".pestana").forEach((x) => x.classList.toggle("activa", x === b));
    $$(".vista").forEach((v) => {
      const activa = v.id === "vista-" + b.dataset.vista;
      v.hidden = !activa;
      // Una vista que se abandona a mitad del fundido no debe quedarse con la
      // clase puesta: al volver entraria ya "animada" y sin fundido.
      if (!activa) v.classList.remove("entra-rapido");
    });
    _ajustarReps();
    const v = $("#vista-" + b.dataset.vista);
    _fundir(v);
    // La curva de esa vista vuelve a crecer al abrirla, arrancando a la par que
    // su fundido.
    _animarCurvas(v, performance.now(), 60);
  }));

  _conectarBuscadores(p, r);
  _conectarCopiar(p, r);
  _ajustarReps();

  if (!_yaMostrado) {
    _yaMostrado = true;
    $("#salida").hidden = false;
    $("#salida").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  _animarEntrada();
}

// Entrada de las secciones. Menos de medio segundo, solo opacidad y un
// desplazamiento minimo: no mueve la pagina ni retrasa la lectura.
const ENTRADA_MS = 260;    // lo que dura cada pieza
const ENTRADA_TOPE = 200;  // retraso maximo del escalonado: la entrada entera
                           // no pasa de ~460 ms
const CURVA_MS = 500;      // lo que tarda cada barra de la curva en subir
let _entrada = null;       // { inicio } mientras la entrada esta en curso
let _limpiezaEntrada = 0;  // plazo de seguridad que retira las clases
let _limpiezaFundido = 0;
let _limpiezaCurva = 0;
let _curvaFin = 0;

// Piezas que se escalonan: lo que el ojo lee como una seccion propia. Las
// pestañas y el aviso de estado van delante, aunque esten fuera de la vista
// activa o no siempre aparezcan.
function _piezasEntrada(vista) {
  return [
    ...document.querySelectorAll("#resultado > .pestanas"),
    ...vista.querySelectorAll(".aviso, .ficha, .veredicto, .bloque, .buscador, " +
                              ".modo-objetos, .tarjeta, .tabla-wrap, .grupo-equipo"),
  ];
}

// Aplica la animacion a las piezas. `desde` es el instante en que empezo la
// entrada: en un repintado se pasa para retomar cada pieza donde iba, con
// retrasos negativos, en vez de cortar la animacion o reiniciarla entera.
function _animarPiezas(vista, desde) {
  const piezas = _piezasEntrada(vista);
  // Con muchas piezas el escalonado se alargaria demasiado: se reparte en un
  // margen fijo y a partir de ahi todas entran a la vez.
  const paso = piezas.length > 8 ? 24 : 34;
  const transcurrido = desde ? performance.now() - desde : 0;

  // El reinicio se hace de golpe (una sola lectura de layout) en vez de forzar
  // un reflow por pieza.
  piezas.forEach((el) => el.classList.remove("entra"));
  void vista.offsetWidth;

  const puestas = [];
  piezas.forEach((el, i) => {
    const retraso = Math.round(Math.min(i * paso, ENTRADA_TOPE) - transcurrido);
    if (retraso + ENTRADA_MS <= 0) return;       // esta pieza ya termino: se queda visible
    el.style.setProperty("--entra-retraso", retraso + "ms");
    el.classList.add("entra");
    puestas.push({ el, retraso });
  });

  // La clase se quita al terminar cada pieza y, por si la animacion no llega a
  // disparar animationend, tambien con un plazo de seguridad: asi nunca queda
  // una seccion a medio aparecer.
  clearTimeout(_limpiezaEntrada);
  const plazo = Math.max(...puestas.map((x) => x.retraso), 0) + ENTRADA_MS + 150;
  _limpiezaEntrada = setTimeout(() => {
    for (const { el } of puestas) {
      el.classList.remove("entra");
      el.style.removeProperty("--entra-retraso");
    }
  }, plazo);
}

// Curva de logros: las barras suben desde la linea base hasta su altura. El
// escalonado va de izquierda a derecha y se reparte en un margen fijo, para que
// con muchos meses no se eternice. Igual que la entrada de las secciones, se
// retoma si el repintado rehace el HTML a mitad.
function _animarCurva(histograma, desde, base) {
  if (!histograma || _sinAnimacion()) return;
  const barras = [...histograma.querySelectorAll(".col i")];
  if (!barras.length) return;

  const paso = Math.min(18, 260 / barras.length);
  const transcurrido = desde ? performance.now() - desde : 0;

  barras.forEach((b) => b.classList.remove("sube"));
  void barras[0].offsetWidth;

  let ultimo = 0;
  barras.forEach((b, i) => {
    const retraso = Math.round((base || 0) + i * paso - transcurrido);
    if (retraso + CURVA_MS <= 0) return;         // ya crecio: se queda en su altura
    b.style.setProperty("--curva-retraso", retraso + "ms");
    b.classList.add("sube");
    ultimo = Math.max(ultimo, retraso);
  });

  _programarLimpiezaCurva(ultimo);
}

// Retira .sube de todas las barras, no solo de las de la ultima llamada: puede
// haber dos curvas (Perfil y Logros) animandose a la vez. El plazo es absoluto
// para que una llamada nueva no corte la limpieza de una anterior.
function _programarLimpiezaCurva(ultimoRetraso) {
  const fin = performance.now() + ultimoRetraso + CURVA_MS + 150;
  _curvaFin = Math.max(_curvaFin, fin);
  clearTimeout(_limpiezaCurva);
  _limpiezaCurva = setTimeout(() => {
    for (const b of document.querySelectorAll(".histograma .col i.sube")) {
      b.classList.remove("sube");
      b.style.removeProperty("--curva-retraso");
    }
    _curvaFin = 0;
  }, Math.max(0, _curvaFin - performance.now()));
}

// Las curvas de una vista, arrancando cuando su tarjeta ya esta visible.
function _animarCurvas(vista, desde, base) {
  if (!vista) return;
  for (const h of vista.querySelectorAll(".histograma")) {
    const tarjeta = h.closest(".tarjeta");
    const propio = tarjeta && parseFloat(tarjeta.style.getPropertyValue("--entra-retraso"));
    _animarCurva(h, desde, (base || 0) + (Number.isFinite(propio) ? propio : 0));
  }
}

// Cambiar de pestaña: un fundido muy corto de la vista entera, sin escalonar.
function _fundir(vista) {
  if (!vista || _sinAnimacion()) return;
  vista.classList.remove("entra-rapido");
  void vista.offsetWidth;
  vista.classList.add("entra-rapido");
  vista.addEventListener("animationend", () => vista.classList.remove("entra-rapido"), { once: true });
  // Igual que en el escalonado: si la animacion no corre (pestaña en segundo
  // plano), el plazo de seguridad devuelve la vista a la normalidad.
  clearTimeout(_limpiezaFundido);
  _limpiezaFundido = setTimeout(() => vista.classList.remove("entra-rapido"), 400);
}

function _sinAnimacion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// La entrada se lanza al analizar y se retoma si el repintado de los iconos
// rehace el HTML antes de que termine.
// La entrada se lanza al analizar. Si el repintado de los iconos rehace el HTML
// antes de que termine, se retoma donde iba en vez de cortarla o repetirla.
function _animarEntrada() {
  const primera = _primeraPintada;
  _primeraPintada = false;
  if (_sinAnimacion()) return;

  const vista = document.querySelector(".vista:not([hidden])");
  if (!vista) return;

  if (primera) {
    _entrada = { inicio: performance.now() };
  } else if (!_entrada || performance.now() - _entrada.inicio > ENTRADA_TOPE + ENTRADA_MS + 200) {
    return;                                      // ya termino: el repintado va directo
  }
  _animarPiezas(vista, _entrada.inicio);
  // La curva arranca cuando su tarjeta ya ha entrado.
  _animarCurvas(vista, _entrada.inicio, 0);
}

// El mapa de ids de objetos y hechizos pesa, asi que se carga aparte. Cuando
// llega, se repinta todo para que aparezcan los iconos.
function _avisarIds() {
  if (typeof _cargarIds !== "function") return;
  _cargarIds().then(() => {
    if (!_actual) return;
    _pintarVistas();
    // vuelve a la vista que el revisor estaba mirando
    const v = $("#vista-" + _vistaActual);
    if (v) v.hidden = false;
  });
}

// Alto que ocupa el contenido de una tarjeta, sin contar el estiron que le meta
// la rejilla. Los hijos van en flujo normal, asi que sus alturas son naturales.
function _altoNatural(tarjeta) {
  const estilo = getComputedStyle(tarjeta);
  const marco = parseFloat(estilo.paddingTop) + parseFloat(estilo.paddingBottom) +
                parseFloat(estilo.borderTopWidth) + parseFloat(estilo.borderBottomWidth);
  let alto = 0;
  for (const hijo of tarjeta.children) {
    const cs = getComputedStyle(hijo);
    alto += hijo.getBoundingClientRect().height +
            parseFloat(cs.marginTop || 0) + parseFloat(cs.marginBottom || 0);
  }
  return alto + marco;
}

// Alto al que hay que llevar la tarjeta de reputaciones para igualar la de
// habilidades. Lado a lado no vale medir la tarjeta tal cual: si la lista de
// reputaciones crece, estira la fila y la de al lado con ella (medida circular),
// asi que se suma el contenido. Apiladas no hay estiron: manda su alto real.
// Se comparan posiciones con offsetTop (no cambia con las animaciones de
// entrada) en lugar de rects.
function _altoObjetivo(tarjeta, hermana) {
  const apiladas = Math.abs(hermana.offsetTop - tarjeta.offsetTop) > 1;
  return apiladas ? hermana.getBoundingClientRect().height : _altoNatural(hermana);
}

// La tarjeta de reputaciones debe medir siempre lo mismo que la de habilidades.
// Se fija ese alto y la lista, que es flexible, ocupa el resto y scrollea si
// tiene mas filas que sitio.
function _ajustarReps() {
  const tarjeta = document.querySelector(".tarjeta-reps");
  const lista = tarjeta && tarjeta.querySelector(".barra-lista");
  if (!tarjeta || !lista) return;
  tarjeta.style.removeProperty("height");

  const caja = tarjeta.getBoundingClientRect();
  if (!caja.height) return;                        // pestana oculta: se mide al mostrarla
  const hermana = tarjeta.nextElementSibling;      // «Habilidades»
  if (!hermana) return;

  // Al fijar el alto puede aparecer o desaparecer la barra de scroll de la
  // pagina; eso cambia el ancho y el texto se recoloca, asi que la primera
  // medida se queda corta. Se repite hasta que el alto se estabilice.
  let objetivo = Math.max(320, Math.round(_altoObjetivo(tarjeta, hermana)));
  for (let i = 0; i < 4; i++) {
    tarjeta.style.height = objetivo + "px";
    const nuevo = Math.max(320, Math.round(_altoObjetivo(tarjeta, hermana)));
    if (nuevo === objetivo) break;
    objetivo = nuevo;
  }
  tarjeta.style.height = objetivo + "px";
}

function _conectarBuscadores(p, r) {
  // buscador de logros
  const bl = $("#buscar-logros");
  if (bl) {
    bl.value = _filtro.logros;
    const aplicar = () => {
      const q = _filtro.logros.trim().toLowerCase();
      let n = 0;
      $$("#tabla-logros tr").forEach((tr) => {
        const okTexto = !q || tr.dataset.busca.includes(q);
        const okRaid = !_filtro.raid || (tr.dataset.filtros || "").split(" ").includes(_filtro.raid);
        const ok = okTexto && okRaid;
        tr.hidden = !ok;
        if (ok) n++;
      });
      $("#cuenta-logros").textContent = `${n} de ${p.logros.size} logros`;
    };
    bl.addEventListener("input", () => { _filtro.logros = bl.value; aplicar(); });

    // Filtros de raid y mazmorra: Todos, ICC, ToC, Ulduar, Halion, Mazmorra y PvP.
    $$("#filtros-logros .filtro").forEach((b) => {
      b.addEventListener("click", () => {
        $$("#filtros-logros .filtro").forEach((x) => x.classList.toggle("activo", x === b));
        _filtro.raid = b.dataset.f;
        aplicar();
      });
    });

    // Orden de la tabla: fecha por defecto; ID o Fecha al pulsar la cabecera.
    $$("#vista-logros th[data-orden]").forEach((th) => {
      th.addEventListener("click", () => {
        const campo = th.dataset.orden;
        if (_ordenLogros.campo === campo) _ordenLogros.dir *= -1;
        else { _ordenLogros.campo = campo; _ordenLogros.dir = 1; }
        _ordenarLogros();
      });
    });
    _ordenarLogros();
    aplicar();
  }

  // buscador y filtros de objetos
  const bo = $("#buscar-objetos");
  if (bo) {
    bo.value = _filtro.objetos;
    const nums = numeros(p, r);
    const aplicar = () => {
      const q = _filtro.objetos.trim().toLowerCase();
      const f = _filtro.tipoObjeto;
      let n = 0;
      $$("#tabla-objetos tr").forEach((tr) => {
        const okTexto = !q || tr.dataset.busca.includes(q);
        const okFiltro = !f || (tr.dataset.filtros || "").split(" ").includes(f);
        const ok = okTexto && okFiltro;
        tr.hidden = !ok;
        if (ok) n++;
      });
      // La vista de equipo obeyece el mismo buscador y el mismo filtro.
      const cont = $("#vista-equipo-objetos");
      let resumen = null;
      if (cont) {
        resumen = renderEquipo(p, nums, q, f);
        cont.innerHTML = resumen.html;
      }
      const cuenta = $("#cuenta-objetos");
      if (cuenta) {
        cuenta.textContent = _filtro.modoObjetos === "equipo"
          ? `${resumen ? resumen.conCasilla : 0} objetos en ${resumen ? resumen.casillas : 0} casillas`
            + (resumen && resumen.restos ? ` · ${resumen.restos} sin equipar` : "")
          : `${n} de ${p.objetos.length} objetos`;
      }
    };
    bo.addEventListener("input", () => { _filtro.objetos = bo.value; aplicar(); });
    $$("#filtros-objetos .filtro").forEach((b) => {
      b.classList.toggle("activo", b.dataset.f === _filtro.tipoObjeto);
      b.addEventListener("click", () => {
        $$("#filtros-objetos .filtro").forEach((x) => x.classList.toggle("activo", x === b));
        _filtro.tipoObjeto = b.dataset.f;
        aplicar();
      });
    });

    // Vista de la tabla: lista o equipo.
    const aplicarModo = () => {
      const equipo = _filtro.modoObjetos === "equipo";
      const vl = $("#vista-lista-objetos");
      const ve = $("#vista-equipo-objetos");
      if (vl) vl.hidden = equipo;
      if (ve) ve.hidden = !equipo;
      $$("#modos-objetos .filtro").forEach((b) => {
        b.classList.toggle("activo", b.dataset.modo === _filtro.modoObjetos);
      });
      aplicar();
    };
    $$("#modos-objetos .filtro").forEach((b) => {
      b.addEventListener("click", () => {
        _filtro.modoObjetos = b.dataset.modo;
        aplicarModo();
      });
    });

    // Orden por ilvl: el primer clic pone primero lo más alto.
    $$("#vista-objetos th[data-orden]").forEach((th) => {
      th.addEventListener("click", () => {
        if (_ordenObjetos.campo === "ilvl") _ordenObjetos.dir *= -1;
        else { _ordenObjetos.campo = "ilvl"; _ordenObjetos.dir = -1; }
        _ordenarObjetos();
      });
    });
    _ordenarObjetos();
    aplicarModo();
  }
}

function _conectarCopiar(p, r) {
  const copiar = $("#copiar");
  if (copiar) {
    copiar.addEventListener("click", async () => {
      await copiarTexto(informeTexto(p, r));
      copiar.textContent = "Copiado";
      setTimeout(() => { if (copiar.isConnected) copiar.textContent = "Copiar informe"; }, 1600);
    });
  }

  // Acciones de copiado de la ficha: fila de Excel y mensaje de reclamación.
  const botonesCopia = [$(".copiar-excel"), $(".copiar-mensaje")].filter(Boolean);
  const avisarCopia = (boton) => {
    for (const b of botonesCopia) {
      clearTimeout(b._aviso);
      b.classList.remove("copiado");
    }
    boton.classList.add("copiado");
    boton._aviso = setTimeout(() => {
      if (boton.isConnected) boton.classList.remove("copiado");
    }, 1800);
  };

  const copiarExcel = $(".copiar-excel");
  if (copiarExcel) {
    copiarExcel.addEventListener("click", async () => {
      await copiarTexto(filaExcel(p));
      avisarCopia(copiarExcel);
    });
  }

  const copiarMensaje = $(".copiar-mensaje");
  if (copiarMensaje) {
    copiarMensaje.addEventListener("click", async () => {
      await copiarTexto(mensajeReclamacion(p));
      avisarCopia(copiarMensaje);
    });
  }

  const otra = $("#otra");
  if (otra) {
    otra.addEventListener("click", () => {
      $("#texto").value = "";
      $("#salida").hidden = true;
      $("#estado").textContent = "";
      $("#resultado").innerHTML = "";
      _actual = null;
      _yaMostrado = false;
      _reparto(false);
      $("#texto").focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

function analizarEntrada() {
  const texto = $("#texto").value;
  const estado = $("#estado");
  estado.className = "estado";

  if (!texto.trim()) {
    estado.textContent = "Pega primero el contenido de la página.";
    estado.classList.add("error");
    return;
  }

  let perfil, resultado;
  try {
    perfil = parsear(texto);
    if (!perfil.logros.size) {
      $("#resultado").innerHTML = `<div class="aviso">
        No se encontró la tabla de logros. Asegúrate de copiar la página completa
        (Ctrl + A) desde la ficha de la migración, no solo una parte.
      </div>`;
      $("#salida").hidden = false;
      estado.textContent = "Formato no reconocido.";
      estado.classList.add("error");
      return;
    }
    resultado = analizar(perfil);
  } catch (e) {
    estado.textContent = "Error al analizar: " + e.message;
    estado.classList.add("error");
    return;
  }

  estado.textContent = `${perfil.logros.size} logros · ${perfil.objetos.length} objetos · ` +
                       `${perfil.reps.length} reputaciones`;
  pintar(perfil, resultado);
}

$("#analizar").addEventListener("click", analizarEntrada);
$("#ejemplo").addEventListener("click", async () => {
  const estado = $("#estado");
  try {
    const r = await fetch("ejemplo.txt");
    if (!r.ok) throw new Error("no disponible");
    $("#texto").value = await r.text();
    estado.className = "estado";
    estado.textContent = "Ejemplo cargado. Pulsa «Analizar personaje».";
  } catch (e) {
    estado.className = "estado error";
    estado.textContent = "El ejemplo solo está disponible con la web servida (no con file://).";
  }
});
$("#limpiar").addEventListener("click", () => {
  $("#texto").value = "";
  $("#salida").hidden = true;
  $("#estado").textContent = "";
  _reparto(false);
  $("#texto").focus();
});
$("#alternar-texto").addEventListener("click", () => {
  const expandido = $(".rejilla").classList.toggle("expandido");
  $("#alternar-texto").textContent = expandido ? "Contraer" : "Ampliar";
  _ajustarReps();
});
let _temporizadorReps = 0;
window.addEventListener("resize", () => {
  clearTimeout(_temporizadorReps);
  _temporizadorReps = setTimeout(_ajustarReps, 120);
});
$("#texto").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analizarEntrada();
});
