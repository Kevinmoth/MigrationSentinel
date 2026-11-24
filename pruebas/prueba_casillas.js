/* Prueba del catalogo de casillas de los objetos.
 *
 *   node pruebas/prueba_casillas.js
 *
 * Comprueba que web/casillas.js esta bien formado y que una muestra de
 * objetos conocidos cae en la casilla que le toca. El archivo se genera con
 * scripts/generar_casillas_web.py: si cambia el catalogo del juego, hay que
 * regenerarlo antes de dar la prueba por buena.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const WEB = path.join(__dirname, "..", "web");

const ctx = { console, Number, Object, Map, Set };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WEB, "casillas.js"), "utf8"), ctx, { filename: "casillas.js" });
const CASILLAS = vm.runInContext("CASILLAS", ctx);
const CASILLAS_CLAVE = vm.runInContext("CASILLAS_CLAVE", ctx);
const CASILLAS_CODIGO = vm.runInContext("CASILLAS_CODIGO", ctx);

let fallos = 0;
function comprobar(ok, msg) {
  if (!ok) { fallos++; console.log("  FALLO: " + msg); }
  return ok;
}

/** Estado de un objeto: casilla, material (no equipable) o fuera. */
function estado(id) {
  const letra = CASILLAS_CODIGO[id];
  if (!letra || letra === ".") return "fuera";
  if (letra === "-") return "material";
  return CASILLAS_CLAVE[letra.charCodeAt(0) - 97] || "?";
}

comprobar(Array.isArray(CASILLAS) && CASILLAS.length > 0, "CASILLAS vacio");
comprobar(CASILLAS.length === CASILLAS_CLAVE.length,
  `hay ${CASILLAS.length} nombres y ${CASILLAS_CLAVE.length} claves`);
comprobar(typeof CASILLAS_CODIGO === "string" && CASILLAS_CODIGO.length > 1000, "CASILLAS_CODIGO vacio");

// Ninguna letra puede apuntar a una casilla que no exista.
const malas = new Set();
for (const letra of new Set(CASILLAS_CODIGO.split(""))) {
  if (letra === "." || letra === "-") continue;
  const i = letra.charCodeAt(0) - 97;
  if (i < 0 || i >= CASILLAS_CLAVE.length) malas.add(letra);
}
comprobar(malas.size === 0, `letras sin casilla: ${[...malas].join(", ")}`);

// Una muestra de objetos con casilla conocida.
const casos = [
  [1020, "cabeza"],   // Casco de cuero
  [33292, "cabeza"],  // Yelmo sacralizado
  [25, "arma"],       // Espada corta desgastada
  [47266, "arma"],    // Furia sangrienta
  [47267, "distancia"], // Ballesta
  [17, "camisa"],
  [862, "anillo"],
  [50088, "manos"],
  [50858, "piernas"],
  [47284, "pies"],
  [50653, "espalda"],
  [41599, "bolsa"],
  [1131, "desconocido"],
];
for (const [id, esperado] of casos) {
  comprobar(estado(id) === esperado, `${id}: ${estado(id)} (esperado ${esperado})`);
}

// Los materiales y los objetos ausentes del catalogo se distinguen.
comprobar(estado(4305) === "material", "4305 deberia ser material");
comprobar(estado(58776) === "fuera", "58776 deberia estar fuera del catalogo");

console.log(`=== ${CASILLAS_CLAVE.length} casillas, ${CASILLAS_CODIGO.length} ids ===`);

if (fallos) {
  console.log(`\n${fallos} fallo(s)`);
  process.exit(1);
}
console.log("\nTODO CORRECTO");
