/* Prueba de la cadena de iconos de la web, en Node.
 *
 *   node pruebas/prueba_iconos.js
 *
 * Carga los scripts como lo haria el navegador y comprueba que:
 *  - el parser saca bien el nombre de las habilidades,
 *  - cada habilidad de profesion tiene su icono canonico,
 *  - los objetos, hechizos y logros del ejemplo resuelven a un icono real,
 *  - y ese icono existe como archivo en web/iconos/.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const WEB = path.join(__dirname, "..", "web");

// El navegador da un contexto global; aqui se imita lo justo.
const ctx = {
  console,
  document: {
    createElement: () => ({ set onload(_) {}, set onerror(_) {} }),
    head: { appendChild() {} },
  },
  window: {},
  esc: (s) => String(s == null ? "" : s),
  Promise,
  Set,
  Map,
  Number,
  String,
  JSON,
};
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);

for (const f of ["datos.js", "iconos.js", "iconos-ids.js", "iconos-ui.js", "iconos-habilidades.js", "motor.js"]) {
  vm.runInContext(fs.readFileSync(path.join(WEB, f), "utf8"), ctx, { filename: f });
}

// --- ficheros de icono disponibles ----------------------------------------
const ficheros = new Set(fs.readdirSync(path.join(WEB, "iconos")));
function existe(nombre) { return ficheros.has(nombre + ".jpg"); }

// --- parser ---------------------------------------------------------------
const texto = fs.readFileSync(path.join(WEB, "ejemplo.txt"), "utf8");
const p = ctx.parsear(texto);
const r = ctx.analizar(p);

let fallos = 0;
function comprobar(ok, msg) {
  if (!ok) { fallos++; console.log("  FALLO: " + msg); }
  return ok;
}

// En el navegador el mapa de ids de objetos y hechizos se carga aparte,
// cuando ya se ha pintado el resultado. Aqui se espera antes de comprobar.
async function main() {
await ctx._cargarIds();

// --- habilidades ----------------------------------------------------------
console.log("=== HABILIDADES (" + p.habilidades.length + ") ===");
const ESPERADO = {
  "Ingeniería": "trade_engineering",
  "Sastrería": "trade_tailoring",
  "Encantamiento": "trade_engraving",
  "Peletería": "inv_misc_armorkit_17",
  "Alquimia": "trade_alchemy",
  "Herboristería": "trade_herbalism",
  "Minería": "trade_mining",
  "Sastrería ": "trade_tailoring",
  "Herrería": "trade_blacksmithing",
  "Desollar": "inv_misc_pelt_wolf_01",
  "Joyería": "inv_misc_gem_01",
  "Inscripción": "inv_misc_note_01",
};
for (const h of p.habilidades) {
  const ic = ctx.iconoHabilidad(h.nombre, h.enlace);
  const ok = ESPERADO[h.nombre];
  if (ok) {
    comprobar(ic === ok, `${h.nombre}: esperaba ${ok}, obtuve ${ic || "(ninguno)"}`);
    console.log(`  ${h.nombre.padEnd(16)} -> ${ic || "(ninguno)"}`);
  } else if (ic) {
    console.log(`  ${h.nombre.padEnd(16)} -> ${ic}   (sin canon, informational)`);
  }
}
// "Equitacion con entry: NNN" es un hechizo real.
const equit = p.habilidades.find((h) => /entry:/i.test(h.nombre));
comprobar(!!equit, "no se ha leido la habilidad de Equitacion");
if (equit) {
  const ic = ctx.iconoHabilidad(equit.nombre, equit.enlace);
  comprobar(ic === "spell_nature_swiftness", `Equitacion: esperaba spell_nature_swiftness, obtuve ${ic}`);
  console.log(`  ${equit.nombre.padEnd(16)} -> ${ic}`);
}

// Los nombres con tilde deben salir enteros (el parser no debe cortarlos).
const nombres = p.habilidades.map((h) => h.nombre);
comprobar(nombres.includes("Ingeniería"), "el nombre 'Ingeniería' salio mal parseado");
comprobar(nombres.includes("Equitación con entry: 34090"), "el nombre de Equitacion salio mal parseado");

// Las 11 profesiones del corpus, tal y como salen en la ficha.
console.log("\n=== LAS 11 PROFESIONES DEL CORPUS ===");
const PROFESIONES = {
  "Herrería": "trade_blacksmithing",
  "Peletería": "inv_misc_armorkit_17",
  "Alquimia": "trade_alchemy",
  "Herboristería": "trade_herbalism",
  "Minería": "trade_mining",
  "Sastrería": "trade_tailoring",
  "Ingeniería": "trade_engineering",
  "Encantamiento": "trade_engraving",
  "Desollar": "inv_misc_pelt_wolf_01",
  "Joyería": "inv_misc_gem_01",
  "Inscripción": "inv_misc_note_01",
};
for (const [nom, ic0] of Object.entries(PROFESIONES)) {
  const ic = ctx.iconoHabilidad(nom, "");
  comprobar(ic === ic0, `${nom}: esperaba ${ic0}, obtuve ${ic || "(ninguno)"}`);
  comprobar(existe(ic), `${nom}: el icono ${ic} no existe como fichero`);
  console.log(`  ${nom.padEnd(16)} -> ${ic}`);
}

// --- objetos, hechizos y logros ------------------------------------------
let objsOk = 0, objsMal = [];
for (const o of p.objetos) {
  const ic = ctx.iconoItem(o.id);
  if (ic && existe(ic)) objsOk++;
  else objsMal.push(`${o.id} ${o.nombre} -> ${ic || "(ninguno)"}`);
}
console.log(`\n=== OBJETOS: ${objsOk}/${p.objetos.length} con icono real ===`);
for (const m of objsMal.slice(0, 10)) console.log("  " + m);
comprobar(objsMal.length === 0, `${objsMal.length} objetos sin icono valido`);

let logOk = 0, logMal = [];
for (const [id] of p.logros) {
  const ic = ctx.iconoLogro(id);
  if (ic && existe(ic)) logOk++;
  else logMal.push(`${id} -> ${ic || "(ninguno)"}`);
}
console.log(`\n=== LOGROS: ${logOk}/${p.logros.size} con icono real ===`);
for (const m of logMal.slice(0, 10)) console.log("  " + m);
comprobar(logMal.length === 0, `${logMal.length} logros sin icono valido`);

let spOk = 0, spMal = [];
for (const id of p.hechizos) {
  const ic = ctx.iconoSpell(id);
  if (ic && existe(ic)) spOk++;
  else spMal.push(`${id} -> ${ic || "(ninguno)"}`);
}
console.log(`\n=== HECHIZOS: ${spOk}/${p.hechizos.length} con icono real ===`);
for (const m of spMal.slice(0, 10)) console.log("  " + m);
comprobar(spMal.length === 0, `${spMal.length} hechizos sin icono valido`);

let emOk = 0, emMal = [];
for (const e of p.emblemas) {
  const ic = ctx.iconoItem(e.id);
  if (ic && existe(ic)) emOk++;
  else emMal.push(`${e.id} ${e.nombre} -> ${ic || "(ninguno)"}`);
}
console.log(`\n=== EMBLEMAS: ${emOk}/${p.emblemas.length} con icono real ===`);
for (const m of emMal.slice(0, 10)) console.log("  " + m);
comprobar(emMal.length === 0, `${emMal.length} emblemas sin icono valido`);

let moOk = 0, moMal = [];
for (const id of p.monturas) {
  const ic = ctx.iconoSpell(id);
  if (ic && existe(ic)) moOk++;
  else moMal.push(`${id} -> ${ic || "(ninguno)"}`);
}
console.log(`\n=== MONTURAS: ${moOk}/${p.monturas.length} con icono real ===`);
for (const m of moMal.slice(0, 10)) console.log("  " + m);
comprobar(moMal.length === 0, `${moMal.length} monturas sin icono valido`);

// --- ficheros que el mapa declara pero no estan ---------------------------
console.log("\n=== INTEGRIDAD DEL REPOSITORIO DE ICONOS ===");
let faltan = [];
for (const n of ctx.ICONOS.Nombres) {
  if (!ficheros.has(n + ".jpg")) faltan.push(n);
}
console.log(`  ${ctx.ICONOS.Nombres.length} nombres en el mapa, ${faltan.length} sin fichero`);
for (const n of faltan.slice(0, 10)) console.log("  falta: " + n);
comprobar(faltan.length === 0, `${faltan.length} iconos del mapa sin fichero`);

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
}

main();
