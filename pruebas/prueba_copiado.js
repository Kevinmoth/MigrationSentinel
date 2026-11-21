/* Prueba del parser con pegados que traen saltos de linea de mas.
 *
 *   node pruebas/prueba_copiado.js
 *
 * Segun el navegador, Ctrl+A / Ctrl+C puede dejar una linea en blanco entre
 * cada etiqueta y su valor, o partir la celda de la fecha de los logros en una
 * linea aparte. El parser tiene que sacar los mismos datos en ambos casos.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const WEB = path.join(__dirname, "..", "web");

const ctx = {
  console,
  document: {
    createElement: () => ({ set onload(_) {}, set onerror(_) {} }),
    head: { appendChild() {} },
  },
  window: {},
  esc: (s) => String(s == null ? "" : s),
  Promise, Set, Map, Number, String, JSON,
};
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["datos.js", "iconos.js", "iconos-ids.js", "iconos-ui.js", "iconos-habilidades.js", "motor.js"]) {
  vm.runInContext(fs.readFileSync(path.join(WEB, f), "utf8"), ctx, { filename: f });
}

const cabecera = `Migraciones - Información del Personaje: Chasnyk - (Thalassa)

Chasnyk - (Thalassa)
Chasnyk
Pícaro - Trol
Información del personaje
Nombre del PJ en el Servidor Remoto

Chasnyk
Servidor del que Provienes

logon.warmane.com

Locale
esES

Build
12340

Reino
Icecrown

Genero
Masculino

Clase

Pícaro

Raza

Trol

Nivel
80

Problemas con los Objetos de la Migración
#\tEntryID\tNombre del Objeto\tCantidad\tItemLevel\tEnlace Armería\tOpciones
1\t41673\tYelmo de cuero de Gladiador incansable\t1\t251\tVer Objeto\t-

Logros
#\tID\tNombre del logro\tFecha\tEnlace Armería
`;

const logrosConFechaAparte = `1\t6\tNivel 10\t
19-06-2025
Ver Logro
2\t7\tNivel 20\t

20-06-2025
Ver Logro
`;

const logrosEnUnaLinea = `1\t6\tNivel 10\t19-06-2025\tVer Logro
2\t7\tNivel 20\t20-06-2025\tVer Logro
`;

let fallos = 0;
function comprobar(ok, msg) {
  if (!ok) { fallos++; console.log("  FALLO: " + msg); }
  return ok;
}

console.log("=== IDENTIDAD Y OBJETOS (con lineas en blanco) ===");
const p1 = ctx.parsear(cabecera + logrosConFechaAparte);
comprobar(p1.remoto === "Chasnyk", "PJ remoto: " + JSON.stringify(p1.remoto));
comprobar(p1.servidorOrigen === "logon.warmane.com", "servidor: " + JSON.stringify(p1.servidorOrigen));
comprobar(p1.clase === "Pícaro", "clase: " + JSON.stringify(p1.clase));
comprobar(p1.raza === "Trol", "raza: " + JSON.stringify(p1.raza));
comprobar(p1.nivel === 80, "nivel: " + p1.nivel);
comprobar(p1.objetos.length === 1 && p1.objetos[0].id === 41673, "objetos: " + p1.objetos.length);

console.log("=== LOGROS CON LA FECHA EN LA LINEA SIGUIENTE ===");
comprobar(p1.logros.size === 2, "logros: " + p1.logros.size);
comprobar(p1.logros.get(6) === "2025-06-19", "fecha del 6: " + JSON.stringify(p1.logros.get(6)));
comprobar(p1.logros.get(7) === "2025-06-20", "fecha del 7: " + JSON.stringify(p1.logros.get(7)));
comprobar(p1.nombres.get(6) === "Nivel 10", "nombre del 6: " + JSON.stringify(p1.nombres.get(6)));

console.log("=== LOGROS CON LA FECHA EN LA MISMA LINEA ===");
const p2 = ctx.parsear(cabecera + logrosEnUnaLinea);
comprobar(p2.logros.size === 2, "logros: " + p2.logros.size);
comprobar(p2.logros.get(6) === "2025-06-19", "fecha del 6: " + JSON.stringify(p2.logros.get(6)));
comprobar(p2.remoto === "Chasnyk", "PJ remoto: " + JSON.stringify(p2.remoto));

if (fallos) {
  console.log(`\n${fallos} fallo(s)`);
  process.exit(1);
}
console.log("\nTODO CORRECTO");
