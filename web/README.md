# Verificador de migraciones · web

Versión web del detector, para que los compañeros revisen una migración sin
instalar nada. Se pega la ficha del personaje y el análisis se hace **en el
navegador**: no se envía nada a ningún servidor.

**Publicada en:** <https://kevinmoth.github.io/MigrationSentinel/>

Cada push a `main` publica esta carpeta automáticamente mediante
`.github/workflows/pages.yml` (GitHub Pages, origen «GitHub Actions»).

## Cómo se usa

1. Abrir la página de la migración.
2. `Ctrl` + `A` y después `Ctrl` + `C` (copiar toda la página).
3. Pegar en el cuadro de la web.
4. «Analizar personaje».

El parser tolera que el pegado traiga saltos de línea de más: líneas en blanco
entre una etiqueta y su valor, o la fecha de un logro en la línea siguiente.

El resultado es el mismo expediente que genera la herramienta local:

- **Pruebas** (≥ 80%): contradicciones con las normas del juego.
- **Indicios** (50-79%): señales a revisar.
- **Anomalías** (< 50%): se anotan aunque sean frecuentes.

Y arriba, el estado que la propia página declara de la migración
(por ejemplo, «cancelada porque no cumple los requisitos»).

## Las cuatro vistas

| Vista | Qué muestra |
|---|---|
| **Perfil** | La ficha completa y visual: identidad (PJ remoto, reino de origen, servidor, locale, build, género, fecha de extracción), contadores con su icono, **curva de logros por mes**, barras de reputaciones (con las exaltadas marcadas), habilidades, emblemas, monturas, hechizos y la **bitácora de la migración**. El nombre va en el color de la clase. Es la pestaña que queda seleccionada al analizar. Abajo a la derecha, el icono de enlace copia la **fila de trabajo para Excel**: nombre externo, clase, raza, servidor, fecha del logro **Nivel 10** y nombre interno en Thalassa, separados por tabuladores. |
| **Logros** | Todos los logros en tabla, con buscador y ordenables por **ID** o **fecha** (por fecha por defecto), los que el motor usa como referencia resaltados y los que aparecen en un hallazgo marcados en rojo. El icono abre la ficha del logro en Wowhead. |
| **Objetos** | Todos los objetos en tabla, con buscador y filtros (**BoE**, en un hallazgo, ilvl 277, ilvl 258, de banda, cancelados), el origen de cada pieza y el estado que marca la propia página. El icono abre la ficha del objeto en Wowhead. |
| **Resumen** | Veredicto, hallazgos por bloques y los datos básicos del personaje. |

## Cómo publicarla

Es una web estática: no necesita backend ni base de datos.

- **Prueba local**: doble clic en `index.html` (funciona el pegado; el botón
  «Cargar ejemplo» solo funciona con servidor).
- **Servidor local**: `python -m http.server 8765` dentro de esta carpeta y
  abrir `http://localhost:8765`.
- **Internet**: subir esta carpeta a Netlify Drop, GitHub Pages, Cloudflare
  Pages o cualquier hosting estático. Al ser rutas relativas, funciona igual
  en la raíz o en un subdirectorio.

## Qué comprueba

- **Metas de logros**: cada meta contra sus componentes reales
  (`4608` exige las cinco alas de ICC 25, etc.).
- **Metas fechadas antes que su último componente**.
- **Escaleras**: niveles, emblemas, misiones, fragmentos, reputaciones, oro.
- **Reputaciones**: «5/10 Exaltado» contra las reputaciones actuales.
- **Muertes con honor (HK)**: la escalera de 1 a 100.000, en los dos sentidos.
- **Emblematic** frente al primer emblema y al nivel 80.
- **Algalon** sin los Guardianes de Ulduar.
- **Doble especialización** antes del nivel 40.
- **Metas de ICC** sin sus alas; botín 277 sin 25HC.
- **Objetos de banda**: «posee X sin el logro que lo respalde», con la
  dificultad y el jefe según la base 3.3.5.
- **Equipo de la Cruzada 25HC** sin logros de la Cruzada.
- **Acumulación de objetos BoE**: 20 o más BoE épicos de nivel 80 → «posible
  migración banco» (80 %); 12-19 → 45 %; 8-11 → 25 %.
- **Fechas imposibles**: anteriores al 3.0.2 o posteriores a la extracción.

No incluye la comparación entre perfiles (detección de clones): esa parte
sigue en la herramienta local.

## Estructura

```
index.html          interfaz
estilos.css         estilos (paleta y tipografías de aprenderust.dev)
fuentes.css         @font-face de Fira Sans, Alfa Slab One y Fira Mono
fuentes/            los woff2, para que funcione sin internet
motor.js            parser del texto pegado + reglas
app.js              pintado del expediente
datos.js            catálogo de metas, fuentes de objetos y nombres (generado)
iconos.js           nombres de icono y mapa de logros (generado)
iconos-ids.js       ids de objetos y hechizos (generado, se carga bajo demanda)
iconos-ui.js        utilidades para pintar iconos
iconos-habilidades.js  iconos de las habilidades y profesiones
iconos/             5.657 iconos 3.3.5 en JPG de 56x56
cursores/           cursores del juego (guantelete e interactuar, 32x32)
logo.gif            logo animado (120x120)
favicon.png         icono de la pestaña
ejemplo.txt         una ficha de ejemplo para probar
```

## Iconos

Los objetos, logros, hechizos, monturas, emblemas, habilidades, clases y razas
llevan su icono 3.3.5. Son **5.657 ficheros de 56×56** (9,7 MB) dentro de `web/iconos/`,
así que la web funciona sin conexión y no depende de ningún CDN.

El origen es doble:

- **La BD local** (`item_db.json`, `spell_db.json`, `icons/`) es la fuente de
  verdad del mapa id → icono. Aporta 5.272 iconos.
- **Wowhead** (`nether.wowhead.com/tooltip`) aporta el icono de los 371
  logros que la BD local no trae, porque `achievement_db.json` solo guarda el
  nombre. Se cachean en `logros_iconos.json` para no depender de la red.

Los iconos que Wowhead no conoce (los emblemas de mazmorra y banda `3838-3843`
y el Emblemático `4785`, propios del servidor) llevan un icono representativo
de su familia; se asignan en `scripts/completar_iconos_logros.py`.

### Habilidades

La tarjeta se pinta en bloques, cada uno con su separador: **Clase** (árboles de
talentos y Ganzúa), **Profesiones** (incluidas cocina, pesca, primeros auxilios y
equitación), **Armas y armaduras**, **Idiomas** y **Otras**.

La tabla trae skill lines (`?skill=NNN`), no hechizos, y los iconos de hechizos
no las cubren. Se resuelven por tres vías: el `entry: NNN` de «Equitación con
entry: 34091» (que sí es un hechizo real), el enlace `?skill=NNN`, y el nombre de
la habilidad. Para lo que no tiene skill line con arte propio se usa el icono de
3.3.5 que mejor lo representa: cada arma con su arma (`inv_sword_04`,
`inv_axe_04`, `inv_weapon_shortblade_77`…), cada armadura con una pieza, y cada
idioma con el emblema de la raza que lo habla (`achievement_character_orc_male`
para el orco, `_human_male` para el común, etc.).

El icono canónico de cada profesión sale de los hechizos de profesión del
propio cliente 3.3.5:

| Skill line | Profesión | Icono |
|---|---|---|
| 164 | Herrería | `Trade_BlackSmithing` |
| 165 | Peletería | `INV_Misc_ArmorKit_17` |
| 171 | Alquimia | `Trade_Alchemy` |
| 182 | Herboristería | `Trade_Herbalism` |
| 186 | Minería | `Trade_Mining` |
| 197 | Sastrería | `Trade_Tailoring` |
| 202 | Ingeniería | `Trade_Engineering` |
| 333 | Encantamiento | `Trade_Engraving` |
| 393 | Desollar | `INV_Misc_Pelt_Wolf_01` |
| 755 | Joyería | `INV_Misc_Gem_01` |
| 773 | Inscripción | `INV_Misc_Note_01` |

### Regenerar los iconos

```powershell
python scripts/descargar_iconos.py     # copia de la BD local + descarga lo que falte
python scripts/completar_iconos_logros.py  # iconos de los logros propios del servidor
python scripts/generar_iconos.py       # iconos.js + iconos-ids.js
node pruebas/prueba_iconos.js          # comprueba que todo cuadra
```

`iconos.js` (188 KB) lleva los nombres de icono y el mapa de logros, y se
carga siempre. `iconos-ids.js` (579 KB) lleva los ids de objetos y hechizos
—que son más de cien mil— y se carga bajo demanda, solo cuando ya se ha
pintado un resultado.

## Cursor

Toda la web usa los cursores de WoW: el guantelete (`cursores/guantelete.png`) como
puntero normal y el de interactuar, el guantelete con la tuerquita
(`cursores/interactuar.png`), al pasar por botones, pestañas, filtros y enlaces. Los
dos son de 32×32 con el punto activo en la punta del dedo (`1 1`). El arte es de
Blizzard y llega desde el pack CraftCursors (Slackcraft); va dentro del repo para que
no dependa de ningún CDN. Al escribir en la ficha o en un buscador se recupera la
barra de texto del sistema.

## Actualizar los datos

`datos.js` se genera desde los catálogos de la herramienta local
(`logros_wotlk.json`, `objetos_fuente.json`, `nombres_logros.json`,
`boe_epicos.json`). Si se amplía el catálogo, volver a generarlo en vez de
editarlo a mano.

```powershell
python scripts/generar_boe.py         # boe_epicos.json desde la CSV de BoE
python scripts/generar_datos_web.py   # datos.js desde todos los catálogos
```

## Límites

- El logro de ala exige completar el ala entera: un objeto de un jefe
  intermedio no la demuestra, por eso pesa poco.
- Las tiendas y la subasta permiten tener objetos sin haber pisado la banda.
- Los logros de la Cruzada son condicionales (no por jefe), así que su
  ausencia solo pesa cuando hay muchas piezas de 258.
- Los BoE se compran en la subasta: un personaje con 20+ BoE puede ser un banco
  legítimo, no un falsificador. La regla los marca como motivo de rechazo por
  política, no como prueba de logros falsos.
