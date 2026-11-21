"use strict";

// Iconos 3.3.5: convierte un id de objeto, hechizo o logro en la URL de su
// icono. Los archivos viven en web/iconos/ y se cargan bajo demanda.
//
//   iconoItem(50676)   -> "iconos/inv_weapon_shortblade_105.jpg"
//   iconoSpell(133)    -> "iconos/spell_fire_flamebolt.jpg"
//   iconoLogro(4608)   -> "iconos/achievement_dungeon_icecrown_frostmourne.jpg"

const BASE_ICONOS = "iconos/";

// Un icono generico por tipo, para cuando no hay icono propio.
const FALLBACK = {
  objeto: "inv_misc_questionmark",
  hechizo: "spell_nature_lightning",
  logro: "achievement_general",
};

// El mapa de nombres y el de logros son ligeros y estan siempre disponibles.
// El de ids de objetos y hechizos es grande (en 3.3.5 hay mas de cien mil),
// asi que se carga solo cuando hace falta: el resumen no lo usa, pero las
// tablas de objetos, de hechizos y las miniaturas si.
const _datos = {
  idsCargados: false,
  cargando: null,
  nombres: [],
  objetos: null,
  hechizos: null,
  logros: {},
};

function _leerBase() {
  const I = (typeof ICONOS !== "undefined" && ICONOS) || window.ICONOS || {};
  _datos.nombres = I.Nombres || [];
  _datos.logros = I.Logros || {};
}

function _cargarIds() {
  if (_datos.idsCargados) return Promise.resolve();
  if (_datos.cargando) return _datos.cargando;

  _datos.cargando = new Promise((resolve) => {
    const tomar = () => {
      const I = (typeof ICONOS_IDS !== "undefined" && ICONOS_IDS) || window.ICONOS_IDS || {};
      _datos.objetos = typeof I.Objetos === "string" ? I.Objetos.split(",") : I.Objetos;
      _datos.hechizos = typeof I.Hechizos === "string" ? I.Hechizos.split(",") : I.Hechizos;
      _datos.idsCargados = true;
      resolve();
    };
    if (typeof ICONOS_IDS !== "undefined" || window.ICONOS_IDS) {
      tomar();
      return;
    }
    const s = document.createElement("script");
    s.src = "iconos-ids.js";
    s.onload = tomar;
    s.onerror = () => resolve();   // sin ids, los iconos simplemente no salen
    document.head.appendChild(s);
  });
  return _datos.cargando;
}

function _porIndice(lista, id) {
  if (!lista) return null;
  const n = Number(id);
  if (!Number.isFinite(n) || n < 0 || n >= lista.length) return null;
  const i = lista[n];
  if (i === "-1" || i === "") return null;
  return _datos.nombres[Number(i)] || null;
}

function _porMapa(mapa, id) {
  if (!mapa || typeof mapa === "string") return null;
  const n = Number(id);
  return mapa[String(n)] || null;
}

/** Icono de un objeto (item id). Devuelve "" si no se conoce. */
function iconoItem(id) {
  if (!_datos.nombres.length) _leerBase();
  return (_porIndice(_datos.objetos, id) || _porMapa(_datos.objetos, id)) || "";
}

/** Icono de un hechizo (spell id), que tambien sirve para monturas. */
function iconoSpell(id) {
  if (!_datos.nombres.length) _leerBase();
  return (_porIndice(_datos.hechizos, id) || _porMapa(_datos.hechizos, id)) || "";
}

/** Icono de un logro (achievement id). */
function iconoLogro(id) {
  if (!_datos.nombres.length) _leerBase();
  return _porMapa(_datos.logros, id) || "";
}

function _url(nombre) {
  return BASE_ICONOS + nombre + ".jpg";
}

/** Página del objeto, logro o hechizo en Wowhead (WotLK, en español). */
function enlaceWowhead(tipo, id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return "";
  const ruta = tipo === "logro" ? "achievement" : tipo === "hechizo" ? "spell" : "item";
  return "https://www.wowhead.com/wotlk/es/" + ruta + "=" + n;
}

/**
 * Etiqueta <img> con el icono que corresponde.
 *
 * Si no hay icono conocido (habilidades que no son profesiones, logros sin
 * arte publico) no se devuelve nada: es mejor el nombre a secas que un
 * recuadro vacio repetido veinte veces.
 *
 * Si el archivo no esta en el repo, cae al generico del tipo.
 * Con `enlace`, el icono se envuelve en un enlace (la ficha del objeto o del
 * logro en Wowhead).
 */
function etiquetaIcono(nombre, tipo, clase, enlace) {
  if (!nombre) return "";
  const src = _url(nombre);
  const img = '<img class="icono ' + (clase || "") + '" src="' + esc(src) +
         '" alt="" loading="lazy" width="32" height="32" ' +
         'onerror="this.onerror=null;this.src=\'' + esc(_url(FALLBACK[tipo] || FALLBACK.objeto)) +
         '\';this.classList.add(\'icono-reserva\')">';
  if (!enlace) return img;
  return '<a class="icono-enlace" href="' + esc(enlace) + '" target="_blank" ' +
         'rel="noopener noreferrer" title="Abrir en Wowhead">' + img + '</a>';
}
