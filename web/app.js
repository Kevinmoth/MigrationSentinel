"use strict";

const $ = (sel) => document.querySelector(sel);

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function bloqueHallazgos(titulo, lista, clase) {
  if (!lista.length) return "";
  const filas = lista.map((h) => `
    <div class="hallazgo ${clase}">
      <div class="peso">${Math.round(h.fuerza * 100)}%</div>
      <div>
        <h4>${esc(h.titulo)}</h4>
        <p>${esc(h.detalle)}</p>
        ${h.nota ? `<p class="porque">${esc(h.nota)}</p>` : ""}
      </div>
    </div>`).join("");
  return `<div class="bloque"><h3>${esc(titulo)}</h3>${filas}</div>`;
}

function informeTexto(p, r) {
  const lineas = [
    `${p.nombre || "?"} — ${p.reino || "?"} (${p.clase || "?"} ${p.raza || "?"}, nivel ${p.nivel || "?"})`,
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

function pintar(p, r) {
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

  const estadoMig = p.estadoMigracion
    ? `<div class="aviso" style="margin-bottom:14px">
         <b>Estado en la página:</b> ${esc(p.estadoMigracion)}
       </div>`
    : "";

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

  $("#resultado").innerHTML = estadoMig + veredicto
    + bloqueHallazgos("Pruebas", pruebas, "prueba")
    + bloqueHallazgos("Indicios", indicios, "indicio")
    + bloqueHallazgos("Anomalías · se anotan aunque sean frecuentes", anomalias, "anomalia")
    + datos
    + `<div class="barra-inferior">
         <button id="copiar" class="secundario">Copiar informe</button>
         <button id="otra" class="secundario">Analizar otro</button>
       </div>`;

  $("#copiar").addEventListener("click", async () => {
    const texto = informeTexto(p, r);
    try {
      await navigator.clipboard.writeText(texto);
      $("#copiar").textContent = "Copiado";
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      $("#copiar").textContent = "Copiado";
    }
    setTimeout(() => { const b = $("#copiar"); if (b) b.textContent = "Copiar informe"; }, 1600);
  });

  $("#otra").addEventListener("click", () => {
    $("#texto").value = "";
    $("#salida").hidden = true;
    $("#estado").textContent = "";
    $("#texto").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("#salida").hidden = false;
  $("#salida").scrollIntoView({ behavior: "smooth", block: "start" });
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
  $("#texto").focus();
});
$("#texto").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analizarEntrada();
});
