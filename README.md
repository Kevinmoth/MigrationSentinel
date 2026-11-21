# MigrationSentinel

Detector de **migraciones falsas** para World of Warcraft 3.3.5 (WotLK).

No adivina: monta un expediente con las contradicciones internas del personaje.
Cada logro, reputación, moneda y objeto tiene que cuadrar con las normas del
juego y con el resto del perfil. Lo que no cuadra se anota con su peso y con el
motivo, para que la decisión final la tome una persona.

- **Web** (para los compañeros): <https://kevinmoth.github.io/MigrationSentinel/>
- **Escritorio** (para revisar en lote y detectar clones): `wow_validator_gui.py`

## La web

1. Abrir la página de la migración.
2. `Ctrl` + `A` y después `Ctrl` + `C`.
3. Pegar el texto en la web y pulsar «Analizar personaje».

Todo el análisis ocurre **en el navegador**: no hay backend, no se envía nada a
ningún servidor y los datos del personaje no salen del equipo. Es una web
estática, así que también funciona abriendo `web/index.html` con doble clic.

El resultado se divide en tres bloques:

| Bloque | Peso | Qué significa |
|---|---|---|
| **Pruebas** | ≥ 80 % | Contradicciones con las normas del juego |
| **Indicios** | 50-79 % | Señales que hay que mirar |
| **Anomalías** | < 50 % | Se anotan siempre, aunque sean frecuentes |

La web **no** compara entre perfiles: eso requiere el corpus y se queda en la
herramienta de escritorio.

El resultado se ve en cuatro pestañas (**Resumen**, **Perfil**, **Logros** y
**Objetos**) y todo lleva su icono 3.3.5: objetos, logros, hechizos, monturas,
emblemas y las habilidades de cada profesión. Los iconos van dentro del
repositorio (`web/iconos/`), así que la web funciona sin conexión.

## Iconos

5.643 iconos 3.3.5 en JPG de 56×56 (9,7 MB). El mapa id → icono sale de la BD
local (`item_db.json` y `spell_db.json`, que son la fuente de verdad) y, para
los 371 logros que la BD no cubre, del tooltip de Wowhead (cacheado en
`logros_iconos.json`).

Las habilidades son el caso aparte: la ficha trae skill lines (`?skill=NNN`),
no hechizos. El icono canónico de cada profesión sale de los hechizos de
profesión del propio cliente (Herrería → `Trade_BlackSmithing`, Desollar →
`INV_Misc_Pelt_Wolf_01`, Joyería → `INV_Misc_Gem_01`, Inscripción →
`INV_Misc_Note_01`, etc.), y «Equitación con entry: 34091» sí es un hechizo
real, con su icono.

Para regenerarlos:

```powershell
python scripts/descargar_iconos.py        # copia de la BD local + descarga lo que falte
python scripts/completar_iconos_logros.py # iconos de los logros propios del servidor
python scripts/generar_iconos.py          # web/iconos.js y web/iconos-ids.js
node pruebas/prueba_iconos.js             # comprueba que todo cuadra
```

## La herramienta de escritorio

```powershell
python wow_validator_gui.py
```

- Carga una carpeta de perfiles exportados (JSON) y los analiza en lote.
- Marca cada personaje con su nota y su nivel (LIMPIO / DUDOSO / SOSPECHOSO / ALTO).
- Compara los perfiles entre sí para detectar **clones** (mismos logros con las
  mismas fechas, o con un desplazamiento constante de días).
- Exporta el resultado a CSV.

Requiere Python 3.9 o superior con Tkinter (incluido en el instalador de
Windows). `convertir_json.py` sirve para volcar los logros a CSV si se quiere
trabajar con ellos fuera de la interfaz.

## Cómo funciona

Cada regla devuelve un hallazgo con **dos números distintos**:

- **fuerza**: cuánto pesa como signo de falsificación (criterio del revisor).
- **frecuencia**: en cuántos perfiles del corpus aparece (contexto; no descuenta).

Los hallazgos se agrupan por familias (normas, emblemas, Ulduar, progresión ICC,
objetos…). Dentro de una familia manda el hallazgo más fuerte, para no contar
cinco veces el mismo hecho; entre familias se combina con *noisy-OR*. Así una
sola prueba sólida no se diluye entre veinte detalles menores.

Pesos principales:

| Hallazgo | Fuerza |
|---|---|
| Meta de logros incompleta o fechada antes de su último componente | 95 % |
| Fechas imposibles (antes del 3.0.2 o posteriores a la extracción) | 99 % |
| Logro de HK sin las muertes que exige | 95 % |
| Meta de ICC sin sus alas | 95 % |
| Emblematic descuadrado con el primer emblema | 90 % |
| Escaleras con fechas fuera de orden | 85-90 % |
| Algalon sin los Guardianes de Ulduar | 80 % |
| Objeto del Rey Exánime sin su logro | 70 % |
| Equipo de la Cruzada 258 sin logros de la banda | 40-75 % |
| Varios jefes del ala sin el logro del ala | 30-60 % |
| Acumulación de objetos BoE (20+ distintos) | 80 % |
| Acumulación de BoE (12-19 / 8-11 distintos) | 45 % / 25 % |
| Clon de otro perfil (solo escritorio) | 70-75 % |

Los objetos se anotan como indicio, no como sentencia: las tiendas y la subasta
permiten tener piezas sin haber pisado la banda. El peso sube cuando hay varios
objetos del mismo ala o de un jefe único.

### Objetos BoE acumulados: posible personaje banco

Un BoE (ligado al equipar) se compra en la subasta o se fabrica con profesiones,
así que por sí solo no prueba nada. Pero un personaje que arrastra media partida
de BoE épicos de nivel 80 no es un jugador: es un almacén de equipo, y en una
migración eso significa que el personaje venía usándose para mover equipo de un
jugador a otro.

La lista de BoE sale de `BoE_epicos_nivel80_todos - BoE épicos nivel 80.csv` (181
objetos) y la regla cuenta los BoE **distintos** que el personaje lleva:

| BoE distintos | Aviso | Fuerza |
|---|---|---|
| 20 o más | Acumulación de objetos BoE (**posible migración banco**) | 80 % |
| 12-19 | Acumulación de objetos BoE | 45 % |
| 8-11 | Objetos BoE en el inventario | 25 % |

En el corpus de referencia, el 14 % de los perfiles no clonados llega a 8 BoE y
30 de los 1.222 perfiles tienen 20 o más: son, casi todos, personajes-banco. El
aviso dice explícitamente que es un motivo de rechazo por política, no una
prueba de que los logros sean falsos.

## Estructura

```
motor.py                  motor del detector (reglas, catálogo, clones, informe)
wow_validator_gui.py      interfaz de escritorio (Tkinter)
convertir_json.py         volcado de perfiles a CSV
logros_wotlk.json         catálogo de metas y sus componentes (1.237 logros)
objetos_fuente.json       objeto -> jefe e ilvl (745 objetos)
nombres_logros.json       ID de logro -> nombre
boe_epicos.json           catálogo de objetos BoE de nivel 80 (181 objetos)
BoE_epicos_nivel80_todos - BoE épicos nivel 80.csv   lista original de BoE (origen del catálogo)
scripts/
  generar_boe.py          regenera boe_epicos.json desde la CSV
  generar_datos_web.py    regenera web/datos.js desde los catálogos
  generar_iconos.py       regenera web/iconos.js y web/iconos-ids.js
  descargar_iconos.py     deja en web/iconos/ los iconos 3.3.5 que usa la web
  completar_iconos_logros.py  icono de los logros propios del servidor
web/
  index.html              interfaz
  motor.js                parser del texto pegado + las reglas
  app.js                  pintado del expediente y copiar informe
  datos.js                catálogo empaquetado (generado)
  iconos.js               nombres de icono y mapa de logros (generado)
  iconos-ids.js           ids de objetos y hechizos (generado, bajo demanda)
  iconos-ui.js            utilidades para pintar iconos
  iconos-habilidades.js   iconos de habilidades y profesiones
  iconos/                 5.643 iconos 3.3.5 en JPG de 56x56
  estilos.css             estilos
  fuentes.css             @font-face
  fuentes/                Fira Sans, Fira Mono y Alfa Slab One (woff2)
  ejemplo.txt             ficha de ejemplo
pruebas/
  prueba_iconos.js        comprueba que todo id resuelve a un icono real
.github/workflows/pages.yml  despliegue automático en GitHub Pages
```

## Despliegue

GitHub Pages publica la carpeta `web/` en cada push a `main`, mediante el
workflow `.github/workflows/pages.yml`. No hay que compilar nada.

- URL: <https://kevinmoth.github.io/MigrationSentinel/>
- Para probar en local: `python -m http.server 8765` dentro de `web/` y abrir
  <http://localhost:8765>.

Si se amplía el catálogo de logros u objetos, o cambia la lista de BoE, hay que
regenerar los datos:

```powershell
python scripts/generar_boe.py         # boe_epicos.json desde la CSV de BoE
python scripts/generar_datos_web.py   # web/datos.js desde todos los catálogos
```

## Límites

- Un perfil bien falsificado no deja contradicciones internas: la ausencia de
  hallazgos no demuestra que sea real.
- Los logros de la Cruzada son condicionales, no por jefe; su ausencia solo
  pesa cuando hay muchas piezas de 258.
- El logro de ala exige completar el ala entera: un objeto de un jefe
  intermedio no la demuestra.
- Servidores como Aura permiten hacer heroico sin normal; esa secuencia no se
  penaliza.
- Honor y puntos de arena a 0 no son indicio (se gastan o se reinician).
- Los BoE se compran en la subasta: un personaje con muchos BoE puede ser un
  banco legítimo, no un falsificador. La regla los marca como motivo de
  rechazo por política, no como prueba de logros falsos.

## Datos de jugadores

Los perfiles de migración usados como corpus **no** se versionan (ver
`.gitignore`). El repositorio solo contiene el código y los catálogos del juego.
`web/ejemplo.txt` es una ficha de ejemplo ya publicada en el visor de
migraciones, para poder probar la herramienta.
