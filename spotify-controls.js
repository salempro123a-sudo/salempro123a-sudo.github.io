/* TRANSMISSION / Audio controls. Uses live state and documented Web API & Playback SDK. */
(function(){
'use strict';
const rt=window.TransmissionRuntime,sp=window.TransmissionSpotify;
if(!rt||!sp)return;
const $=id=>document.getElementById(id);
const ns='http://www.w3.org/2000/svg';
const shapes={
  play:'<path d="m9 5 12 7-12 7V5Z" fill="currentColor" stroke="none"/>',
  pause:'<rect x="7" y="5" width="3.5" height="14" rx=".6" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3.5" height="14" rx=".6" fill="currentColor" stroke="none"/>'
};
let playback=null,seenAt=0,userSeeking=false,volumeTimer=null,loading=false;
function glyph(name){const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','21');svg.setAttribute('height','21');svg.setAttribute('aria-hidden','true');svg.innerHTML=shapes[name];return svg}
function toggleGlyph(playing){
 const p=$('tm-play');p.replaceChildren(glyph(playing?'pause':'play'));p.setAttribute('aria-label',playing?'Pausar':'Reproducir');p.title=playing?'Pausar':'Reproducir';
 // Original radio strip and carousel controls have true iconography, not roman numerals.
 const strip=$('audio-toggle');strip.replaceChildren(glyph(playing?'pause':'play'));strip.title=playing?'Pausar':'Reproducir';
}
function fmt(n){const s=Math.floor(Math.max(0,n)/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function updateUi(state){
 if(!state)return;
 const oldId=playback?.trackId;playback={...state};seenAt=Date.now();
 toggleGlyph(!!state.playing);
 if(Number.isFinite(state.volume) && !loading) $('tm-volume').value=Math.max(0,Math.min(100,state.volume));
 if(!userSeeking)positionUi();
 for(const buttonId of ['tm-seek','tm-volume'])$(buttonId).disabled=false;
 const repeat=$('tm-repeat'),shuffle=$('tm-shuffle');
  const pending=!!rt.sequencePending;
  shuffle.disabled=pending;repeat.disabled=pending;
  shuffle.title=repeat.title=pending?'La selección mantiene su orden mientras se completa la cola.':'Cambiar modo de reproducción';
 const repeatState=typeof state.repeat==='number'?['off','context','track'][state.repeat]||'off':state.repeat||'off';
 const repeatOn=repeatState!=='off',shuffleOn=!!state.shuffle;
 repeat.setAttribute('aria-pressed',String(repeatOn));
 shuffle.setAttribute('aria-pressed',String(shuffleOn));
 repeat.dataset.state=repeatState;
 repeat.lastChild&&null;
 if(oldId!==state.trackId)updateLyricsLink();
}
function positionUi(){
 if(!playback)return;
 const max=playback.duration||0;
 const elapsed=playback.playing?Date.now()-seenAt:0;
 const pos=Math.max(0,Math.min(max,(playback.position||0)+elapsed));
 $('tm-elapsed').textContent=fmt(pos);
 $('tm-duration').textContent=fmt(max);
 if(!userSeeking&&max>0)$('tm-seek').value=String(Math.round(pos/max*1000));
}
function warn(error){rt.status(error?.message||String(error),true)}
async function cmd(fn){try{return await fn()}catch(err){warn(err);throw err}}
function busy(button,fn){
 if(loading)return;
 loading=true;const old=button.disabled;button.disabled=true;
 Promise.resolve().then(fn).catch(warn).finally(()=>{loading=false;button.disabled=old});
}
$('tm-play').addEventListener('click',e=>{
 rt.primePlayback?.();
 busy(e.currentTarget,async()=>rt.toggle());
});
$('tm-prev').addEventListener('click',e=>busy(e.currentTarget,()=>rt.action(()=>sp.api('/me/player/previous',{method:'POST'}))));
$('tm-next').addEventListener('click',e=>busy(e.currentTarget,()=>rt.action(()=>sp.api('/me/player/next',{method:'POST'}))));
$('tm-seek').addEventListener('pointerdown',()=>{userSeeking=true});
$('tm-seek').addEventListener('input',e=>{
 const d=playback?.duration||0;
 $('tm-elapsed').textContent=fmt(Number(e.target.value)/1000*d);
});
$('tm-seek').addEventListener('change',e=>{
 userSeeking=false;
 const duration=playback?.duration||0;
 if(!duration||!rt.account)return;
 const ms=Math.round(Number(e.target.value)/1000*duration);
 busy(e.currentTarget,async()=>{
   await rt.action(()=>sp.api('/me/player/seek?position_ms='+ms,{method:'PUT'}));
   if(playback){playback.position=ms;seenAt=Date.now();positionUi()}
 });
});
$('tm-volume').addEventListener('input',e=>{
 const value=Number(e.target.value);
 clearTimeout(volumeTimer);
 volumeTimer=setTimeout(async()=>{
   if(!rt.account)return;
   try{
     const local=rt.player && (rt.state?.deviceId===rt.device||!rt.state?.deviceId);
     if(local&&rt.player?.setVolume){
       await rt.player.setVolume(value/100);
     }else{
       await sp.api('/me/player/volume?volume_percent='+value,{method:'PUT'});
     }
   }catch(err){warn(err)}
 },130);
});
function openPopup(open){
 $('tm-options').hidden=!open;$('tm-more').setAttribute('aria-expanded',String(open));
}
$('tm-more').onclick=()=>openPopup($('tm-options').hidden);
document.addEventListener('pointerdown',e=>{
 if(!$('tm-options').hidden&&!$('tm-options').contains(e.target)&&e.target!==$('tm-more')&&!$('tm-more').contains(e.target))openPopup(false);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')openPopup(false)});
const c=$('tm-popover-content');
function showText(message){c.dataset.mode='message';c.replaceChildren(document.createTextNode(message))}
$('tm-shuffle').onclick=e=>busy(e.currentTarget,async()=>{
 if(!rt.account)throw Error('Conecta Spotify para usar aleatorio.');
  if(rt.sequencePending){showText('Esta selección mantiene el orden elegido mientras se completa la cola.');return}
 const state=$('tm-shuffle').getAttribute('aria-pressed')!=='true';
 await sp.api('/me/player/shuffle?state='+state,{method:'PUT'});
 if(state)rt.releaseQueue?.();
 $('tm-shuffle').setAttribute('aria-pressed',String(state));
 showText(state?'Aleatorio activado en tu dispositivo.':'Aleatorio desactivado.');
});
$('tm-repeat').onclick=e=>busy(e.currentTarget,async()=>{
 if(!rt.account)throw Error('Conecta Spotify para usar repetición.');
  if(rt.sequencePending){showText('Esta selección mantiene el orden elegido mientras se completa la cola.');return}
 const before=$('tm-repeat').dataset.state||'off';
 const next=before==='off'?'context':before==='context'?'track':'off';
 await sp.api('/me/player/repeat?state='+next,{method:'PUT'});
 $('tm-repeat').dataset.state=next;
 $('tm-repeat').setAttribute('aria-pressed',String(next!=='off'));
 showText(next==='off'?'Repetición desactivada.':next==='context'?'Se repite la lista o el álbum.':'Se repite esta canción.');
});
$('tm-queue-button').onclick=()=>{openPopup(false);window.TransmissionQueue?.open()};$('tm-devices-button').onclick=async()=>{
 c.dataset.mode='devices';c.replaceChildren(document.createTextNode('Buscando dispositivos…'));
 if(!rt.account){showText('Conecta Spotify para elegir un dispositivo.');return}
 try{
   const data=await sp.api('/me/player/devices');
   if(c.dataset.mode!=='devices')return;
   c.replaceChildren();
   for(const device of data.devices||[]){
     const btn=document.createElement('button');btn.className='tm-device-option';btn.type='button';
     btn.textContent=device.name+' · '+device.type;btn.setAttribute('aria-current',String(!!device.is_active));
     btn.onclick=async()=>{
       try{
         await rt.transferPlayback(device.id);
         showText('Dispositivo seleccionado: '+device.name);
         rt.status('Reproducción transferida a '+device.name+'.');
       }catch(e){showText(e.message)}
     };c.append(btn);
   }
   if(!c.childElementCount)showText('No hay dispositivos disponibles. Abre Spotify en un dispositivo e inténtalo nuevamente.');
 }catch(err){showText(err.message)}
};
function updateLyricsLink(){
 const track=rt.currentTrack;
 const id=track?.id&&/^[a-zA-Z0-9]{22}$/.test(track.id)?track.id:null;
 const link=$('tm-lyrics-button');
 link.href=id?'https://open.spotify.com/track/'+id:'https://open.spotify.com/';
 link.title=id?'Abre la canción en Spotify y consulta sus letras oficiales':'Spotify muestra letras desde su propia aplicación';
}
updateLyricsLink();
$('tm-diagnostics').onclick=async()=>{
 c.dataset.mode='diagnostics';c.replaceChildren(document.createTextNode('Comprobando Spotify…'));
 const checks=[];
 checks.push('Cuenta: '+(rt.account?'AUTORIZADA':'SIN INICIAR SESIÓN'));
 checks.push('Web Playback SDK: '+(rt.player?'CONECTADO':'NO INICIADO'));
 checks.push('Dispositivo navegador: '+(rt.device?'REGISTRADO':'NO DISPONIBLE'));
 if(rt.account){
   try{
     const s=await sp.api('/me/player');
     checks.push('Sesión de audio: '+(s?.device?.name||'SIN DISPOSITIVO ACTIVO'));
     checks.push('Reproducción: '+(s?.is_playing?'SONANDO':s?'PAUSADA':'SIN AUDIO'));
   }catch(e){checks.push('Spotify API: '+(e.status||'ERROR')+' / '+e.message)}
   try{
     const devices=await sp.api('/me/player/devices');
     checks.push('Dispositivos disponibles: '+(devices?.devices?.length??'—'));
   }catch(e){checks.push('Lista de dispositivos: '+e.message)}
 }
 const logged=rt.diagnostics||[];
 if(logged.length){
   checks.push('ERRORES RECIENTES');
   logged.slice(0,6).forEach(entry=>checks.push(entry.at+' · '+entry.message));
 }
 checks.push('Spotify Premium y un gesto de usuario son necesarios para iniciar la reproducción web.');
 if(c.dataset.mode==='diagnostics')c.replaceChildren(...checks.map(line=>{
   const p=document.createElement('div');p.textContent=line;p.style.margin='0 0 8px';return p
 }));
};
window.addEventListener('tm:playback',e=>updateUi(e.detail));
window.addEventListener('tm:track',e=>{
 const track=e.detail?.track;
 updateLyricsLink();
 if(track?.duration_ms&&playback&&playback.trackId!==track.id){
   updateUi({...playback,trackId:track.id,duration:track.duration_ms,position:0});
 }
});
toggleGlyph(false);
setInterval(()=>{positionUi();if(rt.account&&rt.player)$('tm-volume').disabled=false},1000);
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||event.target?.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="menu"]'))return;
 if(document.querySelector('[aria-modal="true"]:not([hidden])')?.getClientRects().length)return;
 if(event.code==='Space'){event.preventDefault();$('tm-play').click()}
 if(event.shiftKey&&event.key==='ArrowRight'){event.preventDefault();$('tm-next').click()}
 if(event.shiftKey&&event.key==='ArrowLeft'){event.preventDefault();$('tm-prev').click()}
 if(!event.shiftKey&&['ArrowLeft','ArrowRight'].includes(event.key)&&playback?.duration){
   event.preventDefault();const elapsed=playback.playing?Date.now()-seenAt:0;
   const ms=Math.max(0,Math.min(playback.duration,(playback.position||0)+elapsed+(event.key==='ArrowRight'?5000:-5000)));
   void rt.action(()=>sp.api('/me/player/seek?position_ms='+Math.round(ms),{method:'PUT'}));
 }
});
})();
