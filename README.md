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
| Clon de otro perfil (solo escritorio) | 70-75 % |

Los objetos se anotan como indicio, no como sentencia: las tiendas y la subasta
permiten tener piezas sin haber pisado la banda. El peso sube cuando hay varios
objetos del mismo ala o de un jefe único.

## Estructura

```
motor.py                  motor del detector (reglas, catálogo, clones, informe)
wow_validator_gui.py      interfaz de escritorio (Tkinter)
convertir_json.py         volcado de perfiles a CSV
logros_wotlk.json         catálogo de metas y sus componentes (1.237 logros)
objetos_fuente.json       objeto -> jefe e ilvl (745 objetos)
nombres_logros.json       ID de logro -> nombre
scripts/
  generar_datos_web.py    regenera web/datos.js desde los catálogos
web/
  index.html              interfaz
  motor.js                parser del texto pegado + las reglas
  app.js                  pintado del expediente y copiar informe
  datos.js                catálogo empaquetado (generado)
  estilos.css             estilos
  fuentes.css             @font-face
  fuentes/                Fira Sans, Fira Mono y Alfa Slab One (woff2)
  ejemplo.txt             ficha de ejemplo
.github/workflows/pages.yml  despliegue automático en GitHub Pages
```

## Despliegue

GitHub Pages publica la carpeta `web/` en cada push a `main`, mediante el
workflow `.github/workflows/pages.yml`. No hay que compilar nada.

- URL: <https://kevinmoth.github.io/MigrationSentinel/>
- Para probar en local: `python -m http.server 8765` dentro de `web/` y abrir
  <http://localhost:8765>.

Si se amplía el catálogo de logros u objetos, hay que regenerar los datos de la
web:

```powershell
python scripts/generar_datos_web.py
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

## Datos de jugadores

Los perfiles de migración usados como corpus **no** se versionan (ver
`.gitignore`). El repositorio solo contiene el código y los catálogos del juego.
`web/ejemplo.txt` es una ficha de ejemplo ya publicada en el visor de
migraciones, para poder probar la herramienta.
