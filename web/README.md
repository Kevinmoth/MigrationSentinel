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

El resultado es el mismo expediente que genera la herramienta local:

- **Pruebas** (≥ 80%): contradicciones con las normas del juego.
- **Indicios** (50-79%): señales a revisar.
- **Anomalías** (< 50%): se anotan aunque sean frecuentes.

Y arriba, el estado que la propia página declara de la migración
(por ejemplo, «cancelada porque no cumple los requisitos»).

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
index.html     interfaz
estilos.css    estilos (paleta y tipografías de aprenderust.dev)
fuentes.css    @font-face de Fira Sans, Alfa Slab One y Fira Mono
fuentes/       los woff2, para que funcione sin internet
motor.js       parser del texto pegado + reglas
app.js         pintado del expediente
datos.js       catálogo de metas, fuentes de objetos y nombres (generado)
logo.gif       logo animado (120x120)
favicon.png    icono de la pestaña
ejemplo.txt    una ficha de ejemplo para probar
```

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
