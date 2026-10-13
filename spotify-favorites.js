/* TRANSMISSION / Spotify library state. Uses the 2026 unified endpoints. */
(function(){
'use strict';
const sp=window.TransmissionSpotify,rt=window.TransmissionRuntime;
const main=document.getElementById('tm-favorite');
if(!sp||!rt||!main)return;
let song=null,saved=null,serial=0,busy=false,checking=false,accountId=null;
const cache=new Map(),pending=new Map();
const cacheAge=5*60*1000;
const valid=t=>t?.id&&/^[a-zA-Z0-9]{22}$/.test(t.id)&&t.type!=='episode';
const makeURI=t=>'spotify:track:'+t.id;
function draw(){
 for(const button of [main]){
   button.disabled=!valid(song)||busy;
   button.textContent=saved===true?'♥':'♡';
   button.dataset.saved=String(saved===true);
   const description=saved===true?'Quitar de Me gusta':'Guardar en Me gusta';
   button.setAttribute('aria-label',description);
   button.title=description;
   button.setAttribute('aria-pressed',String(saved===true));
 }
}
async function inspect(track){
 const next=valid(track)?track:null;
 const nextAccount=rt.account?.id||null;
 const key=nextAccount&&next?nextAccount+':'+next.id:null;
 const known=cache.get(key);
 const fresh=known&&(Date.now()-known.at<cacheAge||known.retryAt>Date.now());
 if(song?.id===next?.id&&accountId===nextAccount&&(fresh||checking||busy)){
   song=next;draw();return;
 }
 const seq=++serial;
 song=next;accountId=nextAccount;saved=null;checking=false;draw();
 if(!song||!rt.account)return;
 if(fresh){saved=known.saved;draw();return}
 checking=true;
 try{
   let request=pending.get(key);
   if(!request){
     request=sp.api('/me/library/contains?uris='+encodeURIComponent(makeURI(song)));
     pending.set(key,request);
     request.finally(()=>{if(pending.get(key)===request)pending.delete(key)}).catch(()=>{});
   }
   const data=await request;
   if(seq!==serial)return;
   saved=Array.isArray(data)?!!data[0]:false;
   cache.set(key,{saved,at:Date.now()});
 }catch(error){
   if(seq!==serial)return;
   rt.status('Favoritos: '+error.message,true);
   cache.set(key,{saved:null,at:Date.now()-cacheAge,retryAt:Math.max(Date.now()+60000,error.retryAt||0)});
   // Leave the outlined heart so that checking is possible after reconnecting.
   saved=null;
 }finally{if(seq===serial){checking=false;draw()}}
}
async function toggle(){
 if(!song||busy)return;
 if(!rt.account){
   rt.status('Conecta tu Spotify para guardar canciones.',true);return
 }
 const id=song.id,uri=makeURI(song),before=saved===true,mutationAccount=accountId;
 const key=accountId+':'+id;
 ++serial;checking=false;busy=true;draw();
 try{
   await sp.api('/me/library?uris='+encodeURIComponent(uri),{method:before?'DELETE':'PUT'});
   cache.set(key,{saved:!before,at:Date.now()});
   document.dispatchEvent(new CustomEvent('tm:library-changed',{detail:{id,saved:!before}}));
   if(song?.id===id&&accountId===mutationAccount){
     saved=!before;
   }
 }catch(error){
   rt.status('Guardar canción: '+error.message,true);
 }finally{busy=false;draw()}
}
main.onclick=toggle;
window.addEventListener('tm:track',e=>void inspect(e.detail?.track));
if(valid(rt.currentTrack))void inspect(rt.currentTrack);
draw();
window.TransmissionFavorites={get state(){return saved},inspect,toggle};
})();
