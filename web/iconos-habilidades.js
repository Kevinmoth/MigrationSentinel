"use strict";

// Iconos de habilidades.
//
// La tabla "Habilidades" de la ficha trae el nombre y, a veces, un enlace
// ?skill=NNN. Ese numero es una skill line (la profesion), no un hechizo, y
// los iconos de hechizos no la cubren. Se resuelve por tres vias, de la mas
// fiable a la menos:
//
//  1. "Equitacion con entry: 34091" -> ese numero SI es un spell id, y el
//     hechizo tiene icono propio.
//  2. El enlace ?skill=NNN -> skill line de profesion, con su icono
//     canonico del cliente.
//  3. El nombre de la habilidad, por coincidencia.
//
// El icono canonico de cada profesion sale de los hechizos de profesion del
// propio cliente 3.3.5 (ver spell_db.json de la BD local):
//
//   164 Herreria       -> Trade_BlackSmithing      (hechizo 2018)
//   165 Peleteria      -> INV_Misc_ArmorKit_17     (hechizo 2108)
//   171 Alquimia       -> Trade_Alchemy            (hechizo 2259)
//   182 Herboristeria  -> Trade_Herbalism          (hechizo 2372)
//   186 Mineria        -> Trade_Mining             (hechizo 2575)
//   197 Sastreria      -> Trade_Tailoring          (hechizo 3908)
//   202 Ingenieria     -> Trade_Engineering        (hechizo 4036)
//   333 Encantamiento  -> Trade_Engraving          (hechizo 7411)
//   393 Desollar       -> INV_Misc_Pelt_Wolf_01    (hechizo 8613)
//   755 Joyeria        -> INV_Misc_Gem_01          (hechizo 25229)
//   773 Inscripcion    -> INV_Misc_Note_01         (icono del cliente)
//
// El resto se queda sin icono: es mejor no poner una imagen que no
// corresponde que poner una parecida.

// skill line -> icono canonico del cliente.
const SKILL_ICONO = {
  164: "trade_blacksmithing",
  165: "inv_misc_armorkit_17",
  171: "trade_alchemy",
  182: "trade_herbalism",
  186: "trade_mining",
  197: "trade_tailoring",
  202: "trade_engineering",
  333: "trade_engraving",
  393: "inv_misc_pelt_wolf_01",
  755: "inv_misc_gem_01",
  773: "inv_misc_note_01",
};

// skill line -> nombre, para el caso de que la ficha no traiga el enlace.
const SKILL_NOMBRE = {
  164: "herrería",
  165: "peletería",
  171: "alquimia",
  182: "herboristería",
  186: "minería",
  197: "sastrería",
  202: "ingeniería",
  333: "encantamiento",
  393: "desollar",
  755: "joyería",
  773: "inscripción",
};

// Sin tildes y en minusculas, para comparar nombres.
function _normalizar(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

const _skillPorNombre = {};
for (const [id, nombre] of Object.entries(SKILL_NOMBRE)) {
  _skillPorNombre[_normalizar(nombre)] = Number(id);
}

/**
 * Devuelve el nombre del icono de una habilidad, o "" si no se conoce.
 * @param {string} nombre  nombre de la habilidad tal cual sale en la ficha
 * @param {string} enlace  enlace opcional (?skill=NNN)
 */
function iconoHabilidad(nombre, enlace) {
  const nom = String(nombre || "");

  // "Equitacion con entry: 34091" -> el numero es un spell id.
  const ent = /entry:\s*(\d+)/i.exec(nom);
  if (ent) {
    const spell = iconoSpell(ent[1]);
    if (spell) return spell;
  }

  // El enlace ?skill=NNN -> skill line de profesion.
  const sk = /[?&]skill=(\d+)/i.exec(String(enlace || ""));
  if (sk) {
    const ic = SKILL_ICONO[Number(sk[1])];
    if (ic) return ic;
  }

  // Por ultimo, el nombre de la habilidad.
  const limpio = nom.replace(/^.*?entry:\s*\d+\s*/i, "").trim();
  const n = _normalizar(limpio);
  if (_skillPorNombre[n]) return SKILL_ICONO[_skillPorNombre[n]];

  // "Desollar" y "Desuello" son la misma skill con distinto nombre en la
  // ficha; y hay nombres con sufijo ("Ingeniería con entry: 1234").
  for (const [clave, id] of Object.entries(_skillPorNombre)) {
    if (n.startsWith(clave) || n.endsWith(clave)) return SKILL_ICONO[id];
  }

  return "";
}
