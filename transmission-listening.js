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
 const head=make('header','tm-listening-heading');if(kicker)head.append(make('span','tm-page-kicker',kicker));head.append(make('h1','',name));
 if(description)head.append(make('p','',description));content.append(head);
}
function empty(text){
 const block=make('div','tm-page-empty');if(rt.account)block.append(make('p','',text));else block.append(button('CONECTAR SPOTIFY',()=>$('saved-trigger').click()));content.append(block);
}
function currentTrack(){const track=rt.currentTrack;return state?.trackId&&track?.id===state.trackId?track:null}
function renderNow(){
 const track=currentTrack();
 renderedTrack=track?.id||null;
 if(!track){title('','ESCUCHAR');const tracks=(rt.recent?.length?rt.recent:rt.accountTracks||[]).slice(0,30);for(const [index,item] of tracks.entries())content.append(ui.row(item,{tracks,index,number:index+1}));tick();return}
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
 const actions=make('div','tm-listening-actions'),favorite=button('♡',event=>void ui.run(event.currentTarget,()=>window.TransmissionFavorites.toggleTrack(track)),'tm-text-action');
 favorite.id='tm-listening-save';actions.append(favorite);
 for(const [id,label,run] of [['tm-mini-queue','Ver cola',()=>window.TransmissionQueue.open()],['tm-mini-share','Compartir canción',()=>$('tm-mini-share').click()]]){
   const action=button('',run,'tm-text-action');action.setAttribute('aria-label',label);action.title=label;const icon=$(id).querySelector('svg')?.cloneNode(true);if(icon)action.append(icon);actions.append(action);
 }
 actions.append(ui.optionsButton(track));copy.append(actions);
 main.append(copy);grid.append(main);
 const aside=make('aside','tm-listening-aside');const next=make('section','tm-listening-next-section');next.id='tm-listening-next-section';aside.append(next);grid.append(aside);content.append(grid);
 renderUpcoming();updateFavorite();tick();
}
function renderUpcoming(){
 const section=$('tm-listening-next-section');if(!section||page!=='escuchando')return;
 section.replaceChildren();const selection=rt.managedQueue?rt.queue||[]:[],tracks=rt.queueHasCurrent?selection.slice(1):selection,duration=tracks.reduce((sum,track)=>sum+(Number(track.duration_ms)||0),0);
 section.parentElement.hidden=!tracks.length;section.closest('.tm-listening-layout').classList.toggle('tm-without-queue',!tracks.length);if(!tracks.length)return;
 const head=make('div','tm-catalog-section-head');head.append(make('h2','','DESPUÉS'),button('VER COLA ↗',()=>window.TransmissionQueue.open(),'tm-text-action'));section.append(head);
 const meta=make('p','tm-listening-note',tracks.length+' '+(tracks.length===1?'CANCIÓN':'CANCIONES')+(duration&&tracks.every(track=>Number(track.duration_ms)>0)?' · '+ui.format(duration):''));section.append(meta);
 tracks.slice(0,4).forEach((track,index)=>section.append(ui.row(track,{tracks,index,number:index+1,hideAdd:true})));
}
function renderHistory(){
 if(rt.account?.id!==recentAccount){recentAccount=rt.account?.id;sessionRecent=[]}
 title('','HISTORIAL');
 const official=(rt.recentEvents||[]).filter(entry=>entry.track?.id),records=official.length?official:(rt.recent||[]).map(track=>({track}));
 if(!records.length&&!sessionRecent.length){empty('Sin escuchas recientes.');return}
 const groups=new Map(),today=new Date().toDateString(),dateFormat=new Intl.DateTimeFormat('es',{weekday:'long',day:'numeric',month:'long'}),timeFormat=new Intl.DateTimeFormat('es',{hour:'2-digit',minute:'2-digit',hour12:false});
 if(sessionRecent.length)groups.set('EN ESTA SESIÓN',sessionRecent.map(track=>({track})));
 for(const entry of records){
   const date=Date.parse(entry.played_at),key=Number.isNaN(date)?'RECIENTES':new Date(date).toDateString()===today?'HOY':dateFormat.format(new Date(date)).toUpperCase();
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);
 }
 for(const [label,entries] of groups){
   const head=make('div','tm-history-heading');head.append(make('h2','',label));content.append(head);
   const list=make('div','tm-listening-tracklist');
   for(const entry of entries){
     const row=ui.row(entry.track,{tracks:[entry.track]});row.classList.add('tm-history-row');
     if(!Number.isNaN(Date.parse(entry.played_at))){const time=make('time','tm-history-time',timeFormat.format(new Date(entry.played_at)));time.dateTime=entry.played_at;row.insertBefore(time,row.children[1])}
     list.append(row);
   }content.append(list);
 }
}
function renderGuide(){
 title('','ATAJOS');
 const table=make('table','tm-shortcut-table'),body=make('tbody','');
 for(const [key,action] of [['/','Buscar música'],['ESPACIO','Reproducir / pausar'],['← / →','Retroceder / avanzar 5 segundos'],['MAYÚS + ← / →','Canción anterior / siguiente'],['Q','Abrir la cola'],['N','Ver lo que suena'],['?','Abrir esta guía'],['ESC','Cerrar menús y cola']]){
   const row=make('tr',''),keyCell=make('th','');keyCell.scope='row';keyCell.append(make('kbd','',key));row.append(keyCell,make('td','',action));body.append(row);
 }table.append(body);content.append(table);
}
function render(){
 content.replaceChildren();seeking=false;
 if(page==='escuchando')renderNow();
 else if(page==='historial')renderHistory();
 else if(page==='atajos')renderGuide();
 else{title('','PÁGINA NO ENCONTRADA');content.append(link('← INICIO','#top','tm-text-action'))}
}
function show(kind){page=kind;shell.hidden=false;if(rt.state!==state){state=rt.state;seenAt=Date.now()}lastTrack=state?.trackId;render()}
function close(){page=null;shell.hidden=true}
function updateFavorite(){const node=$('tm-listening-save'),track=currentTrack();if(!node||!track)return;const saved=window.TransmissionFavorites?.isSaved(track);node.textContent=saved?'♥':'♡';node.title=saved?'Quitar de Me gusta':'Guardar en Me gusta';node.setAttribute('aria-label',node.title);node.setAttribute('aria-pressed',String(!!saved))}
function arm(minutes){
 if(!rt.account){rt.notify('Conecta Spotify para usar el temporizador.');return}
 timer={end:Date.now()+minutes*60000,account:rt.account.id,minutes};tick();rt.notify('Temporizador: '+minutes+' min.');
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
 const remaining=timer?Math.max(0,timer.end-Date.now()):0;
 const timerStatus=$('tm-sleep-status');timerStatus.hidden=!timer&&!firing;timerStatus.textContent=firing?'…':ui.format(remaining);
 $('tm-sleep-select').disabled=!rt.account||firing;$('tm-sleep-select').value=timer?String(timer.minutes):'0';
 const more=$('tm-more');more.classList.toggle('tm-timer-active',!!timer);more.title=timer?'Temporizador: '+ui.format(remaining):'Más opciones';
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
$('tm-sleep-select').onchange=event=>{const minutes=Number(event.target.value);if(minutes)arm(minutes);else cancelTimer();$('tm-options').hidden=true;$('tm-more').setAttribute('aria-expanded','false')};
tick();
setInterval(tick,1000);
})();
