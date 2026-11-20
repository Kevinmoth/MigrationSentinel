#!/usr/bin/env python3
"""
Detector de migraciones falsas - WoW 3.3.5 (WotLK).

Uso: python wow_validator_gui.py

Carga una carpeta de perfiles JSON (los de migracion) y monta un expediente
por personaje: pruebas, indicios y anomalias con causa, ordenados por peso.
La logica esta en motor.py.
"""
import csv
import queue
import threading
from pathlib import Path

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import motor

COLUMNAS = [
    ("nota", "Nota", 55),
    ("nombre", "Personaje", 140),
    ("reino", "Reino", 115),
    ("clase", "Clase", 100),
    ("nivel", "Nv", 38),
    ("logros", "Logros", 55),
    ("objetos", "Obj", 45),
    ("familia", "Motivo principal", 165),
]

COLORES = {"ALTO": "#f5b7b1", "SOSPECHOSO": "#fad7a0", "DUDOSO": "#fcf3cf", "LIMPIO": "#ffffff"}


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Detector de migraciones falsas - WoW 3.3.5")
        self.geometry("1260x740")
        self.minsize(1000, 580)

        self.corpus = None
        self.filas = []
        self.avisos = queue.Queue()
        self.trabajando = False

        self._barra()
        self._cuerpo()
        self._estado()
        self.after(100, self._revisar)

    # -- interfaz ----------------------------------------------------------
    def _barra(self):
        b = ttk.Frame(self, padding=(8, 8, 8, 4))
        b.pack(fill="x")

        ttk.Button(b, text="Cargar carpeta...", command=self.elegir_carpeta).pack(side="left")
        ttk.Button(b, text="Cargar archivos...", command=self.elegir_archivos).pack(side="left", padx=(6, 0))
        ttk.Button(b, text="Exportar CSV", command=self.exportar).pack(side="left", padx=(6, 0))

        ttk.Label(b, text="Buscar:").pack(side="left", padx=(16, 4))
        self.filtro = tk.StringVar()
        e = ttk.Entry(b, textvariable=self.filtro, width=18)
        e.pack(side="left")
        self.filtro.trace_add("write", lambda *_: self._pintar())
        e.bind("<Escape>", lambda _e: self.filtro.set(""))

        ttk.Label(b, text="Motivo:").pack(side="left", padx=(10, 4))
        self.motivo = tk.StringVar(value="todos")
        self.combo = ttk.Combobox(b, textvariable=self.motivo, width=18, state="readonly",
                                  values=["todos"])
        self.combo.pack(side="left")
        self.combo.bind("<<ComboboxSelected>>", lambda _e: self._pintar())

        self.solo_pruebas = tk.BooleanVar(value=False)
        ttk.Checkbutton(b, text="solo con pruebas", variable=self.solo_pruebas,
                        command=self._pintar).pack(side="left", padx=(10, 0))

        self.resumen = tk.StringVar(value="Sin datos.")
        ttk.Label(b, textvariable=self.resumen, foreground="#555").pack(side="right")

    def _cuerpo(self):
        marco = ttk.Panedwindow(self, orient="horizontal")
        marco.pack(fill="both", expand=True, padx=8, pady=(0, 4))

        izq = ttk.Frame(marco)
        self.tabla = ttk.Treeview(izq, columns=[c[0] for c in COLUMNAS], show="headings",
                                  selectmode="browse")
        for clave, titulo, ancho in COLUMNAS:
            self.tabla.heading(clave, text=titulo, command=lambda c=clave: self._ordenar(c))
            self.tabla.column(clave, width=ancho,
                              anchor="w" if clave in ("nombre", "reino", "clase", "familia") else "center")
        for nivel, color in COLORES.items():
            self.tabla.tag_configure(nivel, background=color)
        self.tabla.bind("<<TreeviewSelect>>", self.detalle)

        sb = ttk.Scrollbar(izq, orient="vertical", command=self.tabla.yview)
        self.tabla.configure(yscrollcommand=sb.set)
        self.tabla.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        marco.add(izq, weight=3)

        der = ttk.Frame(marco)
        self.texto = tk.Text(der, wrap="word", font=("Consolas", 10), padx=10, pady=8)
        st = ttk.Scrollbar(der, orient="vertical", command=self.texto.yview)
        self.texto.configure(yscrollcommand=st.set, state="disabled")
        self.texto.pack(side="left", fill="both", expand=True)
        st.pack(side="right", fill="y")
        marco.add(der, weight=2)

    def _estado(self):
        pie = ttk.Frame(self, padding=(8, 0, 8, 6))
        pie.pack(fill="x")
        self.progreso = ttk.Progressbar(pie, mode="determinate", length=170)
        self.progreso.pack(side="left")
        self.mensaje = tk.StringVar(value="Carga una carpeta con perfiles JSON.")
        ttk.Label(pie, textvariable=self.mensaje).pack(side="left", padx=(10, 0))

    # -- carga -------------------------------------------------------------
    def elegir_carpeta(self):
        d = filedialog.askdirectory(title="Carpeta con perfiles JSON")
        if d:
            self._lanzar(motor.listar_json([d]))

    def elegir_archivos(self):
        a = filedialog.askopenfilenames(title="Perfiles JSON", filetypes=[("JSON", "*.json")])
        if a:
            self._lanzar(motor.listar_json(a))

    def _lanzar(self, rutas):
        if not rutas or self.trabajando:
            return
        self.trabajando = True
        self.corpus = None
        self.filas = []
        self.tabla.delete(*self.tabla.get_children())
        self._escribir("Analizando %d perfiles...\n" % len(rutas))
        self.progreso.configure(maximum=len(rutas), value=0)
        self.mensaje.set("Cargando 0/%d" % len(rutas))
        threading.Thread(target=self._trabajo, args=(rutas,), daemon=True).start()

    def _trabajo(self, rutas):
        def avance(i, total):
            self.avisos.put(("progreso", (i, total)))
        try:
            self.avisos.put(("listo", motor.Corpus.desde_rutas(rutas, progreso=avance)))
        except Exception as exc:
            self.avisos.put(("error", str(exc)))

    def _revisar(self):
        try:
            while True:
                tipo, dato = self.avisos.get_nowait()
                if tipo == "progreso":
                    i, total = dato
                    self.progreso.configure(value=i)
                    self.mensaje.set("Cargando %d/%d" % (i, total))
                elif tipo == "listo":
                    self._terminado(dato)
                elif tipo == "error":
                    self.trabajando = False
                    self.mensaje.set("Error al cargar.")
                    messagebox.showerror("Error", dato)
        except queue.Empty:
            pass
        self.after(100, self._revisar)

    def _terminado(self, corpus):
        self.corpus = corpus
        self.trabajando = False
        self.progreso.configure(value=self.progreso["maximum"])
        self.filas = corpus.ordenar()

        motivos = sorted({e["familia"] for _p, e in self.filas if e["familia"]})
        self.combo.configure(values=["todos"] + motivos)
        self._pintar()

        cuenta = {n: sum(1 for _p, e in self.filas if e["nivel"] == n)
                  for n in ("ALTO", "SOSPECHOSO", "DUDOSO")}
        clones = sum(1 for _p, e in self.filas
                     if any(h["familia"] == "clon" for h in e["hallazgos"]))
        self.resumen.set("%d perfiles | %d con pruebas | %d clones (señal) | %d no clonados" % (
            corpus.n, cuenta["ALTO"], clones, corpus.n_base))
        self.mensaje.set("Listo. %d perfiles, %d ilegibles." % (corpus.n, len(corpus.errores)))
        self._escribir(
            "Perfiles analizados: %d\n"
            "No clonados: %d  (la tasa base de cada regla se mide sobre estos)\n\n"
            "Selecciona un personaje para ver su expediente.\n\n"
            "El veredicto lo mandan las NORMAS DE LOS LOGROS: metas con sus\n"
            "componentes, metas fechadas antes que su último requisito, cuentas de\n"
            "reputación, escaleras y requisitos de nivel. La clonación es una señal\n"
            "secundaria (ya tienes una herramienta para eso).\n\n"
            "PRUEBA    >= 80%%  prácticamente concluyente\n"
            "INDICIO   50-79%%  hay que mirarlo\n"
            "ANOMALÍA  < 50%%   se anota aunque sea frecuente\n" % (corpus.n, corpus.n_base))

    # -- tabla -------------------------------------------------------------
    def _pintar(self):
        self.tabla.delete(*self.tabla.get_children())
        if not self.filas:
            return
        texto = self.filtro.get().strip().lower()
        motivo = self.motivo.get()
        solo = self.solo_pruebas.get()
        for i, (p, e) in enumerate(self.filas):
            if solo and e["nota"] < 80:
                continue
            if motivo != "todos" and e["familia"] != motivo:
                continue
            if texto and texto not in ("%s %s %s" % (p["nombre"], p["reino"], p["clase"])).lower():
                continue
            self.tabla.insert("", "end", iid=str(i), tags=(e["nivel"],), values=(
                "%.1f" % e["nota"], p["nombre"], p["reino"], p["clase"], p["nivel"] or "?",
                e["metricas"]["logros"], e["metricas"]["objetos"], e["familia"] or "—"))

    def _ordenar(self, columna):
        if not self.filas:
            return

        def clave(par):
            p, e = par
            if columna == "nota":
                return e["nota"]
            if columna in ("logros", "objetos"):
                return e["metricas"][columna]
            if columna == "nivel":
                return p["nivel"]
            if columna == "familia":
                return e["familia"] or ""
            return str(p.get(columna, "")).lower()

        self.filas.sort(key=clave, reverse=(columna != "nombre"))
        self._pintar()

    def detalle(self, _e=None):
        sel = self.tabla.selection()
        if not sel or not self.corpus:
            return
        p, ev = self.filas[int(sel[0])]
        self._escribir(motor.informe(p, ev))

    def _escribir(self, texto):
        self.texto.configure(state="normal")
        self.texto.delete("1.0", "end")
        self.texto.insert("1.0", texto)
        self.texto.configure(state="disabled")

    # -- exportación -------------------------------------------------------
    def exportar(self):
        if not self.filas:
            messagebox.showinfo("Sin datos", "Analiza primero una carpeta.")
            return
        ruta = filedialog.asksaveasfilename(defaultextension=".csv",
                                            filetypes=[("CSV", "*.csv")],
                                            initialfile="informe_migraciones.csv")
        if not ruta:
            return
        with open(ruta, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(["nota", "nivel", "motivo", "personaje", "reino", "clase", "raza",
                        "nv", "logros", "objetos", "pruebas", "indicios", "anomalias", "archivo"])
            for p, e in self.filas:
                pruebas = [h for h in e["hallazgos"] if h["fuerza"] >= 0.80]
                indicios = [h for h in e["hallazgos"] if 0.50 <= h["fuerza"] < 0.80]
                anomalias = [h for h in e["hallazgos"] if h["fuerza"] < 0.50]
                fmt = lambda hs: " | ".join("%s: %s" % (h["titulo"], h["detalle"]) for h in hs)
                w.writerow([e["nota"], e["nivel"], e["familia"], p["nombre"], p["reino"],
                            p["clase"], p["raza"], p["nivel"], e["metricas"]["logros"],
                            e["metricas"]["objetos"], fmt(pruebas), fmt(indicios),
                            fmt(anomalias), p["archivo"]])
        self.mensaje.set("Exportado: %s" % Path(ruta).name)


if __name__ == "__main__":
    App().mainloop()
