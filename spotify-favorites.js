/* One account-scoped library cache for the player, catalog and track menus. */
(function(){
'use strict';
const sp=window.TransmissionSpotify,rt=window.TransmissionRuntime,main=document.getElementById('tm-favorite');
if(!sp||!rt||!main)return;
const cache=new Map(),pending=new Map(),mutations=new Map(),versions=new Map(),ttl=300000;
const valid=t=>/^[A-Za-z0-9]{22}$/.test(t?.id||'')&&t?.type!=='episode';
const key=t=>(rt.account?.id||'')+':'+t.id;
let song=null,inspection=0;
function state(t){const entry=valid(t)?cache.get(key(t)):null;return entry&&Date.now()-entry.at<ttl?entry.saved:null}
function draw(){
 const saved=state(song),busy=song&&mutations.has(key(song));
 main.disabled=!valid(song)||!rt.account||!!busy;
 main.textContent=saved===true?'♥':'♡';main.dataset.saved=String(saved===true);
 const label=saved===true?'Quitar de Me gusta':'Guardar en Me gusta';
 main.setAttribute('aria-label',label);main.title=label;main.setAttribute('aria-pressed',String(saved===true));
 window.dispatchEvent(new CustomEvent('tm:favorites'));
}
async function checkTracks(tracks){
 if(!rt.account)return;
 const account=rt.account.id,ids=[...new Set((tracks||[]).filter(valid).map(t=>t.id))];
 const unknown=ids.filter(id=>{const entry=cache.get(account+':'+id);return !entry||Date.now()-entry.at>=ttl});
 for(let offset=0;offset<unknown.length;offset+=40){
   const batch=unknown.slice(offset,offset+40),requestKey=account+':'+batch.join(','),before=new Map(batch.map(id=>[id,versions.get(account+':'+id)||0]));
   let request=pending.get(requestKey);
   if(!request){
     request=sp.api('/me/library/contains?uris='+encodeURIComponent(batch.map(id=>'spotify:track:'+id).join(',')));
     pending.set(requestKey,request);request.finally(()=>pending.delete(requestKey)).catch(()=>{});
   }
   try{
     const data=await request;
     if(rt.account?.id!==account)return;
     batch.forEach((id,index)=>{if((versions.get(account+':'+id)||0)===before.get(id))cache.set(account+':'+id,{saved:Array.isArray(data)?!!data[index]:null,at:Date.now()})});
   }catch(error){rt.status('Favoritos: '+error.message,true);batch.forEach(id=>cache.set(account+':'+id,{saved:null,at:Date.now()-ttl+60000}))}
 }
 draw();
}
async function inspect(track){song=valid(track)?track:null;const serial=++inspection;draw();if(song)await checkTracks([song]);if(serial===inspection)draw()}
function toggleTrack(track){
 if(!valid(track))return Promise.resolve(false);
 if(!rt.account){rt.notify('Conecta Spotify para guardar canciones.');return Promise.resolve(false)}
 const account=rt.account.id,trackKey=key(track);
 if(mutations.has(trackKey))return mutations.get(trackKey);
 const operation=(async()=>{
   if(state(track)===null)await checkTracks([track]);
   if(rt.account?.id!==account)return false;
   const before=state(track);if(before===null)throw Error('No se pudo comprobar si la canción está guardada. Inténtalo de nuevo.');
   await sp.api('/me/library?uris='+encodeURIComponent('spotify:track:'+track.id),{method:before?'DELETE':'PUT'});
   if(rt.account?.id!==account)return false;
   versions.set(trackKey,(versions.get(trackKey)||0)+1);cache.set(trackKey,{saved:!before,at:Date.now()});
   document.dispatchEvent(new CustomEvent('tm:library-changed',{detail:{id:track.id,saved:!before,track}}));
   rt.notify(before?'Quitada de Me gusta.':'Guardada en Me gusta.');return true;
 })();
 mutations.set(trackKey,operation);draw();
 return operation.finally(()=>{mutations.delete(trackKey);draw()});
}
main.onclick=()=>void toggleTrack(song).catch(error=>{rt.status('Favoritos: '+error.message,true);rt.notify(error.message)});
window.addEventListener('tm:track',event=>{if(song?.id!==event.detail?.track?.id)void inspect(event.detail?.track)});
window.TransmissionFavorites={get state(){return state(song)},inspect,toggle:()=>toggleTrack(song),toggleTrack,checkTracks,isSaved:state};
if(valid(rt.currentTrack))void inspect(rt.currentTrack);else draw();
})();
