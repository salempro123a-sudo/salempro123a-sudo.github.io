# TRANSMISSION · Archivo musical personal

Repositorio publicado en https://salempro123a-sudo.github.io/

## Diseño

La identidad gráfica procede de la primera versión editorial inspirada en la composición de NTS Radio (recuperable en Git history desde el commit `1da6e7b8b69bab262d7ea4590db678709e7f7eb5`). No debe sustituirse por un reproductor genérico: conservar la portada, la barra superior, la columna de mixtapes, las tarjetas, el bloque abstracto, las colecciones y el cierre editorial.

## Implementación

- `index.html`: página principal y estructura visual.
- `spotify-auth.js`: inicio de sesión mediante Authorization Code con PKCE, permisos mínimos y renovación de token. Por ser una aplicación estática, se guarda la sesión de Spotify en el almacenamiento local del propio navegador; una vulnerabilidad XSS podría exponerla. No se guarda ninguna credencial en GitHub.
- `spotify-editorial.js`: fuentes separadas para la colección pública del propietario y la reproducción privada de cada visitante; carátulas, búsqueda, playlists, estación de canciones, reproducción por SDK.
- `spotify-controls.js` y `spotify-controls.css`: controles de volumen, transporte, cola, dispositivos, repetición, aleatorio, progreso y diagnóstico.
- `musica.html`: única página de retorno OAuth; no es una página musical alternativa.
- `featured.json`: selección pública autorizada; mientras tenga `status: pending_authorization`, la web **no** puede mostrar canciones reales del propietario a usuarios sin sesión.

## Publicar las carátulas del propietario sin exigir inicio de sesión a los visitantes

1. Abrir https://salempro123a-sudo.github.io/ y conectar con Spotify Premium mediante el botón oficial.
2. La cuenta principal tendrá un control discreto en la sección final de la web: **PREPARAR PORTADA PÚBLICA**.
3. Revisar la información que se compartirá. Se incluyen canciones y artistas principales, y únicamente playlists marcadas públicas en Spotify. Las escuchas recientes son opcionales y están desactivadas por defecto.
4. Descargar el archivo `featured.json`. Entregarlo para sustituir el `featured.json` del repositorio mediante un commit a la rama `main`.
5. Los invitados sin cuenta verán el archivo de metadatos público. Para escuchar dentro de nuestra web, deberán autorizar su propia cuenta Premium.

**Importante:** jamás incluir refresh tokens, access tokens, Client Secrets ni credenciales en `featured.json`. El archivo generado contiene solo metadatos musicales destinados a ser públicos.

## Lo que todavía requiere infraestructura

GitHub Pages es alojamiento estático. No puede leer en segundo plano la cuenta del propietario cuando este tiene la web cerrada. Para hacer que «Estoy escuchando ahora» se actualice automáticamente para visitantes sin cuenta, hace falta una función programada en un servicio seguro externo que refresque una autorización del propietario y publique *solo* la información aprobada (no tokens). La instalación y la autorización de ese servicio **no están activadas** en este proyecto.

La API de Spotify de las aplicaciones nuevas no permite acceder a las recomendaciones algorítmicas antiguas, análisis de audio ni letras completas. Para mostrar letras dentro de la web necesitaríamos derechos de un proveedor licenciado, como Musixmatch; no reutilizar interfaces internas o no oficiales de Spotify.

## Pruebas antes de declarar finalizada la reproducción

- Confirmar Redirect URI exacta `https://salempro123a-sudo.github.io/musica.html` en Spotify Developer Dashboard.
- Conectar la cuenta y aceptar los permisos nuevos, especialmente `streaming`.
- Comprobar el menú **DIAGNÓSTICO DEL REPRODUCTOR**; Spotify debe reconocer Premium, el SDK y un dispositivo activo.
- Pulsar directamente ▶ en una canción real (gesto necesario en algunos navegadores).
- Comprobar volumen, pausa, avance, anterior/siguiente, repetición, aleatorio, cola y dispositivos.
- En otra cuenta Premium autorizada, verificar que sus canciones privadas **no alteran la portada** del propietario.
- En una ventana de incógnito sin Spotify, verificar la colección pública publicada en `featured.json`.

No afirmar audio verificado solo con pruebas de sintaxis: requiere una sesión Premium real.

## Cambios verificados de la revisión 2026-10-11

- `favicon.svg`: monograma original T/M para pestañas, en blanco y negro con un pequeño detalle amarillo verdoso. Enlazado desde `index.html` y la devolución OAuth.
- Reproducción: si Spotify Web Playback SDK no permite activar un dispositivo o falla una operación, el botón de canción/playlist abre un **Spotify Embed oficial dentro de la misma página**. No se presupone que el streaming ya fue comprobado con una cuenta Premium real.
- Playlists compartidas: la URL de la página con `?playlist=<ID de 22 caracteres>` abre el embed oficial incluso sin autorizar nuestra aplicación. Esto no proporciona automáticamente el perfil o biblioteca completa del propietario a quien entra anónimamente.
- Letras: se reemplazó el enlace engañoso de «letras» por **Ver letras en Spotify** (abre la canción dentro de Spotify). No hay un endpoint oficial de letras en Spotify Web API; mostrar letras en la web exigiría acuerdos con un proveedor autorizado.
- Sesión: `spotify-auth.js` recuerda la autorización en `localStorage` y usa `sessionStorage` de respaldo cuando el navegador impide la persistencia. El propietario debe usar dispositivos de confianza para este token; pueden eliminarse mediante desconexión.
- Carátulas: la portada no rota automáticamente; intenta separar artistas y álbumes repetidos al componer la cuadrícula. Dos canciones del mismo álbum pueden legítimamente compartir imagen.
- Diagnóstico: tres scripts principales analizados sintácticamente, todas las referencias DOM comprobadas, simulados los estados público/propietario/invitado y el flujo de transferencia y reproducción del SDK con respuestas sintéticas. **No** se afirma que se haya oído audio real, ni que GitHub Pages haya sido abierto desde el entorno de desarrollo.

Para disponer de canciones propias visibles en la portada **sin inicio de sesión**, sigue pendiente publicar una selección autorizada del propietario en `featured.json`; no puede extraerse su biblioteca privada desde solo el enlace público del perfil debido a restricciones de Spotify 2026.

## Revisión editorial y escucha reciente (octubre 2026)

Se conserva la composición original: portada, controles, rail, cuadrículas, bloque abstracto, colecciones, historial, sección de compartir y pie. Los metadatos ficticios o repetidos se han reducido.

- **Para ahora:** selección determinista que prioriza las reproducciones recientes, después las canciones más escuchadas de las últimas semanas y las guardadas. Con sesión autorizada, puede añadir algunos temas encontrados mediante Spotify Search para artistas escuchados recientemente. **No usa ni reproduce el algoritmo cerrado de recomendaciones de Spotify.** Se limita a dos consultas de búsqueda de artista por activación y mantiene los resultados temporalmente en memoria.
- **Me gusta:** consulta `GET /me/tracks` bajo el permiso `user-library-read`, con paginación por lotes. Se muestra una cuadrícula de carátulas original y, cuando no hay playlists, puede completar el rail con canciones guardadas.
- **Sin datos de clasificación:** las carátulas de guardados pueden ocupar la portada, sin canciones inventadas.
- **Portada pública:** `featured.json` puede contener la propiedad `liked`; solo se incorpora al archivo de exportación del propietario si este selecciona explícitamente la casilla «Incluir mis canciones guardadas». Continúa siendo necesaria la subida posterior del archivo a GitHub. En esta revisión `featured.json` sigue en estado `pending_authorization`; no afirma mostrar automáticamente gustos del dueño a visitantes anónimos.
- **Reducción de tráfico:** la vista de favoritos reutiliza el estado ya cargado por el reproductor principal en lugar de duplicar todas las consultas de Top Tracks y escucha reciente.
- **Pruebas:** se comprobaron sintaxis y referencias de DOM; en simulaciones de propietario se cargaron carátulas y se calculó la secuencia reciente. También se verificó que una cuenta invitada no sustituye los títulos de la portada pública. Spotify real y el audio en el navegador del usuario quedan por validar.

La opción «Para ahora» no representa «Spotify Radio», «Discover Weekly», «DJ», «Smart Shuffle» ni otro algoritmo privado. Consultar esas recomendaciones mediante la API de una aplicación nueva no está permitido por las restricciones de noviembre de 2024. Spotify Search únicamente permite explorar el catálogo mediante criterios explícitos.

## Revisión funcional y visual adicional

- El estado y los errores del reproductor ya no se imprimen debajo del reproductor; los últimos 15 errores se almacenan solo en memoria de la pestaña y están disponibles en «Más opciones → Diagnóstico». No se guardan tokens ni contraseñas en ese registro.
- `spotify-auth.js` valida respuestas de la Web API antes de intentar interpretarlas como JSON; una respuesta no JSON genera un error manejado, sin mostrar el texto crudo de la API.
- `spotify-library.js` añade navegador editorial de listas con búsqueda, filtro por nombres de radios/mixes y paginación de hasta 50 playlists por petición. No garantiza acceso a las radios algorítmicas de Spotify que no se exponen en `GET /me/playlists`.
- `spotify-polish.css` y `spotify-polish.js` conservan la estructura original y ralentizan el marquee (95 s), rotaciones decorativas y punto rojo. La luz responde a reproducir/pausar, **NO al BPM real**: la API/SDK no entregan señal PCM ni pulso de audio para esa función.
- En sesión del propietario, los artistas del bloque verde y el historial reciente se actualizan con una nueva escucha detectada por `GET /me/player`; mientras la web esté cerrada no existe sincronización pública en tiempo real sin backend independiente.
- «Otras canciones» y «Sorpréndeme» construyen una rotación distinta con los datos actuales y, si hay permiso de catálogo, buscan más temas en distintas páginas de resultados de artistas recientes y discos. Evitan propuestas ya ofrecidas mediante una lista acotada almacenada en el navegador. No afirman ser Spotify Radio ni Spotify Recommendations.
- Se retiraron etiquetas editoriales redundantes, explicaciones dirigidas al dueño, subtítulos duplicados, números ficticios y la frase de cierre que no aportaba contenido.
- Validación: scripts analizados sin errores de sintaxis, ids y enlaces internos resueltos, simulación de cuenta autorizada que carga carátulas, favoritas, 50 playlists y reproduce el estado play/pause; simulación de la paginación con la solicitud `/me/playlists?limit=50&offset=50`.
- A fecha de esta revisión, suma de los 13 archivos principales HTML/CSS/JS/SVG/JSON: **145 340 bytes (141,9 KiB)**; `index.html`: **55 765 bytes (54,5 KiB)**. Excluye fuentes, carátulas y recursos de Spotify de terceros. El tamaño informado por GitHub para el repositorio completo es aproximadamente 680 KB, incluyendo datos no equivalentes al peso transferido en una visita.

El despliegue público y el audio real necesitan comprobación desde una sesión Premium autorizada en un navegador. La selección pública del propietario sigue requiriendo `featured.json` autorizado, que no ha sido recibido ni publicado (`status: pending_authorization`).

## Revisión de reproductor, recomendaciones y playlists — octubre 2026

- «Para ahora» ya no fija como primera canción la favorita con mayor puntuación (el fallo de «Rock DJ»). Alterna inicios, almacena localmente una lista limitada de inicios recientes y explora canciones no guardadas, pistas de álbumes y artistas colaboradores que aparecen en los créditos musicales de Spotify. No accede al algoritmo privado Spotify Radio ni promete calidad idéntica al algoritmo oficial.
- Los datos de la biblioteca y reproducción siguen perteneciendo a la cuenta autorizada. Para visitantes sin login continúa pendiente la publicación consentida de `featured.json` del propietario.
- El navegador de playlists tiene detalle interno. En listas propias o colaborativas obtiene canciones mediante `GET /playlists/{id}/items` (Spotify Developer API, restricciones 2026), con paginación, y selecciona una pista por `context_uri` + `offset.position` para continuar la lista. En listas ajenas restringidas muestra un Spotify Embed oficial, no inventa la lista de canciones.
- Los nombres de artistas del bloque verde abren un explorador modal que busca canciones reales del catálogo y permite reproducirlas; ofrece atribución/enlace al artista en Spotify.
- «Me gusta» muestra seis tarjetas por página en escritorio, tres o dos según pantalla. Flechas anterior/siguiente cambian el grupo sin desplazar la página hacia abajo; se ocultan cuando solo hay una página.
- Minirreproductor inferior izquierdo visible tras alejarse del principal, vinculado al mismo play/pause y volumen. La banda negra superior también incorpora volumen. El texto redundante de dispositivo permanece fuera de la vista y se consulta en Diagnóstico.
- Marquee amarillo vuelve a moverse a 43 s por ciclo; asterisco rota a 20 s; punto rojo parpadea suavemente cada 1,85 s cuando está sonando. `prefers-reduced-motion` tiene precedencia y detiene el movimiento si así lo pide el sistema operativo. No se simula un falso ritmo musical.
- Se conserva exactamente la organización editorial anterior: portada, rail, cuadrículas, bloque abstracto, colecciones y parte inferior.
- Pruebas: inspección estática de referencias e IDs, simulación de rotación con tres canciones durante seis sesiones (inicios alternados sin repetición inmediata), playlist propia con selección de pista n.º 2, playlist ajena 403 con iframe oficial, exploración de artista y minirreproductor; todas pasaron. El audio real y el despliegue de GitHub Pages **no** pudieron comprobarse con una sesión Premium desde este entorno.

## Revisión NTS y favoritos — 12 octubre 2026

- Cabecera: campo de búsqueda en línea con lupa y resultados seleccionables del catálogo Spotify; nombre real del perfil conectado, sin etiqueta fija «MI CUENTA». El sistema anterior de búsqueda en overlay permanece en el historial de código, no se invoca desde la lupa.
- Carrusel: contador real `n / N` restaurado. Si el propietario está escuchando una canción externa a su rotación, se añade a la lista del carrusel y se mantiene coherente el contador.
- Reproductor: barra blanca de audio fija inferior, inspirada en capturas NTS aportadas por el propietario, con carátula, canción/artista, pausa, cronología, control de avance, corazón y volumen; sincronizada con el player principal. Banda superior y reproductor inferior **controlan la misma sesión de Spotify**, no son dos transmisiones independientes. El punto rojo de estado ya no se elimina cuando se actualiza una canción.
- Favoritos: `spotify-favorites.js` usa los nuevos endpoints `GET /me/library/contains`, `PUT /me/library`, `DELETE /me/library` con la URI Spotify de la canción. El scope `user-library-modify` se solicita desde OAuth; los usuarios autorizados con el scope anterior deben **desconectar y volver a autorizar una vez**. Me gusta se actualiza dentro de la vista personal del propietario. No se muestran tokens.
- «Para ahora»: prepara una cola completa con artistas recientes, favoritas y descubrimientos y evita inicios idénticos. «Sorpréndeme» prioriza temas ajenos al conjunto familiar, y también envía una cola completa; no se presenta como el algoritmo de Spotify Radio.
- Carátulas y tarjetas: oscurecimiento al pasar el cursor, títulos sobre fondo negro en portada, hover en tarjetas y fuentes condensadas predominantes; se mantienen las secciones originales y los controles anteriores funcionales.
- Diseño y accesibilidad: menú de búsqueda responsive, indicador de estado discreto, preferencias de movimiento reducido y barra blanca inferior que reserva espacio para no tapar el pie de página. No se copian recursos ni código privado de NTS.
- QA estática y sintética realizada: prueba de tres URI enviadas a `PUT /me/player/play`, estados de favorito y guardado, campo de búsqueda con resultados Spotify, contador y nombre de perfil. **El sonido real y la disposición visual en el navegador del propietario siguen pendientes de comprobación directa.**
- Para un motor realmente colaborativo e independiente del catálogo personal se han evaluado Last.fm `track.getSimilar` (requiere clave API) y ListenBrainz `cf/recommendation` (requiere historial importado/sincronizado y cuenta). No se han conectado porque esos datos y autorizaciones no están configurados; sería engañoso afirmar que ya funcionan.

## Ajustes comprobados de composición y navegación (12 octubre 2026)

- Se recuperó la referencia local `TRANSMISSION_PUBLIC.html` del primer prototipo para comparar proporciones y elementos presentes, sin copiar software ni multimedia del sitio externo NTS.
- `spotify-precision.css` es la última hoja de estilos: restaura el ticker con dos ciclos idénticos y asteriscos separados, anula la pausa por hover, recupera el giro del asterisco del bloque verde y de En rotación, incluso cuando el navegador infiere reducción de movimiento. Esta animación concreta responde a una preferencia expresa del propietario.
- La columna editorial ocupa alrededor del 30,5 % en escritorio y presenta hasta seis tarjetas musicales reales en mosaico. Si la cuenta tiene pocas playlists, las plazas restantes se completan con pistas guardadas reales; no se generan nombres de emisoras ficticias.
- Se eliminó el texto visible «BUSCAR MÚSICA» de la barra de búsqueda. La lupa y la línea quedan disponibles, y el campo conserva nombre accesible para lectores de pantalla.
- «Me gusta» ahora expone orden (recientes, antiguas, título, artista), recuento y posición `01–06 / 107`, botones anterior y siguiente, una vista «Ver todas» con búsqueda por canción, artista o álbum, y carga paginada del archivo. El orden no se declara completo antes de consultar las páginas necesarias.
- Se retiraron las flechas diagonales que solo ornamentaban contadores de Colecciones.
- La barra blanca inferior ocupa aproximadamente el 68 % de la pantalla en escritorio, y todo el ancho en pantallas pequeñas. Añade anterior, siguiente, compartir canción, y cola editable por selección. Usa la cola que creó TRANSMISSION y, si no existe, consulta `GET /me/player/queue` de Spotify solo cuando el usuario abre el panel.
- No hay dos flujos de streaming independientes: los controles negros superiores y la barra blanca inferior operan la sesión autorizada del mismo dispositivo Spotify.
- Comprobaciones: sintaxis de diez scripts, referencias HTML y enlaces internos sin destinos ausentes ni duplicados, compatibilidad de animación bajo `prefers-reduced-motion: no-preference` y `reduce` en Chromium, simulación de biblioteca Spotify de 107 canciones (50 + 50 + 7), recuentos precisos, búsqueda y orden, mini-cola de tres canciones y reproducción desde un punto posterior.
- La publicación en GitHub se realizó, pero el entorno no pudo abrir la URL desplegada para verificar el resultado visual ni reproducir audio con una sesión Spotify Premium auténtica; esa prueba no debe presentarse como aprobada.

## Continuación con las referencias originales (11 octubre 2026, Lima)

- Se recuperó el repositorio completo y el contexto visible del chat anterior. Hay partes antiguas de la conversación que no estaban accesibles; no se consideran recuperadas ni se inventan decisiones faltantes.
- El propietario aportó `NTS-extraida.zip` y `my-archiving-session.wacz`. Ambos contienen NTS, como referencia de diseño. El WACZ de ArchiveWeb.page conserva recursos y respuestas HTTP, no una copia de TRANSMISSION. Se extrajeron y verificaron sin ejecutar sus scripts.
- `spotify-nts.css`, cargado después de las hojas anteriores, aplica las medidas recuperadas: cabecera de44px, barra superior de33px, botón de portada de48px separado de las placas negras y reproductor inferior blanco de60px, con840px/1000px en escritorio. Tablet usa portada horizontal; móvil conserva todos los controles del reproductor en dos filas.
- La columna de listas ajusta sus filas al contenido disponible. Los accesos sin catálogo personal publicado llevan a sus secciones correspondientes. No se presentan canciones ficticias como selecciones personales.
- Las selecciones conservan toda la biblioteca local y comienzan en la canción elegida. Los reproductores principal y compacto muestran la misma secuencia pendiente y permiten elegir dentro de ella. Spotify recibe ventanas conservadoras de40 URI y los siguientes elementos se añaden con la API de cola;40 es una decisión de esta implementación, no un límite declarado por Spotify.
- Se corrigen respuestas tardías al cambiar de playlist y al cerrar la búsqueda. Las pruebas sintéticas cubren107 favoritas, orden global, búsqueda, cola, selección de artista y esos cambios rápidos.
- Se revisó la página en Chromium a tamaños de escritorio y móvil. La reproducción de audio con una cuenta Premium real sigue pendiente. `featured.json` sigue pendiente de autorización: la portada pública no debe fingir disponer del catálogo privado del propietario.
- Al revisar la web publicada, la sesión guardada recibió 429 en la consulta del perfil. Ahora ese fallo carga la portada pública y deja la interfaz lista, sin borrar la autorización ni repetir el login. Esta recuperación también se probó con y sin catálogo público; pasan 8 grupos de regresiones.

## Conexión autorizada y cuota de Spotify

- Se comprobó el recorrido real del botón: el callback cargó correctamente y el intercambio OAuth devolvió 200; después `GET /me` devolvió 429 con `reason: QUOTA_EXCEEDED` y `Retry-After: 67091`. La cuenta autorizó la aplicación, pero la cuota del servicio impidió cargar el perfil. No se considera una prueba de reproducción Premium.
- La cabecera muestra «SPOTIFY EN ESPERA» y el reproductor ofrece «REINTENTAR» con la fecha indicada por Spotify. Pulsarlo durante ese plazo explica el bloqueo y evita repetir OAuth. Cuando vence, permite recuperar la conexión con la autorización existente. El enlace de desconexión se identifica correctamente incluso sin perfil.
- El cliente respeta `Retry-After` y conserva el periodo de espera al recargar. No envía más llamadas a la Web API mientras está vigente. Distingue cuota agotada de un límite de solicitudes, y una respuesta temporal al renovar el token conserva la sesión; `invalid_grant` sigue exigiendo una autorización nueva.
- El corazón del reproductor principal se centra verticalmente en la información de la canción.
- Pruebas: los 8 grupos anteriores, incluidos los clics de conexión bloqueada, y 5 comprobaciones del cliente de autorización pasan. Se cubren espera persistente, vencimiento, 429 sin JSON, renovación temporalmente fallida y refresh token inválido. El servidor de Spotify determina cuándo vuelve a admitir el acceso; ningún cambio de esta web levanta esa cuota.
