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
      partes.push(`<img class="icono miniatura" src="iconos/${esc(ic)}.jpg" alt="" loading="lazy" ` +
                  `width="20" height="20" title="Objeto ${id}" ` +
                  `onerror="this.style.visibility='hidden'">`);
      if (partes.length >= 24) break;
    }
  }
  if (h.ids && h.ids.length) {
    for (const id of h.ids) {
      const ic = iconoLogro(id);
      if (!ic) continue;
      partes.push(`<img class="icono miniatura" src="iconos/${esc(ic)}.jpg" alt="" loading="lazy" ` +
                  `width="20" height="20" title="Logro ${id}" ` +
                  `onerror="this.style.visibility='hidden'">`);
      if (partes.length >= 30) break;
    }
  }
  if (!partes.length) return "";
  return `<div class="miniaturas">${partes.join("")}</div>`;
}

function resumenLinea(p, r) {
  return `${p.nombre || "?"} — ${p.reino || "?"} (${p.clase || "?"} ${p.raza || "?"}, nivel ${p.nivel || "?"})`;
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
        <div class="quien">${esc(p.nombre || "Sin nombre")} · ${esc(p.reino || "?")} ·
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

function renderPerfil(p, r) {
  const n = numeros(p, r);
  const exaltadas = p.reps.filter((x) => x.valor >= 42000).length;
  const skills = p.habilidades.filter((h) => h.max > 0);

  const repFilas = p.reps.slice().sort((a, b) => b.valor - a.valor);
  const repHtml = repFilas.length
    ? `<div class="barra-lista scroll">${repFilas.map((x) => {
        const ex = x.valor >= 42000;
        return `<div class="barra-fila${ex ? " exaltada" : ""}">
          <span class="barra-nombre">${esc(x.nombre)}${ex ? ' <span class="chip mini">EXALTADO</span>' : ""}</span>
          <span class="barra ${ex ? "exaltada" : ""}"><i style="width:${Math.min(100, (x.valor / 42000) * 100).toFixed(1)}%"></i></span>
          <span class="valor">${x.valor}</span>
        </div>`;
      }).join("")}</div>`
    : `<p class="vacio">Sin tabla de reputaciones.</p>`;

  const skillHtml = skills.length
    ? `<div class="barra-lista">${skills.map((h) => barraFila(
        h.nombre, h.actual, h.max, h.actual >= h.max ? "completa" : "", ` / ${h.max}`,
        etiquetaIcono(iconoHabilidad(h.nombre, h.enlace), "hechizo", "mini"))).join("")}</div>`
    : `<p class="vacio">Sin tabla de habilidades.</p>`;

  const emblemasHtml = p.emblemas.length
    ? `<div class="chips">${p.emblemas.map((e) => `
        <span class="chip emblema">${etiquetaIcono(iconoItem(e.id), "objeto", "mini")}
          ${esc(e.nombre)} <b>×${e.cantidad}</b></span>`).join("")}</div>`
    : `<p class="vacio">Sin emblemas.</p>`;

  const monturasHtml = p.monturas.length
    ? `<div class="chips">${p.monturas.map((id) => `
        <span class="chip montura">${etiquetaIcono(iconoSpell(id), "hechizo", "mini")}ID ${id}</span>`).join("")}</div>`
    : `<p class="vacio">Sin monturas ni compañeros.</p>`;

  const hechizosHtml = p.hechizos.length
    ? `<div class="chips">${p.hechizos.map((id) => `
        <span class="chip hechizo">${etiquetaIcono(iconoSpell(id), "hechizo", "mini")}ID ${id}</span>`).join("")}</div>`
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
          <div class="nombre-grande">${esc(p.nombre || "Sin nombre")}</div>
          <div class="ficha-sub">${esc(p.reino || "?")} · ${esc(p.clase || "?")} ${esc(p.raza || "?")} · nivel ${p.nivel || "?"}</div>
          <div class="ficha-datos">
            <div><span>PJ remoto</span><b>${esc(p.remoto || "—")}</b></div>
            <div><span>Reino de origen</span><b>${esc(p.reinoOrigen || "—")}</b></div>
            <div><span>Servidor</span><b>${esc(p.servidorOrigen || "—")}</b></div>
            <div><span>Locale · Build</span><b>${esc(p.locale || "—")} · ${esc(p.build || "—")}</b></div>
            <div><span>Género</span><b>${esc(p.genero || "—")}</b></div>
            <div><span>Extraído</span><b>${esc(p.extraido || "—")}</b></div>
          </div>
        </div>
        <div class="cifras">
          <div class="cifra"><b>${p.logros.size}</b><span>logros</span></div>
          <div class="cifra"><b>${p.objetos.length}</b><span>objetos</span></div>
          <div class="cifra ${n.boe.size >= 20 ? "alerta" : ""}"><b>${n.boe.size}</b><span>BoE</span></div>
          <div class="cifra"><b>${exaltadas}</b><span>exaltadas</span></div>
          <div class="cifra"><b>${p.emblemas.length}</b><span>emblemas</span></div>
          <div class="cifra"><b>${p.monturas.length}</b><span>monturas</span></div>
          <div class="cifra"><b>${p.hechizos.length}</b><span>hechizos</span></div>
          <div class="cifra"><b>${p.hk}</b><span>HK</span></div>
          <div class="cifra"><b>${p.honor}</b><span>honor</span></div>
          <div class="cifra"><b>${p.arena}</b><span>arena</span></div>
          <div class="cifra"><b>${p.oro}</b><span>oro</span></div>
        </div>
      </div>

      <div class="tarjeta">
        <h3>Curva de logros</h3>
        ${histogramaLogros(p)}
      </div>

      <div class="rejilla-dos">
        <div class="tarjeta">
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
    <tr data-busca="${esc(x.nombre.toLowerCase())} ${x.id} ${x.fecha}">
      <td class="celda-icono">${etiquetaIcono(iconoLogro(x.id), "logro")}</td>
      <td class="num">${x.id}</td>
      <td>${esc(x.nombre)} ${x.clave ? `<span class="chip mini">${esc(x.clave)}</span>` : ""} ${x.marca}</td>
      <td class="num">${esc(x.fecha)}</td>
    </tr>`).join("");

  return `
    <div class="buscador">
      <input id="buscar-logros" type="search" placeholder="Buscar logro, ID o fecha…">
      <span class="pie-mini" id="cuenta-logros">${filas.length} logros</span>
    </div>
    <div class="tarjeta">
      <h3>Curva de logros</h3>
      ${histogramaLogros(p)}
    </div>
    <div class="tabla-wrap">
      <table class="tabla">
        <thead><tr><th></th><th>ID</th><th>Logro</th><th>Fecha</th></tr></thead>
        <tbody id="tabla-logros">${cuerpo}</tbody>
      </table>
    </div>`;
}

// ------------------------------------------------------------------ objetos
function etiquetasObjeto(o, n) {
  const et = [];
  if (n.boe.has(o.id)) et.push('<span class="chip mini boe">BoE</span>');
  if (n.objs.has(o.id)) et.push('<span class="chip mini alerta">en un hallazgo</span>');
  if (o.ilvl === 277) et.push('<span class="chip mini">277</span>');
  if (o.ilvl === 258) et.push('<span class="chip mini">258</span>');
  const f = FUENTES[String(o.id)];
  if (f && f.jefe) et.push(`<span class="chip mini fuente">${esc(f.jefe.replace(/ \(\d\)$/, ""))}</span>`);
  return et.join(" ");
}

function renderObjetos(p, r) {
  const n = numeros(p, r);
  const cuerpo = p.objetos.map((o) => `
    <tr data-busca="${esc(o.nombre.toLowerCase())} ${o.id}"
        data-filtros="${[n.boe.has(o.id) ? "boe" : "", n.objs.has(o.id) ? "hallazgo" : "",
                        o.ilvl === 277 ? "277" : "", o.ilvl === 258 ? "toc" : "",
                        FUENTES[String(o.id)] ? "banda" : "",
                        /CANCELADO/i.test(o.opcion || "") ? "cancelado" : ""].filter(Boolean).join(" ")}">
      <td class="celda-icono">${etiquetaIcono(iconoItem(o.id), "objeto")}</td>
      <td class="num">${o.id}</td>
      <td>${esc(o.nombre)} ${etiquetasObjeto(o, n)}</td>
      <td class="num">${o.cantidad}</td>
      <td class="num">${o.ilvl || "—"}</td>
      <td class="estado-op">${o.opcion && o.opcion !== "-" ? esc(o.opcion) : ""}</td>
    </tr>`).join("");

  const filtros = [
    ["", "Todos"], ["boe", "BoE"], ["hallazgo", "En un hallazgo"], ["277", "ilvl 277"],
    ["toc", "ilvl 258"], ["banda", "De banda"], ["cancelado", "Cancelados"],
  ];

  return `
    <div class="buscador">
      <input id="buscar-objetos" type="search" placeholder="Buscar objeto o ID…">
      <div class="filtros" id="filtros-objetos">
        ${filtros.map(([k, t]) => `<button class="filtro${k === "" ? " activo" : ""}" data-f="${k}">${t}</button>`).join("")}
      </div>
      <span class="pie-mini" id="cuenta-objetos">${p.objetos.length} objetos</span>
    </div>
    <div class="tabla-wrap">
      <table class="tabla">
        <thead><tr><th></th><th>ID</th><th>Objeto</th><th>Cant.</th><th>ilvl</th><th>Estado</th></tr></thead>
        <tbody id="tabla-objetos">${cuerpo}</tbody>
      </table>
    </div>`;
}

// -------------------------------------------------------------------- pintado
const VISTAS = {
  resumen: renderResumen,
  perfil: renderPerfil,
  logros: renderLogros,
  objetos: renderObjetos,
};

// Estado del resultado actual, para poder repintar cuando lleguen los ids.
let _actual = null;
let _vistaActual = "resumen";
let _yaMostrado = false;
// Lo que el revisor ha escrito o filtrado: sobrevive a los repintados.
const _filtro = { logros: "", objetos: "", tipoObjeto: "" };

function pintar(p, r) {
  _actual = { p, r };
  _vistaActual = "resumen";
  _filtro.logros = "";
  _filtro.objetos = "";
  _filtro.tipoObjeto = "";
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
    $$(".vista").forEach((v) => { v.hidden = v.id !== "vista-" + b.dataset.vista; });
  }));

  _conectarBuscadores(p, r);
  _conectarCopiar(p, r);

  if (!_yaMostrado) {
    _yaMostrado = true;
    $("#salida").hidden = false;
    $("#salida").scrollIntoView({ behavior: "smooth", block: "start" });
  }
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

function _conectarBuscadores(p, r) {
  // buscador de logros
  const bl = $("#buscar-logros");
  if (bl) {
    bl.value = _filtro.logros;
    const aplicar = () => {
      const q = _filtro.logros.trim().toLowerCase();
      let n = 0;
      $$("#tabla-logros tr").forEach((tr) => {
        const ok = !q || tr.dataset.busca.includes(q);
        tr.hidden = !ok;
        if (ok) n++;
      });
      $("#cuenta-logros").textContent = `${n} de ${p.logros.size} logros`;
    };
    bl.addEventListener("input", () => { _filtro.logros = bl.value; aplicar(); });
    aplicar();
  }

  // buscador y filtros de objetos
  const bo = $("#buscar-objetos");
  if (bo) {
    bo.value = _filtro.objetos;
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
      $("#cuenta-objetos").textContent = `${n} de ${p.objetos.length} objetos`;
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
    aplicar();
  }
}

function _conectarCopiar(p, r) {
  const copiar = $("#copiar");
  if (copiar) {
    copiar.addEventListener("click", async () => {
      const texto = informeTexto(p, r);
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
      copiar.textContent = "Copiado";
      setTimeout(() => { if (copiar.isConnected) copiar.textContent = "Copiar informe"; }, 1600);
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
});
$("#texto").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analizarEntrada();
});
