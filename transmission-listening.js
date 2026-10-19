/* Listening pages and a local sleep timer. Reuses the existing playback session. */
(function(){
'use strict';
const rt=window.TransmissionRuntime,ui=window.TransmissionTrackActions,sp=window.TransmissionSpotify;
if(!rt||!ui||!sp)return;
const $=id=>document.getElementById(id),shell=$('tm-listening-page'),content=$('tm-listening-content');
const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
let page=null,state=rt.state,seenAt=Date.now(),seeking=false,timer=null,firing=false,lastTrack=null,renderedTrack=null,sessionRecent=[],recentAccount=rt.account?.id;
function button(label,run,cls='tm-catalog-button'){const node=make('button',cls,label);node.type='button';node.onclick=run;return node}
function link(label,href,cls=''){const node=make('a',cls,label);node.href=href;return node}
function title(kicker,name,description){
 const head=make('header','tm-listening-heading');head.append(make('span','tm-page-kicker',kicker),make('h1','',name));
 if(description)head.append(make('p','',description));content.append(head);
}
function empty(text){
 const block=make('div','tm-page-empty');block.append(make('p','',text),rt.account?link('EXPLORAR MÚSICA ↗','#/explorar','tm-catalog-button'):button('CONECTAR SPOTIFY',()=>$('saved-trigger').click()));content.append(block);
}
function currentTrack(){const track=rt.currentTrack;return state?.trackId&&track?.id===state.trackId?track:null}
function renderTimer(){
 const panel=make('section','tm-sleep');panel.id='tm-sleep';
 panel.append(make('span','tm-page-kicker','AL FINAL DEL DÍA'),make('h2','','TEMPORIZADOR'));
 const status=make('p','tm-sleep-status');status.id='tm-sleep-status';panel.append(status);
 const choices=make('div','tm-sleep-choices');
 for(const minutes of [15,30,45,60])choices.append(button(minutes+' MIN',()=>arm(minutes),'tm-sleep-choice'));
 const cancel=button('CANCELAR',cancelTimer,'tm-text-action');cancel.id='tm-sleep-cancel';choices.append(cancel);panel.append(choices);
 panel.append(make('small','','Pausa la música con esta pestaña abierta. Puedes seguir navegando mientras tanto.'));
 return panel;
}
function renderNow(){
 const track=currentTrack();
 renderedTrack=track?.id||null;
 if(!track){title('TU SESIÓN','ESCUCHANDO AHORA','Todo lo que suena, en un solo lugar.');empty(rt.account?'Elige una canción para abrir su ficha y preparar lo que sigue.':'Conecta tu cuenta para ver lo que suena.');content.append(renderTimer());tick();return}
 const grid=make('div','tm-listening-layout'),main=make('article','tm-listening-record'),cover=make('div','tm-listening-cover');
 const art=ui.art(track);if(art)cover.style.backgroundImage='url("'+art+'")';else cover.append(make('span','','T/M'));
 cover.setAttribute('role','img');cover.setAttribute('aria-label','Carátula de '+(track.album?.name||track.name));main.append(cover);
 const copy=make('div','tm-listening-copy'),status=make('span','tm-page-kicker');status.id='tm-listening-state';copy.append(status,make('h1','',track.name));
 const artists=make('div','tm-listening-artists');for(const artist of track.artists||[])artists.append(button(artist.name+' ↗',()=>window.TransmissionCatalog.openArtist(artist),'tm-text-action'));copy.append(artists);
 if(track.album?.name){const album=button(track.album.name+' ↗',()=>track.album.id?window.TransmissionCatalog.openAlbum(track.album):window.TransmissionCatalog.search('album:"'+track.album.name.replace(/"/g,'')+'"','album'),'tm-listening-album');copy.append(album)}
 const progress=make('div','tm-listening-progress'),elapsed=make('span','','0:00'),range=make('input',''),duration=make('span','','0:00');
 elapsed.id='tm-listening-elapsed';duration.id='tm-listening-duration';range.id='tm-listening-seek';range.type='range';range.min='0';range.max='1000';range.value='0';range.setAttribute('aria-label','Posición de la canción');
 range.oninput=()=>{seeking=true;elapsed.textContent=ui.format(Number(range.value)/1000*(state?.duration||0))};
 range.onchange=()=>{const original=$('tm-seek');original.value=range.value;original.dispatchEvent(new Event('change',{bubbles:true}));state={...state,position:Number(range.value)/1000*(state?.duration||0)};seenAt=Date.now();seeking=false};
 range.onblur=()=>{seeking=false};progress.append(elapsed,range,duration);copy.append(progress);
 const transport=make('div','tm-listening-transport');
 transport.append(button('←',()=>$('tm-prev').click(),'tm-listening-previous'),button('▶ ESCUCHAR',()=>$('tm-play').click(),'tm-listening-play'),button('→',()=>$('tm-next').click(),'tm-listening-next'));
 transport.firstChild.setAttribute('aria-label','Canción anterior');transport.lastChild.setAttribute('aria-label','Canción siguiente');transport.children[1].id='tm-listening-play';copy.append(transport);
 const actions=make('div','tm-listening-actions'),favorite=button('♡ GUARDAR',event=>void ui.run(event.currentTarget,()=>window.TransmissionFavorites.toggleTrack(track)),'tm-text-action');
 favorite.id='tm-listening-save';actions.append(favorite,button('+ A LA COLA',event=>void ui.run(event.currentTarget,()=>rt.enqueueTracks([track])),'tm-text-action'),button('COMPARTIR ↗',()=>$('tm-mini-share').click(),'tm-text-action'),ui.optionsButton(track));copy.append(actions);
 main.append(copy);grid.append(main);
 const aside=make('aside','tm-listening-aside');aside.append(renderTimer());const next=make('section','tm-listening-next-section');next.id='tm-listening-next-section';aside.append(next);grid.append(aside);content.append(grid);
 renderUpcoming();updateFavorite();tick();
}
function renderUpcoming(){
 const section=$('tm-listening-next-section');if(!section||page!=='escuchando')return;
 section.replaceChildren();const head=make('div','tm-catalog-section-head');head.append(make('h2','','DESPUÉS'),button('VER COLA ↗',()=>window.TransmissionQueue.open(),'tm-text-action'));section.append(head);
 if(!rt.managedQueue){section.append(make('p','tm-listening-note','Consulta y prepara las siguientes canciones en la cola.'));return}
 const selection=rt.queue||[],tracks=rt.queueHasCurrent?selection.slice(1):selection,duration=tracks.reduce((sum,track)=>sum+(Number(track.duration_ms)||0),0);
 const meta=make('p','tm-listening-note',tracks.length+' '+(tracks.length===1?'CANCIÓN':'CANCIONES')+(duration&&tracks.every(track=>Number(track.duration_ms)>0)?' · '+ui.format(duration):''));section.append(meta);
 tracks.slice(0,4).forEach((track,index)=>section.append(ui.row(track,{tracks,index,number:index+1})));
 if(!tracks.length)section.append(link('BUSCAR MÚSICA +','#/explorar','tm-catalog-button'));
}
function renderCollection(){
 if(rt.account?.id!==recentAccount){recentAccount=rt.account?.id;sessionRecent=[]}
 const rotation=page==='rotacion',source=rotation?rt.accountTracks:[...sessionRecent,...(rt.recent||[])].filter((track,index,all)=>all.findIndex(item=>item.id===track.id)===index).slice(0,50);
 title('ARCHIVO PERSONAL',rotation?'EN ROTACIÓN':'ÚLTIMAS ESCUCHAS',rotation?'Tu selección habitual. Elige por dónde seguir.':'Vuelve a una canción que acabas de escuchar.');
 const tracks=source||[];
 if(!tracks.length){empty(rt.account?'Todavía no hay canciones disponibles en esta selección.':'Conecta Spotify para abrir tu archivo personal.');return}
 const head=make('div','tm-catalog-section-head');head.append(make('span','tm-listening-note',tracks.length+' CANCIONES'),button('▶ ESCUCHAR SELECCIÓN',event=>void ui.run(event.currentTarget,()=>rt.playSequence(tracks))));content.append(head);
 const list=make('div','tm-listening-tracklist');tracks.forEach((track,index)=>list.append(ui.row(track,{tracks,index,number:index+1})));content.append(list);
}
function renderGuide(){
 title('A MANO','GUÍA Y ATAJOS','Todo a un gesto de distancia.');
 const cards=make('div','tm-guide-grid');
 for(const [name,copy,href] of [
   ['EXPLORAR','Busca canciones, abre un artista o recorre sus álbumes sin perder lo que suena.','#/explorar'],
   ['PREPARAR LA COLA','Añade con +. Abre … para colocar una canción después de la actual. La cola permite editar las selecciones de TRANSMISSION.','#/escuchando'],
   ['VOLVER A ESCUCHAR','Tus favoritas, playlists e historial tienen su propia página. Usa las flechas del navegador para volver.','#/historial'],
   ['BAJAR EL RITMO','El temporizador pausa la música en 15, 30, 45 o 60 minutos mientras la pestaña sigue abierta.','#/escuchando']
 ]){const card=make('article','tm-guide-card');card.append(make('h2','',name),make('p','',copy),link('ABRIR ↗',href,'tm-text-action'));cards.append(card)}content.append(cards);
 const table=make('table','tm-shortcut-table'),body=make('tbody','');
 for(const [key,action] of [['/','Buscar música'],['ESPACIO','Reproducir / pausar'],['← / →','Retroceder / avanzar 5 segundos'],['MAYÚS + ← / →','Canción anterior / siguiente'],['Q','Abrir la cola'],['N','Ver lo que suena'],['?','Abrir esta guía'],['ESC','Cerrar menús y cola']]){
   const row=make('tr',''),keyCell=make('th','');keyCell.scope='row';keyCell.append(make('kbd','',key));row.append(keyCell,make('td','',action));body.append(row);
 }table.append(make('caption','','ATAJOS DE TECLADO'),body);content.append(table,make('p','tm-listening-note','Los atajos se usan fuera de los campos de texto y los controles.'));
}
function render(){
 content.replaceChildren();seeking=false;
 if(page==='escuchando')renderNow();
 else if(['rotacion','historial'].includes(page))renderCollection();
 else if(page==='atajos')renderGuide();
 else{title('TRANSMISSION','NO ENCONTRAMOS ESTA PÁGINA');empty('Vuelve al archivo para seguir explorando.')}
}
function show(kind){page=kind;shell.hidden=false;if(rt.state!==state){state=rt.state;seenAt=Date.now()}lastTrack=state?.trackId;render()}
function close(){page=null;shell.hidden=true}
function updateFavorite(){const node=$('tm-listening-save'),track=currentTrack();if(!node||!track)return;const saved=window.TransmissionFavorites?.isSaved(track);node.textContent=saved?'♥ GUARDADA':'♡ GUARDAR';node.setAttribute('aria-pressed',String(!!saved))}
function arm(minutes){
 if(!rt.account){rt.notify('Conecta Spotify para usar el temporizador.');return}
 timer={end:Date.now()+minutes*60000,account:rt.account.id};tick();rt.notify('La música se pausará en '+minutes+' minutos.');
}
function cancelTimer(){timer=null;tick()}
async function finishTimer(){
 if(firing||!timer)return;const active=timer;timer=null;firing=true;tick();
 try{
   if(rt.account?.id!==active.account)return;
   if(rt.state?.playing){
     const target=rt.state.deviceId||rt.device;
     const result=await rt.action(()=>rt.player&&target===rt.device?rt.player.pause():sp.api('/me/player/pause'+(target?'?device_id='+encodeURIComponent(target):''),{method:'PUT'}));
     if(result===false){rt.notify('No se pudo pausar la música. Revisa el dispositivo activo.');return}
   }
   rt.notify('Temporizador terminado. La música está en pausa.');
 }catch(error){ui.fail(error)}finally{firing=false;tick()}
}
function tick(){
 if(timer&&rt.account?.id!==timer.account)timer=null;
 if(timer&&Date.now()>=timer.end){void finishTimer();return}
 const remaining=timer?Math.max(0,timer.end-Date.now()):0,badge=$('tm-timer-status');badge.hidden=!timer;badge.textContent=timer?'PAUSA EN '+ui.format(remaining):'';
 $('tm-timer-indicator').hidden=!timer||page==='escuchando';$('tm-timer-remaining').textContent=ui.format(remaining);
 const timerStatus=$('tm-sleep-status');if(timerStatus){timerStatus.textContent=firing?'PAUSANDO…':timer?'LA MÚSICA SE PAUSA EN '+ui.format(remaining):'ELIGE CUÁNDO PAUSAR';$('tm-sleep-cancel').hidden=!timer;document.querySelectorAll('.tm-sleep-choice').forEach(node=>node.disabled=!rt.account||firing)}
 if(page!=='escuchando')return;
 const play=$('tm-listening-play');if(!play)return;
 const playing=String(!!state?.playing);
 if(play.dataset.playing!==playing){play.dataset.playing=playing;const icon=$('tm-play').querySelector('svg')?.cloneNode(true);play.replaceChildren(...(icon?[icon]:[]),document.createTextNode(state?.playing?'PAUSAR':'ESCUCHAR'))}
 $('tm-listening-state').textContent=state?.playing?'ESCUCHANDO AHORA':'EN PAUSA';
 const duration=state?.duration||0,pos=Math.max(0,Math.min(duration,(state?.position||0)+(state?.playing?Date.now()-seenAt:0))),range=$('tm-listening-seek');
 range.disabled=!duration;if(!seeking){range.value=duration?String(Math.round(pos/duration*1000)):'0';$('tm-listening-elapsed').textContent=ui.format(pos)}
 $('tm-listening-duration').textContent=ui.format(duration);
}
window.addEventListener('tm:playback',event=>{
 state=event.detail;seenAt=Date.now();
 if(page==='escuchando'&&lastTrack!==state?.trackId){lastTrack=state?.trackId;render()}else tick();
});
window.addEventListener('tm:queue',renderUpcoming);window.addEventListener('tm:favorites',updateFavorite);
window.addEventListener('tm:account-track',event=>{
 if(rt.account?.id!==recentAccount){recentAccount=rt.account?.id;sessionRecent=[]}
 const track=event.detail?.track;if(track?.id&&rt.account)sessionRecent=[track,...sessionRecent.filter(item=>item.id!==track.id)].slice(0,50);
 if(page==='historial')render();
 if(page==='escuchando'&&currentTrack()?.id!==renderedTrack)render();
});
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||event.target.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="menu"]'))return;
 if([...document.querySelectorAll('[aria-modal="true"]')].some(node=>node.getClientRects().length))return;
 if(event.key.toLocaleLowerCase()==='q'){event.preventDefault();window.TransmissionQueue.open()}
 if(event.key.toLocaleLowerCase()==='n'){event.preventDefault();window.TransmissionPages.navigate('#/escuchando')}
 if(event.key==='?'){event.preventDefault();window.TransmissionPages.navigate('#/atajos')}
});
window.TransmissionListening={show,close};
$('player-art').onclick=()=>window.TransmissionPages.navigate('#/escuchando');
$('tm-timer-cancel').onclick=cancelTimer;
setInterval(tick,1000);
})();
