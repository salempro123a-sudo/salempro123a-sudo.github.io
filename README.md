# TRANSMISSION

Archivo musical personal publicado en https://salempro123a-sudo.github.io/.

La portada adapta la composición de NTS capturada el 12 de octubre de 2026: cabecera negra, dos canales de control de una misma sesión, portada con carátula, mosaico de listas, tarjetas editoriales, favoritas, artistas, colecciones, últimas escuchas y cierre con playlists compartidas. Conserva la identidad TRANSMISSION y el banner «MY FREQUENCY / MUSIC THAT STAYS / NO FIXED GENRE».

Cada visitante autorizado carga su propia rotación, playlists, favoritas, historial y artistas. La cuenta del propietario solo tiene una función adicional: preparar una selección pública opcional. El acceso de otras cuentas está sujeto al modo de cuota y a los usuarios admitidos por la aplicación en Spotify; la reproducción mediante Web Playback SDK requiere Premium.

## Fuente

- `index.html` y `transmission.css`: estructura y una sola hoja de estilos, adaptable a móvil.
- `spotify-auth.js`: OAuth PKCE, sesión en el navegador, renovación y espera tras límites de Spotify. No hay Client Secret ni tokens en el repositorio.
- `musica.html`: retorno OAuth.
- `spotify-editorial.js`: datos de la cuenta, portada y secuencias de reproducción por el SDK oficial.
- `spotify-controls.js` y `spotify-queue.js`: un reproductor blanco inferior con transporte, progreso, volumen, cola, compartir, dispositivos, repetición y aleatorio.
- `spotify-favorites.js`: guardar/quitar canciones, consultas agrupadas y caché por cuenta y canción.
- `spotify-taste.js`, `spotify-library.js`, `spotify-search.js` y `spotify-artist.js`: paginación, ordenación, archivo de listas, búsqueda y artistas.
- `spotify-polish.js` y `transmission-ui.js`: composición y estados visuales; no generan audio simulado.

La web usa carátulas y metadatos de Spotify. No distribuye el reproductor, las tipografías privadas ni las fotografías editoriales de NTS. Las capas antiguas de CSS y el segundo reproductor se retiraron; las versiones anteriores siguen en el historial Git.

## Selección pública opcional

`featured.json` sigue con `status: pending_authorization`. Los visitantes sin sesión ven acciones para conectar Spotify. El catálogo privado de una cuenta nunca se publica automáticamente.

La cuenta del propietario puede abrir **Más opciones → Selección pública** y descargar metadatos: canciones y artistas seleccionados, solo playlists públicas, y favoritas o historial si marca esas opciones. El archivo puede publicarse después mediante un cambio explícito en `featured.json`. Nunca debe contener credenciales. GitHub Pages no consulta la cuenta del propietario en segundo plano.

## Límites y comprobación

Una respuesta 429 conserva la autorización y respeta el plazo disponible. `spotify-status.json` contiene únicamente información pública del límite observado y caduca; no contiene datos de cuenta. Cuando CORS oculta el encabezado de espera y no existe un plazo confirmado, la interfaz distingue una pausa de solicitudes de un restablecimiento conocido de la cuota.

La verificación local incluye bibliotecas de 107 canciones, reproducción desde el índice elegido, secuencias largas, cambios rápidos de playlist, búsquedas tardías, cola, estados de repetición, renovación de sesión y separación de datos entre cuentas. Se comprobaron escritorio y móvil entre 320 y 1440 píxeles. Las pruebas sintéticas complementan la comprobación real con Spotify y no sustituyen una cuenta Premium.
