/* Prueba de los filtros de raid y mazmorra de la tabla de logros.
 *
 *   node pruebas/prueba_filtros.js
 *
 * Comprueba que los conjuntos salen del Achievement.dbc de 3.3.5, que no se
 * solapan y que los logros representativos caen en su filtro.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const WEB = path.join(__dirname, "..", "web");

const ctx = { console, Number, Object, Map, Set };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WEB, "filtros-logros.js"), "utf8"), ctx, { filename: "filtros-logros.js" });
const LOGROS_FILTRO = vm.runInContext("LOGROS_FILTRO", ctx);

let fallos = 0;
function comprobar(ok, msg) {
  if (!ok) { fallos++; console.log("  FALLO: " + msg); }
  return ok;
}

const esperado = { icc: 52, toc: 23, ulduar: 143, halion: 4, mazmorra: 156, pvp: 212 };
for (const [clave, n] of Object.entries(esperado)) {
  const lista = LOGROS_FILTRO[clave];
  comprobar(Array.isArray(lista) && lista.length === n, `${clave}: ${lista && lista.length} logros (esperados ${n})`);
  comprobar(new Set(lista).size === lista.length, `${clave}: hay ids repetidos`);
}

const casos = [
  [4531, "icc"], [4583, "icc"], [4608, "icc"], [4637, "icc"], [4602, "icc"], [4603, "icc"],
  [3916, "toc"], [3812, "toc"], [3918, "toc"], [4080, "toc"],
  [2886, "ulduar"], [3036, "ulduar"], [3180, "ulduar"], [3316, "ulduar"], [2957, "ulduar"], [2958, "ulduar"],
  [4815, "halion"], [4816, "halion"], [4817, "halion"], [4818, "halion"],
  [477, "mazmorra"], [489, "mazmorra"], [3778, "mazmorra"], [4297, "mazmorra"],
  [4516, "mazmorra"], [4526, "mazmorra"], [1283, "mazmorra"], [1288, "mazmorra"],
  [2136, "mazmorra"], [4476, "mazmorra"],
  [154, "pvp"], [165, "pvp"], [418, "pvp"], [4599, "pvp"],
  [6, ""], [13, ""], [42, ""], [4608 + 1, ""],
];
for (const [id, filtro] of casos) {
  comprobar(ctx.filtrosDeLogro(id) === filtro, `${id}: ${JSON.stringify(ctx.filtrosDeLogro(id))} (esperado ${JSON.stringify(filtro)})`);
}
comprobar(ctx.filtrosDeLogro("4815") === "halion", "acepta el id como texto");

const vistos = new Map();
for (const [clave, lista] of Object.entries(LOGROS_FILTRO)) {
  for (const id of lista) {
    if (vistos.has(id)) {
      comprobar(false, `${id} esta en ${vistos.get(id)} y en ${clave}`);
    }
    vistos.set(id, clave);
  }
}
console.log(`=== ${vistos.size} logros repartidos en ${Object.keys(esperado).length} filtros ===`);

if (fallos) {
  console.log(`\n${fallos} fallo(s)`);
  process.exit(1);
}
console.log("\nTODO CORRECTO");
