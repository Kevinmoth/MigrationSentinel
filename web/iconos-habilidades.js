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
// Las demas habilidades (arboles de talentos, armas, armaduras e idiomas) no
// tienen skill line con arte propio, asi que se les asigna el icono de 3.3.5
// que mejor las representa: cada arma con su arma, cada armadura con una
// pieza, cada idioma con el emblema de la raza que lo habla.

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

// Arboles de talentos y habilidades de clase (van sin tildes ni mayusculas).
const ICONO_CLASE = {
  "proteccion": "ability_warrior_defensivestance", "protection": "ability_warrior_defensivestance",
  "sagrado": "spell_holy_holybolt", "holy": "spell_holy_holybolt",
  "reprension": "spell_holy_retributionaura", "retribution": "spell_holy_retributionaura",
  "armas": "inv_sword_48", "arms": "inv_sword_48",
  "furia": "ability_warrior_rampage", "fury": "ability_warrior_rampage",
  "asesinato": "ability_rogue_eviscerate", "assassination": "ability_rogue_eviscerate",
  "combate": "ability_rogue_slicedice", "combat": "ability_rogue_slicedice",
  "sutileza": "ability_stealth", "subtlety": "ability_stealth",
  "equilibrio": "spell_nature_starfall", "balance": "spell_nature_starfall",
  "combate feral": "ability_druid_catform", "feral combat": "ability_druid_catform",
  "restauracion": "spell_nature_healingtouch", "restoration": "spell_nature_healingtouch",
  "combate elemental": "spell_nature_lightning", "elemental combat": "spell_nature_lightning",
  "mejora": "spell_nature_lightningshield", "enhancement": "spell_nature_lightningshield",
  "punteria": "ability_hunter_focusedaim", "marksmanship": "ability_hunter_focusedaim",
  "supervivencia": "ability_hunter_snipershot", "survival": "ability_hunter_snipershot",
  "dominio de bestias": "ability_hunter_beasttaming", "beast mastery": "ability_hunter_beasttaming",
  "afliccion": "spell_shadow_curseofsargeras", "affliction": "spell_shadow_curseofsargeras",
  "demonologia": "spell_shadow_summonfelhunter", "demonology": "spell_shadow_summonfelhunter",
  "destruccion": "spell_fire_firebolt02", "destruction": "spell_fire_firebolt02",
  "sangre": "spell_deathknight_bloodpresence", "blood": "spell_deathknight_bloodpresence",
  "escarcha": "spell_frost_frostbolt02", "frost": "spell_frost_frostbolt02",
  "profano": "spell_deathknight_unholypresence", "unholy": "spell_deathknight_unholypresence",
  "disciplina": "spell_holy_powerwordshield", "discipline": "spell_holy_powerwordshield",
  "magia sombria": "spell_shadow_shadowbolt", "shadow magic": "spell_shadow_shadowbolt",
  "fuego": "spell_fire_flamebolt", "fire": "spell_fire_flamebolt",
  "arcano": "spell_arcane_blast", "arcane": "spell_arcane_blast",
  "forja de runas": "spell_deathknight_runetap", "runeforging": "spell_deathknight_runetap",
  "ganzua": "inv_misc_key_01", "lockpicking": "inv_misc_key_01",
};

// Armas, armaduras y defensa: el icono del objeto mas basico de ese tipo.
const ICONO_ARMA = {
  "espadas": "inv_sword_04", "swords": "inv_sword_04",
  "espadas de dos manos": "inv_sword_48", "two-handed swords": "inv_sword_48",
  "dagas": "inv_weapon_shortblade_77", "daggers": "inv_weapon_shortblade_77",
  "hachas": "inv_axe_04", "axes": "inv_axe_04",
  "hachas de dos manos": "inv_axe_85", "two-handed axes": "inv_axe_85",
  "mazas": "inv_mace_01", "maces": "inv_mace_01",
  "mazas de dos manos": "inv_mace_2h_blacksmithing_03", "two-handed maces": "inv_mace_2h_blacksmithing_03",
  "bastones": "inv_staff_71", "staves": "inv_staff_71",
  "armas de asta": "inv_spear_05", "polearms": "inv_spear_05",
  "arcos": "inv_weapon_bow_56", "bows": "inv_weapon_bow_56",
  "ballestas": "inv_weapon_crossbow_35", "crossbows": "inv_weapon_crossbow_35",
  "armas de fuego": "inv_weapon_rifle_34", "guns": "inv_weapon_rifle_34",
  "varitas": "inv_wand_35", "wands": "inv_wand_35",
  "armas arrojadizas": "inv_throwingknife_04", "thrown": "inv_throwingknife_04",
  "sin armas": "inv_gauntlets_04", "unarmed": "inv_gauntlets_04",
  "defensa": "ability_defend", "defense": "ability_defend",
  "escudo": "inv_shield_01", "escudos": "inv_shield_01", "shields": "inv_shield_01",
  "tela": "inv_chest_cloth_77", "cloth": "inv_chest_cloth_77",
  "cuero": "inv_chest_leather_01", "leather": "inv_chest_leather_01",
  "malla": "inv_chest_chain_15", "mail": "inv_chest_chain_15",
  "malla de placas": "inv_chest_plate_22", "placas": "inv_chest_plate_22", "plate": "inv_chest_plate_22",
};

// Habilidades secundarias (no son profesiones de fabricacion).
const ICONO_SECUNDARIA = {
  "cocina": "ui_profession_cooking", "cooking": "ui_profession_cooking",
  "pesca": "ui_profession_fishing", "fishing": "ui_profession_fishing",
  "primeros auxilios": "inv_misc_bandage_15", "first aid": "inv_misc_bandage_15",
  "equitacion": "spell_nature_swiftness", "riding": "spell_nature_swiftness",
};

// Cada idioma con el emblema de la raza que lo habla; el generico, un libro.
const ICONO_IDIOMA = {
  "": "inv_misc_book_01",
  "orco": "achievement_character_orc_male", "orcish": "achievement_character_orc_male",
  "comun": "achievement_character_human_male", "common": "achievement_character_human_male",
  "thalassiano": "achievement_character_bloodelf_male", "thalassian": "achievement_character_bloodelf_male",
  "taurahe": "achievement_character_tauren_male",
  "trol": "achievement_character_troll_male", "troll": "achievement_character_troll_male",
  "darnassiano": "achievement_character_nightelf_male", "darnassian": "achievement_character_nightelf_male",
  "draenei": "achievement_character_draenei_male",
  "visceralico": "achievement_character_undead_male", "gutterspeak": "achievement_character_undead_male",
  "gnomotico": "achievement_character_gnome_male", "gnomish": "achievement_character_gnome_male",
  "enanico": "achievement_character_dwarf_male", "dwarvish": "achievement_character_dwarf_male",
};

// Orden en el que se pintan los bloques de la tarjeta.
const GRUPOS_HABILIDAD = [
  { id: "clase", nombre: "Clase" },
  { id: "profesiones", nombre: "Profesiones" },
  { id: "armas", nombre: "Armas y armaduras" },
  { id: "idiomas", nombre: "Idiomas" },
  { id: "otras", nombre: "Otras" },
];

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

// Nombre limpio: fuera el "con entry: NNNN" que cuelga de algunas habilidades.
function _nombreHabilidad(nombre) {
  return _normalizar(String(nombre || "").replace(/\s*(?:con\s+)?entry:\s*\d+/i, ""));
}

function _esProfesion(n, enlace) {
  const sk = /[?&]skill=(\d+)/i.exec(String(enlace || ""));
  if (sk && SKILL_ICONO[Number(sk[1])]) return true;
  if (_skillPorNombre[n]) return true;
  for (const clave of Object.keys(_skillPorNombre)) {
    if (n.startsWith(clave) || n.endsWith(clave)) return true;
  }
  return false;
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

  const n = _nombreHabilidad(nom);

  // Por nombre: profesion (con prefijo o sufijo: "Desollar" y "Desuello").
  if (_skillPorNombre[n]) return SKILL_ICONO[_skillPorNombre[n]];
  for (const [clave, id] of Object.entries(_skillPorNombre)) {
    if (n.startsWith(clave) || n.endsWith(clave)) return SKILL_ICONO[id];
  }

  // Idiomas: el emblema de la raza; el generico, un libro.
  if (n.startsWith("idioma")) {
    const idioma = n.replace(/^idiomas?:?\s*/, "");
    return ICONO_IDIOMA[idioma] || ICONO_IDIOMA[""];
  }

  return ICONO_CLASE[n] || ICONO_ARMA[n] || ICONO_SECUNDARIA[n] || "";
}

/** Grupo de la tarjeta al que pertenece una habilidad. */
function grupoHabilidad(nombre, enlace) {
  const n = _nombreHabilidad(nombre);
  if (n.startsWith("idioma")) return "idiomas";
  if (ICONO_CLASE[n]) return "clase";
  if (ICONO_ARMA[n]) return "armas";
  if (_esProfesion(n, enlace) || ICONO_SECUNDARIA[n]) return "profesiones";
  return "otras";
}
