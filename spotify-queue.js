/* One queue panel shared by all player controls. */
(function(){
'use strict';
const rt=window.TransmissionRuntime,sp=window.TransmissionSpotify;
if(!rt||!sp)return;
const $=id=>document.getElementById(id),panel=$('tm-mini-queue-panel'),container=$('tm-mini-queue-tracks'),trigger=$('tm-mini-queue');
const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
let serial=0,cached=null,pending=null,editing=false;
function close(restore=false){++serial;panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(restore)trigger.focus()}
function label(text){container.append(make('div','tm-queue-label',text))}
async function edit(button,operation){
 if(editing)return;editing=true;button.disabled=true;panel.setAttribute('aria-busy','true');
 try{await operation()}catch(error){rt.status('Cola: '+error.message,true);rt.notify(error.message)}
 finally{editing=false;panel.setAttribute('aria-busy','false');void updateQueue()}
}
function queueRow(track,index,tracks,editable){
 const row=make('div','tm-mini-queue-item'),play=make('button','tm-queue-play');play.type='button';
 const number=make('span','tm-mini-queue-index',String(index+1).padStart(2,'0'));
 const name=make('span','tm-mini-queue-name');name.append(make('strong','',track.name),make('small','',(track.artists||[]).map(artist=>artist.name).join(', ')));
 play.append(number,name);play.setAttribute('aria-label','Reproducir desde '+track.name);
 play.onclick=()=>void edit(play,()=>rt.playSequence(tracks,index));row.append(play);
 if(editable){
   const revision=rt.queueRevision;
   for(const [symbol,description,step,disabled] of [['↑','Subir',-1,index===0],['↓','Bajar',1,index===tracks.length-1],['×','Quitar',null,false]]){
     const button=make('button','tm-queue-edit',symbol);button.type='button';button.title=description+' '+track.name;button.setAttribute('aria-label',button.title);button.disabled=disabled||editing;
     button.onclick=()=>void edit(button,()=>rt.changeQueue(index,step,revision));row.append(button);
   }
 }
 container.append(row);
}
async function updateQueue(force=false){
 if(panel.hidden)return;const seq=++serial,managed=rt.managedQueue;let current=null,tracks=[];
 if(managed){const selection=rt.queue||[];current=rt.queueHasCurrent?selection[0]:null;tracks=rt.queueHasCurrent?selection.slice(1):selection}
 else if(rt.account){
   const account=rt.account.id;
   if(!cached)container.replaceChildren(make('p','tm-empty','Consultando cola…'));
   try{
     if(!force&&cached?.account===account&&Date.now()-cached.at<15000){current=cached.current;tracks=cached.tracks}
     else{
       if(!pending||pending.account!==account){
         const reading={account,promise:sp.api('/me/player/queue')};pending=reading;reading.promise.finally(()=>{if(pending===reading)pending=null}).catch(()=>{});
       }
       const response=await pending.promise;if(rt.account?.id!==account)return;
       current=response?.currently_playing?.type==='track'?response.currently_playing:null;tracks=(response?.queue||[]).filter(track=>track?.type==='track'&&track.uri);
       cached={account,at:Date.now(),current,tracks};
     }
   }catch(error){if(seq!==serial||panel.hidden)return;container.replaceChildren(make('p','tm-empty','No se pudo consultar la cola. Pulsa actualizar para reintentar.'));rt.status('Cola: '+error.message,true);return}
 }
 if(seq!==serial||panel.hidden)return;
 container.replaceChildren();$('tm-queue-clear').hidden=!managed||!tracks.length;$('tm-queue-clear').disabled=editing;
 $('tm-queue-count').textContent=tracks.length+' '+(tracks.length===1?'CANCIÓN':'CANCIONES');
 if(current){label('AHORA');const row=make('div','tm-mini-queue-item is-current'),name=make('span','tm-mini-queue-name');name.append(make('strong','',current.name),make('small','',(current.artists||[]).map(artist=>artist.name).join(', ')));row.append(make('span','tm-mini-queue-index','▶'),name);container.append(row)}
 label(managed?(current?'SIGUIENTES':'LISTA PARA REPRODUCIR'):'A CONTINUACIÓN EN SPOTIFY');
 tracks.forEach((track,index)=>queueRow(track,index,tracks,managed));
 if(!tracks.length)container.append(make('p','tm-empty',rt.account?'Añade canciones con + mientras exploras.':'Conecta Spotify para preparar tu cola.'));
 if(tracks.length&&!current&&managed){const start=make('button','tm-catalog-button tm-queue-start','▶ ESCUCHAR COLA');start.type='button';start.onclick=()=>void edit(start,()=>rt.playSequence(tracks));container.prepend(start)}
}
function open(){panel.hidden=false;trigger.setAttribute('aria-expanded','true');void updateQueue();$('tm-mini-queue-close').focus()}
trigger.onclick=()=>panel.hidden?open():close();$('tm-mini-queue-close').onclick=()=>close(true);
$('tm-queue-refresh').onclick=()=>{cached=null;void updateQueue(true)};
$('tm-queue-clear').onclick=event=>void edit(event.currentTarget,()=>rt.clearQueue());
window.addEventListener('tm:queue',()=>{cached=null;if(!panel.hidden&&!editing)void updateQueue()});
let lastTrack=rt.state?.trackId;
window.addEventListener('tm:playback',event=>{if(lastTrack!==event.detail?.trackId){lastTrack=event.detail?.trackId;cached=null;if(!panel.hidden&&!editing)void updateQueue()}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden&&!document.querySelector('.tm-track-menu:not([hidden])')){event.stopImmediatePropagation();close(true)}},true);
document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!trigger.contains(event.target)&&!event.target.closest('.tm-song-add,.tm-track-menu,.tm-queue-trigger'))close()});
$('tm-mini-share').onclick=async()=>{
 const track=rt.currentTrack;if(!/^[A-Za-z0-9]{22}$/.test(track?.id||''))return;
 const url='https://open.spotify.com/track/'+track.id;
 try{if(navigator.share)await navigator.share({title:track.name,url});else{await navigator.clipboard.writeText(url);rt.notify('Enlace copiado.')}}
 catch(error){if(error.name!=='AbortError'){rt.status('Compartir: '+error.message,true);rt.notify('No se pudo compartir el enlace.')}}
};
window.TransmissionQueue={open,close,refresh:()=>updateQueue(true)};
})();
