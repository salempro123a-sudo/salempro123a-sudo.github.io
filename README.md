# TRANSMISSION

Archivo musical personal publicado en https://salempro123a-sudo.github.io/.

La portada adapta la composición de NTS capturada el 12 de octubre de 2026: cabecera negra, dos canales de control de una misma sesión, portada con carátula, mosaico de listas, tarjetas editoriales, favoritas, artistas, colecciones, últimas escuchas y cierre con playlists compartidas. Conserva la identidad TRANSMISSION y el banner «MY FREQUENCY / MUSIC THAT STAYS / NO FIXED GENRE».

Cada visitante autorizado carga su propia rotación, playlists, favoritas, historial y artistas. La cuenta del propietario solo tiene una función adicional: preparar una selección pública opcional. El acceso de otras cuentas está sujeto al modo de cuota y a los usuarios admitidos por la aplicación en Spotify; la reproducción mediante Web Playback SDK requiere Premium.

## Fuente

- `index.html`, `transmission.css` y `transmission-catalog.css`: composición editorial y vistas de navegación, adaptables a móvil.
- `spotify-auth.js`: OAuth PKCE, sesión en el navegador, renovación y espera tras límites de Spotify. No hay Client Secret ni tokens en el repositorio.
- `musica.html`: retorno OAuth.
- `spotify-editorial.js`: datos de la cuenta, portada y secuencias de reproducción por el SDK oficial.
- `spotify-controls.js` y `spotify-queue.js`: un reproductor blanco inferior con transporte, progreso, volumen, cola, compartir, dispositivos, repetición y aleatorio.
- `spotify-favorites.js`: guardar/quitar canciones, consultas agrupadas y caché por cuenta y canción.
- `spotify-taste.js`, `spotify-library.js`, `spotify-search.js` y `spotify-artist.js`: paginación, ordenación, archivo de listas, búsqueda y artistas.
- `spotify-polish.js` y `transmission-ui.js`: composición y estados visuales; no generan audio simulado.
- `spotify-catalog.js`, `spotify-search.js` y `spotify-track-actions.js`: búsqueda paginada, navegación entre artistas y álbumes, y acciones por canción.
- `transmission-navigation.js` y `transmission-pages.css`: páginas del archivo, direcciones compartibles e historial del navegador.
- `transmission-listening.js`: ficha de escucha, historial de la sesión, guía y temporizador local.
- `transmission-archive.js` y `transmission-archive.css`: discos guardados, afinidad por periodo y composición del bloque de playlists.

## Datos personales de la cuenta

El bloque **Mis listas** contiene únicamente playlists. La cabecera no repite una portada como fondo; las carátulas conservan su proporción, los títulos aparecen debajo y los accesos de reproducción tienen su propio espacio. Se muestran hasta cuatro listas y la flecha de la cabecera abre el resto. Una única playlist utiliza una fila con carátula y texto separados.

**Discos guardados** (`#/discos`) lee los álbumes de la biblioteca, con artistas, año de publicación y fecha de guardado. Se pueden filtrar los discos cargados, cargar otros veinte y abrir su ficha para escucharlos o añadirlos a la cola.

**En rotación** (`#/rotacion`) permite consultar canciones o artistas por afinidad durante cuatro semanas, seis meses o aproximadamente un año. El tipo y el periodo forman parte de la dirección. Los resultados mantienen el orden que entrega Spotify; no representan un recuento exacto de reproducciones.

**Historial** muestra las fechas y horas de las escuchas recientes que ya se cargan al abrir la cuenta, agrupadas por día. Conserva las repeticiones de una canción en los registros de Spotify. Las canciones observadas durante la sesión se muestran aparte.

Las nuevas lecturas usan los permisos que ya solicita la aplicación: `user-library-read` y `user-top-read`. Los discos se solicitan al abrir su página y al pulsar más; los rankings se consultan al elegir tipo y periodo. Hay caché en memoria por cuenta durante cinco minutos y se mantiene el manejo existente de límites. No se amplían OAuth ni sus permisos ni se cambia la inicialización del reproductor.

Referencias oficiales consultadas: [álbumes guardados](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-albums), [afinidad por periodo](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks) e [historial reciente](https://developer.spotify.com/documentation/web-api/reference/get-recently-played).

## Páginas del archivo

La referencia de esta ampliación es el ZIP `NTS-extraida.zip` entregado por el usuario. Se revisaron su `index.html`, `css/style.min.5eb6b8e09ade1844.css` y `js/app.min.73ed3e4d94996f24.js`: la página `search-page`, sus pestañas `nts-toggle`, las filas `search-results-v2`, la navegación y el reproductor expandido con `up-next`. Se adaptaron la jerarquía tipográfica, los separadores y la organización del archivo a la identidad existente de TRANSMISSION.

Buscar, explorar, abrir artistas y álbumes, listas y favoritas son páginas con dirección propia. La portada se sustituye por la página elegida; se conservan la cabecera y el reproductor. Las URL usan rutas después de `#`, compatibles con GitHub Pages y con enlaces directos, recarga y los botones atrás/adelante. Navegar mantiene la misma sesión de audio.

- `#/explorar`: géneros, artistas personales, canciones y búsquedas recientes.
- `#/buscar?q=...&tipo=track`: resultados; también admite `artist`, `album` y `playlist`.
- `#/artista/ID?nombre=...`, `#/album/ID?nombre=...` y `#/playlist/ID?nombre=...`: fichas enlazables.
- `#/playlists`, `#/guardadas`, `#/rotacion` y `#/historial`: archivo personal.
- `#/escuchando`: carátula, transporte y posición, álbum y artistas, guardar, compartir y siguientes. También se abre tocando la carátula del reproductor inferior.
- `#/atajos`: guía de uso y teclado.

Las ocho búsquedas recientes se guardan en este navegador y se separan por cuenta. Se pueden borrar desde Explorar. La lupa y `/` abren la página de búsqueda. La consulta se envía al pulsar Enter o Buscar; no hay otro buscador desplegable ni peticiones por cada letra. Volver a una página conserva los resultados cargados y su posición de lectura durante la sesión.

El temporizador está en **Más opciones**, identificado por un reloj. Permite pausar en 15, 30, 45 o 60 minutos; se cancela eligiendo Desactivado. El tiempo restante aparece dentro de ese menú. Sigue activo al navegar y requiere mantener abierta la pestaña. Al recargar o cerrar la pestaña se cancela. Usa la pausa del SDK o el control de pausa ya autorizado para el dispositivo activo; no pide permisos adicionales ni inicia audio. El historial combina los datos ya cargados con las canciones escuchadas durante la sesión, sin consultas nuevas de historial.

La ampliación conserva OAuth, su configuración, los permisos solicitados, la renovación de sesión y la integración del Web Playback SDK. No añade servicios musicales externos ni credenciales.

## Navegar y preparar la cola

La lupa abre el buscador como página. **Explorar** también permite comenzar desde artistas personales y géneros. Hay filtros de canciones, artistas, álbumes y playlists, carga de más resultados y botones para volver a la vista anterior o siguiente. Si una búsqueda de canciones coincide exactamente con un artista, aparece un acceso a su ficha. Reproducir mantiene abierta la navegación; el reproductor sigue accesible en el explorador, las favoritas y las listas.

La ficha del artista tiene pestañas **Canciones** y **Discos**, con direcciones propias (`vista=discos`, y `grupo=album|single|appears_on`). La selección inicial busca unas treinta canciones, consultando páginas de diez hasta un máximo de cinco peticiones por tanda. **Más canciones** continúa desde el siguiente resultado. Spotify limita la búsqueda a mil resultados: no se presenta ese buscador como una exportación de toda la obra. La discografía se pagina de forma independiente, de diez en diez, agrupando dos páginas por tanda. Se pueden abrir álbumes, singles, EP y apariciones y recorrer sus canciones. No se utiliza el endpoint retirado de canciones principales del artista.

Artistas y álbumes utilizan una ficha lateral en escritorio y una cabecera compacta en móvil. Las filas de canciones muestran enlaces directos a artistas o al álbum correspondiente, duración, añadir a la cola y opciones. **Me gusta** utiliza estas mismas filas con búsqueda y ordenación; las portadas ya no se repiten como una cuadrícula de tarjetas en esa página. Las migas, rótulos de tipo y párrafos de instrucciones se retiraron de las pantallas de escucha.

Cada canción tiene **+** para añadir a la cola y un menú **…** para reproducir después, guardar o quitar de Me gusta, abrir álbum/artista y compartir el enlace. Guardar una canción desde los resultados actualiza las favoritas aunque sea distinta de la que suena. Escuchar o añadir un álbum carga primero todas sus páginas disponibles. La búsqueda reproduce la selección de resultados que se ha cargado.

Las selecciones iniciadas dentro de TRANSMISSION permiten subir, bajar, quitar canciones y vaciar las pendientes. La canción actual se muestra aparte. Para sincronizar estas ediciones con Spotify se reconstruye la ventana de reproducción desde la posición actual y se restablece la pausa si corresponde; esta operación puede producir un breve reinicio del audio. Las ediciones se confirman tras la respuesta de Spotify, se serializan y se rechazan si la canción o la selección cambió durante una acción sobre una posición concreta.

Una cola controlada desde Spotify se consulta y admite adiciones mediante el endpoint oficial. Su interfaz no muestra controles para quitar o reordenar, porque Spotify no ofrece esos endpoints. Activar el aleatorio nativo en una selección ya cargada pasa la cola a esa vista de Spotify. Antes de iniciar una reproducción se puede preparar una cola local sin arrancar el audio. Los datos de cola y las cachés permanecen en el navegador y no se publican.

Atajos fuera de campos y botones: `/` enfoca la búsqueda, espacio reproduce/pausa, izquierda/derecha avanza cinco segundos y Mayús + izquierda/derecha cambia de canción. `Q` abre la cola, `N` abre lo que suena y `?` abre la guía. Escape cierra menús y cola; las páginas se recorren con sus enlaces y con el historial del navegador.

La búsqueda utiliza páginas de diez resultados y las funciones de reproducción requieren los permisos y el plan admitidos por Spotify. Referencias: [migración de la API](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [añadir a la cola](https://developer.spotify.com/documentation/web-api/reference/add-to-queue).

La web usa carátulas y metadatos de Spotify. No distribuye el reproductor, las tipografías privadas ni las fotografías editoriales de NTS. Las capas antiguas de CSS y el segundo reproductor se retiraron; las versiones anteriores siguen en el historial Git.

## Variedad de la portada

`transmission-selection.js` separa el carrusel de portada, las ocho tarjetas y la mezcla de favoritas. Deduplica ediciones de la misma canción y distribuye artistas y álbumes. La memoria de canciones mostradas y portadas anteriores se guarda en este navegador por cuenta; prioriza canciones sin mostrar y evita repetir la portada anterior mientras haya alternativas. Una canción que esté sonando actualiza el reproductor, sin sustituir las selecciones editoriales.

La portada combina hasta cincuenta canciones por cada uno de los tres periodos de afinidad, las favoritas recientes, una página de favoritas antiguas y una búsqueda de catálogo de diez resultados de un artista de la colección. La página antigua cambia entre visitas y recorre la colección completa con el tiempo, empezando por su mitad más antigua. Son lecturas con los permisos existentes. La afinidad se conserva quince minutos en la pestaña, por cuenta; esa caché se borra al desconectar. El catálogo y las páginas antiguas no se consultan mediante temporizadores.

**Otras canciones** prepara una nueva portada y tarjetas con la selección cargada. Como máximo una vez por minuto incorpora otra página de favoritas y solicita la selección de descubrimiento existente; ese descubrimiento se reutiliza durante cinco minutos. Las favoritas de la portada comienzan en **Mezcla**, mantienen una selección estable al navegar y al redimensionar, y se renuevan con la portada o al recorrer sus páginas. **Recientes**, **Antiguas**, **A–Z** y **Artista** siguen disponibles; la página **Ver todas** conserva su ordenación independiente. El historial mantiene su orden real de escucha.

**Explorar** tiene diez canciones seleccionadas de forma independiente, evitando las que ya aparecen en portada y en la mezcla visible de favoritas. Sus canciones permanecen estables al volver atrás y adelante; se renuevan al cambiar la rotación. Ya no copia las últimas escuchas en esa página.

La selección se renueva al entrar y mediante sus controles; renovar la vista no inicia audio ni reemplaza una cola en reproducción. La memoria queda limitada a ochocientas identidades de canciones y treinta portadas. Los datos personales y esa memoria no se publican en GitHub.

Se revisó el código de esta ampliación. No se ejecutaron pruebas automatizadas ni se comprobó la selección con una cuenta Premium conectada.

## Selección pública opcional

`featured.json` sigue con `status: pending_authorization`. Los visitantes sin sesión ven acciones para conectar Spotify. El catálogo privado de una cuenta nunca se publica automáticamente.

La cuenta del propietario puede abrir **Más opciones → Selección pública** y descargar metadatos: canciones y artistas seleccionados, solo playlists públicas, y favoritas o historial si marca esas opciones. El archivo puede publicarse después mediante un cambio explícito en `featured.json`. Nunca debe contener credenciales. GitHub Pages no consulta la cuenta del propietario en segundo plano.

## Límites y comprobación

Una respuesta 429 conserva la autorización y respeta el plazo disponible. `spotify-status.json` contiene únicamente información pública del límite observado y caduca; no contiene datos de cuenta. Cuando CORS oculta el encabezado de espera y no existe un plazo confirmado, la interfaz distingue una pausa de solicitudes de un restablecimiento conocido de la cuota.

Las comprobaciones anteriores del repositorio incluyen bibliotecas de 107 canciones, secuencias largas, cambios rápidos de playlist, búsquedas tardías, cola, repetición y renovación de sesión. Esos resultados pertenecen a sus revisiones anteriores.

En la revisión de navegación y composición posterior a `4500ec0` se revisó el código y la presentación con composiciones estáticas de muestra, sin sesión ni reproducción, además de las páginas públicas. No se ejecutaron pruebas automatizadas ni se verificó audio real con una cuenta Premium en esta revisión. Las composiciones de muestra y la referencia NTS permanecen fuera del código publicado.

Referencias de paginación consultadas: [búsqueda](https://developer.spotify.com/documentation/web-api/reference/search), [artista](https://developer.spotify.com/documentation/web-api/reference/get-an-artist) y [discografía](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-albums). Las peticiones de discografía respetan su máximo actual de diez resultados.
