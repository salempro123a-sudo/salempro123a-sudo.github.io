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

## Navegar y preparar la cola

La lupa conserva el campo de búsqueda de la cabecera. Muestra canciones rápidas con sus acciones; Enter o **Ver todos los resultados** abre el explorador. **Explorar** también permite comenzar desde artistas personales y géneros. Hay filtros de canciones, artistas, álbumes y playlists, carga de más resultados y botones para volver a la vista anterior o siguiente. Reproducir mantiene abierta la navegación; el reproductor sigue accesible en el explorador, las favoritas y las listas.

Cada canción tiene **+** para añadir a la cola y un menú **…** para reproducir después, guardar o quitar de Me gusta, abrir álbum/artista y compartir el enlace. Guardar una canción desde los resultados actualiza las favoritas aunque sea distinta de la que suena. Escuchar o añadir un álbum carga primero todas sus páginas disponibles. La búsqueda reproduce la selección de resultados que se ha cargado.

Las selecciones iniciadas dentro de TRANSMISSION permiten subir, bajar, quitar canciones y vaciar las pendientes. La canción actual se muestra aparte. Para sincronizar estas ediciones con Spotify se reconstruye la ventana de reproducción desde la posición actual y se restablece la pausa si corresponde; esta operación puede producir un breve reinicio del audio. Las ediciones se confirman tras la respuesta de Spotify, se serializan y se rechazan si la canción o la selección cambió durante una acción sobre una posición concreta.

Una cola controlada desde Spotify se consulta y admite adiciones mediante el endpoint oficial. Su interfaz no muestra controles para quitar o reordenar, porque Spotify no ofrece esos endpoints. Activar el aleatorio nativo en una selección ya cargada pasa la cola a esa vista de Spotify. Antes de iniciar una reproducción se puede preparar una cola local sin arrancar el audio. Los datos de cola y las cachés permanecen en el navegador y no se publican.

Atajos fuera de campos y botones: `/` enfoca la búsqueda, espacio reproduce/pausa, izquierda/derecha avanza cinco segundos y Mayús + izquierda/derecha cambia de canción. Escape cierra el menú o panel activo.

La búsqueda utiliza páginas de diez resultados y las funciones de reproducción requieren los permisos y el plan admitidos por Spotify. Referencias: [migración de la API](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [añadir a la cola](https://developer.spotify.com/documentation/web-api/reference/add-to-queue).

La web usa carátulas y metadatos de Spotify. No distribuye el reproductor, las tipografías privadas ni las fotografías editoriales de NTS. Las capas antiguas de CSS y el segundo reproductor se retiraron; las versiones anteriores siguen en el historial Git.

## Selección pública opcional

`featured.json` sigue con `status: pending_authorization`. Los visitantes sin sesión ven acciones para conectar Spotify. El catálogo privado de una cuenta nunca se publica automáticamente.

La cuenta del propietario puede abrir **Más opciones → Selección pública** y descargar metadatos: canciones y artistas seleccionados, solo playlists públicas, y favoritas o historial si marca esas opciones. El archivo puede publicarse después mediante un cambio explícito en `featured.json`. Nunca debe contener credenciales. GitHub Pages no consulta la cuenta del propietario en segundo plano.

## Límites y comprobación

Una respuesta 429 conserva la autorización y respeta el plazo disponible. `spotify-status.json` contiene únicamente información pública del límite observado y caduca; no contiene datos de cuenta. Cuando CORS oculta el encabezado de espera y no existe un plazo confirmado, la interfaz distingue una pausa de solicitudes de un restablecimiento conocido de la cuota.

La verificación local incluye bibliotecas de 107 canciones, reproducción desde el índice elegido, secuencias largas, cambios rápidos de playlist, búsquedas tardías, cola, estados de repetición, renovación de sesión y separación de datos entre cuentas. Se comprobaron escritorio y móvil entre 320 y 1440 píxeles. Las pruebas sintéticas complementan la comprobación real con Spotify y no sustituyen una cuenta Premium.

Actualización del 19 de octubre de 2026: se ejecutaron comprobaciones específicas de cola preparada, continuación de 107 pistas, edición con posición y pausa, rechazo de API, adiciones concurrentes, cambios durante una edición, cola externa, dispositivo elegido y favoritos de canciones sin reproducir. El navegador se revisó con una cuenta simulada, incluida búsqueda paginada, respuesta lenta descartada, álbumes, navegación y móvil de 375 píxeles. No se verificó audio real con una cuenta Premium durante esta actualización. Las pruebas y la cuenta simulada se conservan fuera del código publicado.
