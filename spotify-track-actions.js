/* Shared song rows and a single keyboard-accessible action menu. */
(function(){
'use strict';
const rt=window.TransmissionRuntime;if(!rt)return;
const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const art=t=>{const url=t?.album?.images?.[0]?.url||t?.images?.[0]?.url;return /^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-ak\.spotifycdn\.com)\//.test(url||'')?url:''};
const by=t=>(t?.artists||[]).map(a=>a.name).filter(Boolean).join(', ');
const format=ms=>{const seconds=Math.floor((Number(ms)||0)/1000);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')};
const menu=make('div','tm-track-menu');menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Opciones de canción');document.body.append(menu);
let anchor=null,active=null;
function fail(error){rt.status(error.message,true);rt.notify(error.message||'No se pudo completar la acción.')}
async function run(button,operation){if(button.disabled)return;button.disabled=true;try{return await operation()}catch(error){fail(error)}finally{if(button.isConnected)button.disabled=false}}
function close(restore=false){const previous=anchor;menu.hidden=true;anchor?.setAttribute('aria-expanded','false');anchor=null;active=null;if(restore&&previous?.isConnected)previous.focus()}
function position(){
 if(!anchor?.isConnected){close();return}
 const box=anchor.getBoundingClientRect(),rect=menu.getBoundingClientRect();
 menu.style.left=Math.max(8,Math.min(window.innerWidth-rect.width-8,box.right-rect.width))+'px';
 menu.style.top=Math.max(8,Math.min(window.innerHeight-rect.height-8,box.bottom+5))+'px';
}
function entry(label,operation,disabled=false){
 const button=make('button','',label);button.type='button';button.setAttribute('role','menuitem');button.disabled=disabled;
 button.onclick=()=>{close();Promise.resolve().then(operation).catch(fail)};menu.append(button);return button;
}
async function copy(track){await navigator.clipboard.writeText('https://open.spotify.com/track/'+track.id);rt.notify('Enlace copiado.')}
function open(track,button){
 if(anchor===button&&!menu.hidden){close(true);return}
 close();active=track;anchor=button;button.setAttribute('aria-expanded','true');menu.replaceChildren();
 const label=make('div','tm-track-menu-title',track.name);menu.append(label);
 entry('REPRODUCIR DESPUÉS',()=>rt.enqueueTracks([track],{next:true}),!rt.account||(!rt.managedQueue&&!!rt.state?.trackId));
 entry('AÑADIR A LA COLA',()=>rt.enqueueTracks([track]),!rt.account);
 const saved=window.TransmissionFavorites?.isSaved(track);
 const favorite=entry(saved===true?'QUITAR DE ME GUSTA':'GUARDAR EN ME GUSTA',()=>window.TransmissionFavorites?.toggleTrack(track),!rt.account);
 if(rt.account&&saved===null)void window.TransmissionFavorites?.checkTracks([track]).then(()=>{if(active===track)favorite.textContent=window.TransmissionFavorites.isSaved(track)?'QUITAR DE ME GUSTA':'GUARDAR EN ME GUSTA'});
 if(track.album?.id)entry('VER ÁLBUM',()=>window.TransmissionCatalog?.openAlbum(track.album));
 if(track.artists?.[0]?.name)entry('VER ARTISTA',()=>window.TransmissionCatalog?.openArtist(track.artists[0]));
 entry('COPIAR ENLACE',()=>copy(track));
 const link=make('a','','ABRIR EN SPOTIFY ↗');link.href='https://open.spotify.com/track/'+track.id;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('role','menuitem');link.onclick=()=>close();menu.append(link);
 menu.hidden=false;position();menu.querySelector('button:not(:disabled)')?.focus();
}
function optionsButton(track,cls='tm-track-options'){
 const button=make('button',cls,'…');button.type='button';button.title='Opciones de '+track.name;button.setAttribute('aria-label',button.title);button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');button.onclick=()=>open(track,button);return button;
}
function row(track,options={}){
 const item=make('div','tm-song-row');item.dataset.trackId=track.id;
 const main=make('div','tm-song-play'),play=make('button','tm-song-name');play.type='button';play.setAttribute('aria-label','Reproducir '+track.name);
 const cover=make('button','tm-song-cover');cover.type='button';cover.tabIndex=-1;cover.setAttribute('aria-hidden','true');const image=art(track);if(image)cover.style.backgroundImage='url("'+image+'")';
 const symbol=make('span','tm-song-symbol','▶');cover.append(symbol);
 const copy=make('div','tm-song-copy'),subtitle=make('small','');play.append(make('strong','',track.name));
 if(options.subtitle)subtitle.textContent=options.subtitle;
 else if(options.albumSubtitle&&track.album?.id){const link=make('a','',track.album.name);link.href='#/album/'+track.album.id+'?'+new URLSearchParams({nombre:track.album.name});subtitle.append(link)}
 else for(const [index,artist] of (track.artists||[]).entries()){
   if(index)subtitle.append(document.createTextNode(', '));
   if(/^[A-Za-z0-9]{22}$/.test(artist.id||'')){const link=make('a','',artist.name);link.href='#/artista/'+artist.id+'?'+new URLSearchParams({nombre:artist.name});subtitle.append(link)}else subtitle.append(document.createTextNode(artist.name||''));
 }
 copy.append(play,subtitle);
 if(options.number!==undefined)main.append(make('span','tm-song-number',String(options.number).padStart(2,'0')));
 if(!options.noCover)main.append(cover);else item.classList.add('tm-song-without-cover');
 main.append(copy);play.onclick=()=>void run(play,()=>options.onPlay?options.onPlay():rt.playSequence(options.tracks||[track],options.index||0));cover.onclick=()=>play.click();
 const duration=make('span','tm-song-duration',track.duration_ms?format(track.duration_ms):'');
 const add=make('button','tm-song-add','+');add.type='button';add.title='Añadir a la cola: '+track.name;add.setAttribute('aria-label',add.title);add.disabled=track.is_playable===false;add.onclick=()=>void run(add,()=>rt.enqueueTracks([track]));
 const more=optionsButton(track);item.append(main,duration);if(!options.hideAdd)item.append(add);item.append(more);
 if(track.is_playable===false){play.disabled=true;cover.disabled=true;item.classList.add('is-unavailable');play.title='No disponible en tu cuenta'}
 item.classList.toggle('is-current',rt.state?.trackId===track.id);return item;
}
document.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!anchor?.contains(event.target))close()});
document.addEventListener('keydown',event=>{
 if(menu.hidden)return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);return}
 if(event.key==='Tab'){close();return}
 const buttons=Array.from(menu.querySelectorAll('button:not(:disabled),a[href]')),index=buttons.indexOf(document.activeElement);
 if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus()}
},true);
window.addEventListener('resize',()=>close());
document.addEventListener('scroll',event=>{if(!menu.hidden&&!menu.contains(event.target))close()},true);
window.addEventListener('tm:playback',event=>document.querySelectorAll('.tm-song-row[data-track-id]').forEach(item=>item.classList.toggle('is-current',item.dataset.trackId===event.detail?.trackId)));
window.TransmissionTrackActions={row,open,close,optionsButton,art,by,format,run,fail};
})();
