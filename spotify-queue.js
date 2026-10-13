/* Queue and sharing for the single bottom player. */
(function(){
'use strict';
const rt=window.TransmissionRuntime,sp=window.TransmissionSpotify;
if(!rt||!sp)return;
const $=id=>document.getElementById(id);
const panel=$('tm-mini-queue-panel'),container=$('tm-mini-queue-tracks'),trigger=$('tm-mini-queue');
if(!panel||!container||!trigger)return;
let serial=0,pending=null,cached=null;
function close(){++serial;panel.hidden=true;trigger.setAttribute('aria-expanded','false')}
async function updateQueue(){
 const request=++serial;
 let tracks=rt.queue||[];
 if(!tracks.length&&rt.account){
   const account=rt.account.id;
   try{
     if(cached?.account===account&&Date.now()-cached.at<20000)tracks=cached.tracks;
     else{
       if(!pending||pending.account!==account){
         const reading={account,promise:sp.api('/me/player/queue')};pending=reading;
         reading.promise.finally(()=>{if(pending===reading)pending=null}).catch(()=>{});
       }
       const response=await pending.promise;
       if(rt.account?.id!==account)return;
       tracks=[response?.currently_playing,...(response?.queue||[])].filter(t=>t?.type==='track'&&t?.uri).slice(0,30);
       cached={account,at:Date.now(),tracks};
     }
   }catch(error){rt.status('Cola de Spotify: '+error.message,true)}
 }
 if(request!==serial||panel.hidden)return;
 container.replaceChildren();
 if(!tracks.length){
   const hint=document.createElement('p');hint.className='tm-empty';hint.textContent='La cola está vacía.';container.append(hint);return;
 }
 const current=rt.currentTrack?.id;
 for(const [index,track] of tracks.entries()){
   const button=document.createElement('button');button.type='button';button.className='tm-mini-queue-item';
   if(track.id===current)button.classList.add('is-current');
   const number=document.createElement('span');number.className='tm-mini-queue-index';number.textContent=String(index+1).padStart(2,'0');
   const name=document.createElement('span');name.className='tm-mini-queue-name';
   const title=document.createElement('strong');title.textContent=track.name||'';
   const artist=document.createElement('small');artist.textContent=(track.artists||[]).map(a=>a.name).join(', ');
   name.append(title,artist);button.append(number,name);
   button.onclick=async()=>{
     trigger.disabled=true;
     try{if(await rt.playSequence(tracks,index))close()}
     catch(error){rt.status('Cola: '+error.message,true)}
     finally{trigger.disabled=false}
   };
   container.append(button);
 }
}
trigger.onclick=()=>{
 if(!panel.hidden){close();return}
 panel.hidden=false;trigger.setAttribute('aria-expanded','true');void updateQueue();
};
$('tm-mini-queue-close').onclick=close;
let lastTrack=rt.currentTrack?.id;
window.addEventListener('tm:track',event=>{
 const next=event.detail?.track?.id;
 if(next!==lastTrack){lastTrack=next;cached=null;if(!panel.hidden)void updateQueue()}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!trigger.contains(event.target))close()});
$('tm-mini-share').onclick=async()=>{
 const track=rt.currentTrack;
 if(!/^[A-Za-z0-9]{22}$/.test(track?.id||''))return;
 const url='https://open.spotify.com/track/'+track.id;
 try{
   if(navigator.share)await navigator.share({title:track.name,url});
   else await navigator.clipboard.writeText(url);
   $('tm-mini-share').title='Enlace copiado';
 }catch(error){if(error.name!=='AbortError')rt.status('Compartir: '+error.message,true)}
};
})();
