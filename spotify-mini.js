/* TRANSMISSION — compact player lower left, tied to the real Spotify SDK state. */
(function(){
'use strict';
const rt=window.TransmissionRuntime;
const sp=window.TransmissionSpotify;
if(!rt)return;
const $=id=>document.getElementById(id);
const mini=$('tm-mini-player'),primary=$('player'),toggle=$('tm-mini-toggle');
const miniVolume=$('tm-mini-volume'),mainVolume=$('tm-volume'),stripVolume=$('tm-strip-volume');
const progress=$('tm-mini-seek'),mainProgress=$('tm-seek');
let miniSeeking=false;
if(!mini||!primary)return;
let actualTrack=null,playing=false,mainVisible=true;
const shapes={
 play:'<path d="m9 5 12 7-12 7V5Z" fill="currentColor" stroke="none"/>',
 pause:'<rect x="7" y="5" width="3.5" height="14" rx=".6" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3.5" height="14" rx=".6" fill="currentColor" stroke="none"/>'
};
const icon=name=>'<svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">'+shapes[name]+'</svg>';
function show(){
 mini.hidden=!actualTrack||!rt.account;
 toggle.innerHTML=icon(playing?'pause':'play');
 toggle.setAttribute('aria-label',playing?'Pausar':'Reproducir');
}
function updateTrack(track){
 if(!track?.id)return;
 actualTrack=track;
 $('tm-mini-title').textContent=track.name||'';
 $('tm-mini-artist').textContent=(track.artists||[]).map(a=>a.name).join(', ');
 const cover=track.album?.images?.[0]?.url||'';
 $('tm-mini-cover').style.backgroundImage=cover.startsWith('https://i.scdn.co/')?'url("'+cover+'")':'none';
 show()
}
window.addEventListener('tm:track',e=>updateTrack(e.detail?.track));
window.addEventListener('tm:playback',e=>{
 playing=!!e.detail?.playing;
 const state=rt.state;
 if(state?.volume!=null){miniVolume.value=state.volume;if(stripVolume)stripVolume.value=state.volume}
 else if(mainVolume){miniVolume.value=mainVolume.value;if(stripVolume)stripVolume.value=mainVolume.value}
 if(progress)progress.disabled=!rt.state?.duration;
 show()
});
toggle.onclick=()=>{if($('tm-play'))$('tm-play').click()};
const prev=$('tm-mini-prev'),next=$('tm-mini-next');
prev.onclick=()=>$('tm-prev')?.click();
next.onclick=()=>$('tm-next')?.click();
const queuePanel=$('tm-mini-queue-panel'),queueContainer=$('tm-mini-queue-tracks');
async function updateQueue(){
 let tracks=rt.queue||[];
 queueContainer.replaceChildren();
 if(!tracks.length&&rt.account&&sp){
   try{
     const response=await sp.api('/me/player/queue');
     tracks=(response?.queue||[]).filter(t=>t?.type==='track'&&t?.uri).slice(0,30)
   }catch(e){rt.status('Cola de Spotify: '+e.message,true)}
 }
 const current=actualTrack?.id;
 if(!tracks.length){
   const hint=document.createElement('p');hint.textContent='No hay una secuencia iniciada desde esta página.';
   queueContainer.append(hint);return
 }
 for(let i=0;i<tracks.length;i++){
   const t=tracks[i],button=document.createElement('button');
   button.type='button';button.className='tm-mini-queue-item';
   if(t.id===current)button.classList.add('is-current');
   const index=document.createElement('span');index.className='tm-mini-queue-index';index.textContent=String(i+1).padStart(2,'0');
   const name=document.createElement('span');name.className='tm-mini-queue-name';
   const ttl=document.createElement('strong');ttl.textContent=t.name||'';
   const artist=document.createElement('small');artist.textContent=(t.artists||[]).map(a=>a.name).join(', ');
   name.append(ttl,artist);button.append(index,name);
   button.onclick=async()=>{
     $('tm-mini-queue').disabled=true;
     try{
       if(await rt.playSequence(tracks.slice(i)))queuePanel.hidden=true;
     }finally{$('tm-mini-queue').disabled=false}
   };
   queueContainer.append(button);
 }
}
$('tm-mini-queue').onclick=()=>{
 queuePanel.hidden=!queuePanel.hidden;
 if(!queuePanel.hidden)void updateQueue()
};
$('tm-mini-queue-close').onclick=()=>{queuePanel.hidden=true};
document.addEventListener('keydown',e=>{if(e.key==='Escape')queuePanel.hidden=true});
$('tm-mini-share').onclick=async()=>{
 if(!/^[A-Za-z0-9]{22}$/.test(actualTrack?.id||''))return;
 const url='https://open.spotify.com/track/'+actualTrack.id;
 try{
   if(navigator.share)await navigator.share({title:actualTrack.name,url});
   else await navigator.clipboard.writeText(url);
   $('tm-mini-share').title='Enlace copiado';
 }catch(e){
   if(e.name!=='AbortError')rt.status('No se pudo compartir la canción: '+e.message,true)
 }
};
function changeVolume(value){
 if(!mainVolume)return;
 mainVolume.value=value;
 miniVolume.value=value;
 if(stripVolume)stripVolume.value=value;
 mainVolume.dispatchEvent(new Event('input',{bubbles:true}));
}
miniVolume.addEventListener('input',()=>changeVolume(miniVolume.value));
stripVolume?.addEventListener('input',()=>changeVolume(stripVolume.value));
if(typeof IntersectionObserver!=='undefined'){
 const observer=new IntersectionObserver(entries=>{
   mainVisible=entries[0]?.isIntersecting!==false;
   show()
 },{threshold:0});
 observer.observe(primary);
}else{
 const check=()=>{const r=primary.getBoundingClientRect();mainVisible=r.bottom>0&&r.top<window.innerHeight;show()};
 window.addEventListener('scroll',check,{passive:true});window.addEventListener('resize',check);check()
}
if(progress&&mainProgress){
 progress.addEventListener('pointerdown',()=>{miniSeeking=true});
 progress.addEventListener('input',()=>{
   miniSeeking=true;
   const duration=rt.state?.duration||0;
   $('tm-mini-elapsed').textContent=formatTime(Number(progress.value)/1000*duration);
 });
 progress.addEventListener('change',()=>{
   miniSeeking=false;
   mainProgress.value=progress.value;
   mainProgress.dispatchEvent(new Event('change',{bubbles:true}));
 });
}
function formatTime(ms){
 const s=Math.floor(Math.max(0,Number(ms)||0)/1000);
 return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')
}
setInterval(()=>{
 const state=rt.state;
 if(!state?.duration||!actualTrack)return;
 const max=state.duration;
 $('tm-mini-duration').textContent=formatTime(max);
 if(!miniSeeking){
   if(mainProgress?.value)progress.value=mainProgress.value;
   $('tm-mini-elapsed').textContent=$('tm-elapsed')?.textContent||formatTime(state.position||0);
 }
},1000);
if(rt.state?.playing&&rt.currentTrack?.id)updateTrack(rt.currentTrack);
})();
